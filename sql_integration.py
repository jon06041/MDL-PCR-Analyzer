"""
MySQL-based data integration for qPCR analysis
Handles fluorophore-specific sample and Cq value matching using MySQL temporary tables
CRITICAL: Uses MySQL ONLY - SQLite deprecated
"""

import json
import pandas as pd
from sqlalchemy import create_engine, text
import os
from qpcr_analyzer import process_csv_data, validate_csv_structure

def get_database_engine():
    """Get MySQL database engine - SQLite deprecated"""
    # Priority: DATABASE_URL > individual env variables > defaults
    database_url = os.environ.get("DATABASE_URL")
    
    if database_url:
        # Railway provides DATABASE_URL, use it directly
        # Convert mysql:// to mysql+pymysql:// if needed
        if database_url.startswith("mysql://"):
            database_url = database_url.replace("mysql://", "mysql+pymysql://", 1)
        
        # Ensure charset=utf8mb4 is included for proper sample name handling
        if "charset=" not in database_url:
            separator = "&" if "?" in database_url else "?"
            database_url = f"{database_url}{separator}charset=utf8mb4"
        
        mysql_url = database_url
        print(f"[DEBUG] SQL integration using DATABASE_URL: {database_url.split('@')[1] if '@' in database_url else 'configured'}")
    else:
        # Fallback to individual environment variables
        mysql_host = os.environ.get("MYSQL_HOST", "127.0.0.1")
        mysql_port = os.environ.get("MYSQL_PORT", "3306")
        mysql_user = os.environ.get("MYSQL_USER", "qpcr_user")
        mysql_password = os.environ.get("MYSQL_PASSWORD", "qpcr_password")
        mysql_database = os.environ.get("MYSQL_DATABASE", "qpcr_analysis")
        
        mysql_url = f'mysql+pymysql://{mysql_user}:{mysql_password}@{mysql_host}:{mysql_port}/{mysql_database}?charset=utf8mb4'
        print(f"[DEBUG] SQL integration using individual vars: {mysql_host}:{mysql_port}/{mysql_database}")
    
    try:
        engine = create_engine(mysql_url, echo=False)
        # Test connection
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return engine
    except Exception as e:
        print(f"❌ CRITICAL ERROR: MySQL connection failed in sql_integration: {e}")
        print("🔧 Check MySQL configuration and ensure database is running")
        raise ConnectionError(f"SQL Integration requires MySQL. Connection failed: {e}")

