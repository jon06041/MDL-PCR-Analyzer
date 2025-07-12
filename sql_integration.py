"""
SQL-based data integration for qPCR analysis
Handles fluorophore-specific sample and Cq value matching using PostgreSQL temporary tables
"""

import json
import pandas as pd
from sqlalchemy import create_engine, text
import os
from qpcr_analyzer import process_csv_data, validate_csv_structure

def get_database_engine():
    """Get SQLite database engine"""
    # Use SQLite database file from the project
    sqlite_path = os.path.join(os.path.dirname(__file__), 'qpcr_analysis.db')
    abs_path = os.path.abspath(sqlite_path)
    print(f"[DEBUG] SQL integration DB path: {abs_path}")
    return create_engine(f'sqlite:///{abs_path}')

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
            # Create temporary table for this session (SQLite syntax)
            conn.execute(text("""
                CREATE TEMPORARY TABLE IF NOT EXISTS temp_samples (
                    session_id TEXT,
                    well_id TEXT,
                    fluorophore TEXT,
                    sample_name TEXT,
                    cq_value REAL
                )
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
                
                # Apply SQL results to analysis results - restore simpler approach
                if 'individual_results' in analysis_results:
                    for well_id, well_result in analysis_results['individual_results'].items():
                        # Add fluorophore-specific sample data (restore original logic)
                        well_result['sample_name'] = sample_mapping.get(well_id, 'Unknown')
                        well_result['cq_value'] = cq_mapping.get(well_id, None)
                        well_result['fluorophore'] = fluorophore
                
                # Clean up temporary table (SQLite will auto-drop on connection close)
                conn.commit()
                
            else:
                print(f"[SQL-WARNING] No valid sample records found for {fluorophore}")
        
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
                combined_results['individual_results'][tagged_well_id] = well_result
    
    # Calculate combined metrics
    combined_results['total_wells'] = total_analyzed_records // len(all_fluorophore_data) if all_fluorophore_data else 0
    combined_results['success_rate'] = (total_good_curves / total_analyzed_records * 100) if total_analyzed_records > 0 else 0
    
    print(f"Multi-fluorophore SQL analysis complete: {total_analyzed_records} records, {total_good_curves} good curves")
    
    return combined_results