def process_with_sql_integration(amplification_data, samples_csv_data, fluorophore):
    """
    Process qPCR data using SQL-based integration of amplification and samples data
    
    Args:
        amplification_data: Dict of well amplification data
        samples_csv_data: Raw CSV string of samples/quantification summary
        fluorophore: Current fluorophore being processed (Cy5, FAM, HEX, etc.)
    
    Returns:
        Dict with analysis results including fluorophore-specific sample integration
    """
    
    print(f"Starting SQL-based integration for {fluorophore}")
    
    # First, run the standard analysis on amplification data
    validation_errors, validation_warnings = validate_csv_structure(amplification_data)
    if validation_errors:
        return {
            'error': f"Invalid amplification data structure: {'; '.join(validation_errors)}", 
            'success': False
        }
    
    # Process amplification data to get curve analysis results
    analysis_results = process_csv_data(amplification_data)
    # Preserve frontend-parsed sample_name and cq_value so they are not lost
    if 'individual_results' in analysis_results:
        for well_id, well_result in analysis_results['individual_results'].items():
            original = amplification_data.get(well_id)
            if original:
                if 'sample_name' in original and original['sample_name'] is not None:
                    well_result['sample_name'] = original['sample_name']
                if 'cq_value' in original and original['cq_value'] is not None:
                    well_result['cq_value'] = original['cq_value']
    if not analysis_results.get('success', False):
        return analysis_results
    
    # Parse samples CSV data
    try:
        # Convert CSV string to DataFrame
        from io import StringIO
        samples_df = pd.read_csv(StringIO(samples_csv_data))
        print(f"[SQL-DEBUG] Parsed samples CSV: {len(samples_df)} rows, columns: {list(samples_df.columns)}")
        print(f"[SQL-DEBUG] First few rows: {samples_df.head(3).to_dict('records')}")
        
    except Exception as e:
        print(f"[SQL-ERROR] Error parsing samples CSV: {e}")
        print(f"[SQL-ERROR] CSV data preview: {samples_csv_data[:500]}...")
        # Return analysis results without sample integration if CSV parsing fails
        return analysis_results
    
    # Perform SQL-based integration
    try:
        engine = get_database_engine()
        
        with engine.connect() as conn:
            # Create temporary table for this session (MySQL syntax)
            conn.execute(text("""
                CREATE TEMPORARY TABLE temp_samples (
                    session_id VARCHAR(36),
                    well_id VARCHAR(10),
                    fluorophore VARCHAR(20),
                    sample_name VARCHAR(255),
                    cq_value DECIMAL(10,4)
                ) ENGINE=MEMORY DEFAULT CHARSET=utf8mb4
            """))
            
            # Generate unique session ID for this analysis
            import uuid
            session_id = str(uuid.uuid4())[:8]
            
            # Insert sample data filtered by fluorophore
            sample_records = []
            
            # Detect column indices (CFX Manager format) - restore simpler approach
            well_col = 1 if len(samples_df.columns) > 1 else 0  # Well column
            fluor_col = 2 if len(samples_df.columns) > 2 else 1  # Fluor column
            sample_col = 5 if len(samples_df.columns) > 5 else -1  # Sample column
            cq_col = 6 if len(samples_df.columns) > 6 else -1  # Cq column
            
            print(f"[SQL-DEBUG] Using CFX format columns - Well: {well_col}, Fluor: {fluor_col}, Sample: {sample_col}, Cq: {cq_col}")
            print(f"[SQL-DEBUG] Column names: {list(samples_df.columns)}")
            
            for row_idx, row in samples_df.iterrows():
                try:
                    well_raw = str(row.iloc[well_col]) if well_col < len(row) else None
                    fluor_raw = str(row.iloc[fluor_col]) if fluor_col < len(row) else None
                    sample_raw = str(row.iloc[sample_col]) if sample_col >= 0 and sample_col < len(row) else None
                    cq_raw = row.iloc[cq_col] if cq_col >= 0 and cq_col < len(row) else None
                    
                    # Debug first few rows
                    if row_idx < 5:
                        print(f"[SQL-DEBUG] Row {row_idx}: Well='{well_raw}', Fluor='{fluor_raw}', Sample='{sample_raw}', Cq='{cq_raw}'")
                    
                    # Skip header row and invalid data
                    if not well_raw or well_raw.lower() in ['well', 'nan', ''] or not fluor_raw:
                        continue
                    
                    # Filter by current fluorophore (exact match - restore original logic)
                    if fluor_raw != fluorophore:
                        continue
                    
                    # Convert well format A01 -> A1
                    import re
                    well_normalized = re.sub(r'^([A-P])0(\d)$', r'\1\2', well_raw)
                    
                    # Parse Cq value
                    cq_value = None
                    if cq_raw and str(cq_raw).lower() not in ['nan', '', 'cq']:
                        try:
                            cq_value = float(cq_raw)
                        except (ValueError, TypeError):
                            pass
                    
                    sample_records.append({
                        'session_id': session_id,
                        'well_id': well_normalized,
                        'fluorophore': fluorophore,
                        'sample_name': sample_raw if sample_raw and sample_raw.lower() not in ['nan', '', 'sample'] else None,
                        'cq_value': cq_value
                    })
                    
                except Exception as row_error:
                    print(f"[SQL-ERROR] Error processing row {row_idx}: {row_error}")
                    continue
            
            print(f"[SQL-DEBUG] Prepared {len(sample_records)} sample records for {fluorophore}")
            
            # Insert sample records into temporary table
            if sample_records:
                sample_df = pd.DataFrame(sample_records)
                sample_df.to_sql('temp_samples', conn, if_exists='append', index=False, method='multi')
                
                # Integrate sample data with analysis results using SQL JOIN
                integration_query = text("""
                    SELECT 
                        s.well_id,
                        s.sample_name,
                        s.cq_value,
                        s.fluorophore
                    FROM temp_samples s
                    WHERE s.session_id = :session_id 
                      AND s.fluorophore = :fluorophore
                      AND s.well_id IS NOT NULL
                """)
                
                result = conn.execute(integration_query, {
                    'session_id': session_id,
                    'fluorophore': fluorophore
                })
                
                sample_mapping = {}
                cq_mapping = {}
                
                for row in result:
                    well_id = row.well_id
                    if row.sample_name:
                        sample_mapping[well_id] = row.sample_name
                    if row.cq_value is not None:
                        cq_mapping[well_id] = row.cq_value
                
                print(f"[SQL-SUCCESS] SQL integration complete: {len(sample_mapping)} samples, {len(cq_mapping)} Cq values for {fluorophore}")
                
                # Apply SQL results to analysis results - restore simpler approach but preserve existing data
                if 'individual_results' in analysis_results:
                    for well_id, well_result in analysis_results['individual_results'].items():
                        # Only update sample_name if we found one in CSV, otherwise preserve existing
                        if well_id in sample_mapping:
                            well_result['sample_name'] = sample_mapping[well_id]
                            well_result['sample'] = sample_mapping[well_id]  # Set both for compatibility
                        elif 'sample_name' not in well_result or well_result['sample_name'] is None:
                            well_result['sample_name'] = 'Unknown'
                        
                        # Only update cq_value if we found one in CSV
                        if well_id in cq_mapping:
                            well_result['cq_value'] = cq_mapping[well_id]
                        
                        # Always set fluorophore
                        well_result['fluorophore'] = fluorophore
                
                # Clean up temporary table (MySQL handles session cleanup automatically)
                conn.commit()
                
            else:
                print(f"[SQL-WARNING] No valid sample records found for {fluorophore}")
                # Still add fluorophore info and ensure sample_name is set
                if 'individual_results' in analysis_results:
                    for well_id, well_result in analysis_results['individual_results'].items():
                        # Preserve existing sample_name, set to Unknown only if missing
                        if 'sample_name' not in well_result or well_result['sample_name'] is None:
                            well_result['sample_name'] = 'Unknown'
                        # Always set fluorophore
                        well_result['fluorophore'] = fluorophore
        
    except Exception as sql_error:
        print(f"[SQL-ERROR] SQL integration error: {sql_error}")
        # Continue with analysis results even if SQL integration fails
        pass
    
    print(f"SQL-based integration completed for {fluorophore}")
    return analysis_results

def create_multi_fluorophore_sql_analysis(all_fluorophore_data, samples_csv_data):
    """
    Process multiple fluorophores using SQL-based integration
    
    Args:
        all_fluorophore_data: Dict of {fluorophore: amplification_data}
        samples_csv_data: Raw CSV string of samples/quantification summary
    
    Returns:
        Combined analysis results with fluorophore-specific sample integration
    """
    
    print("Starting multi-fluorophore SQL analysis")
    
    combined_results = {
        'total_wells': 0,
        'good_curves': [],
        'success_rate': 0,
        'individual_results': {},
        'fluorophore_count': len(all_fluorophore_data),
        'success': True
    }
    
    total_good_curves = 0
    total_analyzed_records = 0
    
    for fluorophore, amplification_data in all_fluorophore_data.items():
        print(f"Processing {fluorophore} with SQL integration...")
        
        # Process each fluorophore with SQL integration
        fluor_results = process_with_sql_integration(
            amplification_data, 
            samples_csv_data, 
            fluorophore
        )
        
        if not fluor_results.get('success', False):
            print(f"Failed to process {fluorophore}: {fluor_results.get('error', 'Unknown error')}")
            continue
        
        # Aggregate results
        if fluor_results.get('good_curves'):
            total_good_curves += len(fluor_results['good_curves'])
            combined_results['good_curves'].extend([f"{well}_{fluorophore}" for well in fluor_results['good_curves']])
        
        if fluor_results.get('individual_results'):
            total_analyzed_records += len(fluor_results['individual_results'])
            for well_id, well_result in fluor_results['individual_results'].items():
                tagged_well_id = f"{well_id}_{fluorophore}"
                # Force sample_name and sample to always be a string
                sample_name = well_result.get('sample_name') or well_result.get('sample') or 'Unknown'
                well_result['sample_name'] = sample_name
                well_result['sample'] = sample_name
                combined_results['individual_results'][tagged_well_id] = well_result
    
    # Calculate combined metrics
    combined_results['total_wells'] = total_analyzed_records // len(all_fluorophore_data) if all_fluorophore_data else 0
    combined_results['success_rate'] = (total_good_curves / total_analyzed_records * 100) if total_analyzed_records > 0 else 0
    
    print(f"Multi-fluorophore SQL analysis complete: {total_analyzed_records} records, {total_good_curves} good curves")
    
    return combined_results