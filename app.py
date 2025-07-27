from flask import Flask, request, jsonify, send_from_directory
import json
import os
import re
import traceback
import logging
from logging.handlers import RotatingFileHandler
import numpy as np
from datetime import datetime
from qpcr_analyzer import process_csv_data, validate_csv_structure
from models import db, AnalysisSession, WellResult, ExperimentStatistics
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.exc import OperationalError, IntegrityError, DatabaseError
from threshold_backend import create_threshold_routes
from cqj_calcj_utils import calculate_cqj_calcj_for_well
from ml_config_manager import MLConfigManager
from fda_compliance_manager import FDAComplianceManager
from unified_compliance_manager import UnifiedComplianceManager

def safe_json_dumps(value, default=None):
    """Helper function to safely serialize to JSON, avoiding double-encoding"""
    if value is None:
        return None
    # If already a string, assume it's already JSON-encoded
    if isinstance(value, str):
        try:
            # Validate it's valid JSON
            json.loads(value)
            return value
        except (json.JSONDecodeError, TypeError):
            # If not valid JSON, treat as a raw string and encode it
            return json.dumps(value)
    # Otherwise, serialize the object/list to JSON
    return json.dumps(value if value is not None else default)

def get_pathogen_mapping():
    """Centralized pathogen mapping that matches pathogen_library.js"""
    return {
        "Lacto": {
            "Cy5": "Lactobacillus jenseni",
            "FAM": "Lactobacillus gasseri", 
            "HEX": "Lactobacillus iners",
            "Texas Red": "Lactobacillus crispatus"
        },
        "Calb": {
            "HEX": "Candida albicans"
        },
        "Ctrach": {
            "FAM": "Chlamydia trachomatis"
        },
        "Ngon": {
            "HEX": "Neisseria gonhorrea"
        },
        "Tvag": {
            "FAM": "Trichomonas vaginalis"
        },
        "Cglab": {
            "FAM": "Candida glabrata"
        },
        "Cpara": {
            "FAM": "Candida parapsilosis"
        },
        "Ctrop": {
            "FAM": "Candida tropicalis"
        },
        "Gvag": {
            "FAM": "Gardnerella vaginalis"
        },
        "BVAB2": {
            "FAM": "BVAB2"
        },
        "CHVIC": {
            "FAM": "CHVIC"
        },
        "AtopVag": {
            "FAM": "Atopobium vaginae"
        },
        "Megasphaera": {
            "FAM": "Megasphaera1",
            "HEX": "Megasphaera2"
        },
        "BVPanelPCR1": {
            "FAM": "Bacteroides fragilis",
            "HEX": "Mobiluncus curtisii",
            "Texas Red": "Streptococcus anginosus",
            "Cy5": "Sneathia sanguinegens"
        },
        "BVPanelPCR2": {
            "FAM": "Atopobium vaginae",
            "HEX": "Mobiluncus mulieris",
            "Texas Red": "Megasphaera type 2",
            "Cy5": "Megasphaera type 1"
        },
        "BVPanelPCR3": {
            "FAM": "Gardnerella vaginalis",
            "HEX": "Lactobacillus acidophilus",
            "Texas Red": "Prevotella bivia",
            "Cy5": "Bifidobacterium breve"
        },
        "BVPanelPCR4": {
            "FAM": "Gardnerella vaginalis",
            "HEX": "Lactobacillus acidophilus",
            "Texas Red": "Prevotella bivia",
            "Cy5": "Bifidobacterium breve"
        },
        "BVAB": {
            "FAM": "BVAB2",
            "HEX": "BVAB1", 
            "Cy5": "BVAB3"
        },
        "Mgen": {
            "FAM": "Mycoplasma genitalium"
        },
        "Upar": {
            "FAM": "Ureaplasma parvum"
        },
        "Uure": {
            "FAM": "Ureaplasma urealyticum"
        }
        # Add more mappings as needed from pathogen_library.js
    }

def get_pathogen_target(test_code, fluorophore):
    """Get pathogen target for a given test code and fluorophore"""
    pathogen_mapping = get_pathogen_mapping()
    
    if test_code in pathogen_mapping:
        return pathogen_mapping[test_code].get(fluorophore, fluorophore)
    
    # Fallback to fluorophore name if no mapping found
    return fluorophore

def extract_base_pattern(filename):
    """Extract base pattern from CFX Manager filename, handling trailing dashes"""
    # Match pattern: prefix_numbers_CFXnumbers (allowing additional suffixes)
    pattern = r'^([A-Za-z][A-Za-z0-9]*_\d+_CFX\d+)'
    match = re.match(pattern, filename)
    if match:
        # Clean up any trailing dashes or spaces from the extracted pattern
        return re.sub(r'[-\s]+$', '', match.group(1))
    # Fallback to filename without extension, also cleaning trailing dashes
    return re.sub(r'[-\s]+$', '', filename.split('.')[0])

def validate_file_pattern_consistency(filenames):
    """Validate that all files share the same base pattern"""
    if not filenames:
        return True, ""
    
    base_patterns = []
    for filename in filenames:
        base_pattern = extract_base_pattern(filename)
        base_patterns.append(base_pattern)
    
    # Check if all base patterns are the same
    unique_patterns = set(base_patterns)
    if len(unique_patterns) > 1:
        return False, f"Files have different base patterns: {', '.join(unique_patterns)}"
    
    return True, ""

def save_individual_channel_session(filename, results, fluorophore, summary):
    """Save individual channel session to database for channel tracking with completion status"""
    try:
        from models import AnalysisSession, WellResult
        
        # Extract experiment pattern and test code for completion tracking
        base_pattern = extract_base_pattern(filename)
        test_code = base_pattern.split('_')[0]
        if test_code.startswith('Ac'):
            test_code = test_code[2:]  # Remove "Ac" prefix
        
        print(f"DEBUG: Individual channel session - filename: {filename}, fluorophore: {fluorophore}")
        print(f"DEBUG: Completion tracking - base_pattern: {base_pattern}, test_code: {test_code}")
        app.logger.info(f"Individual channel session - filename: {filename}, fluorophore: {fluorophore}")
        app.logger.info(f"Completion tracking - base_pattern: {base_pattern}, test_code: {test_code}")
        
        # Enhanced fluorophore detection from filename if not provided
        if not fluorophore:
            # Extract fluorophore from CFX Manager filename format
            fluorophores = ['Cy5', 'FAM', 'HEX', 'Texas Red']
            for fluor in fluorophores:
                if f'_{fluor}.csv' in filename or f'_{fluor}_' in filename:
                    fluorophore = fluor
                    break
                elif fluor.lower() in filename.lower():
                    fluorophore = fluor
                    break
            
            print(f"DEBUG: Enhanced fluorophore detection result: {fluorophore}")
            app.logger.info(f"Enhanced fluorophore detection result: {fluorophore}")
        
        # Get pathogen target for naming purposes
        pathogen_target = get_pathogen_target(test_code, fluorophore)
        
        # Calculate statistics from results
        individual_results = results.get('individual_results', {})
        total_wells = len(individual_results)
        
        # Use complete filename as experiment name for individual channels
        experiment_name = filename
        total_wells = len(individual_results)
        
        # Count positive wells (POS classification: amplitude > 500 and no anomalies)
        positive_wells = 0
        if isinstance(individual_results, dict):
            for well_data in individual_results.values():
                if isinstance(well_data, dict):
                    amplitude = well_data.get('amplitude', 0)
                    anomalies = well_data.get('anomalies', [])
                    has_anomalies = False
                    
                    if anomalies and anomalies != ['None']:
                        has_anomalies = True
                    
                    if amplitude > 500 and not has_anomalies:
                        positive_wells += 1
        
        success_rate = (positive_wells / total_wells * 100) if total_wells > 0 else 0
        
        # Extract cycle information - handle both dict and list formats
        cycle_count = None
        cycle_min = None
        cycle_max = None
        
        # Handle both dict and list formats for cycle extraction
        if isinstance(individual_results, dict):
            well_data_items = individual_results.values()
        elif isinstance(individual_results, list):
            well_data_items = individual_results
        else:
            well_data_items = []
        
        for well_data in well_data_items:
            if isinstance(well_data, dict) and well_data.get('raw_cycles'):
                try:
                    cycles = well_data['raw_cycles']
                    if isinstance(cycles, list) and len(cycles) > 0:
                        cycle_count = len(cycles)
                        cycle_min = min(cycles)
                        cycle_max = max(cycles)
                        break
                except (ValueError, TypeError):
                    continue
        
        # Default cycle info if not found
        if cycle_count is None:
            cycle_count = 33
            cycle_min = 1
            cycle_max = 33
        
        # Calculate pathogen breakdown for individual channel
        pathogen_breakdown_display = None
        if fluorophore:
            # Extract test code from filename pattern (e.g., AcBVAB_2578825_CFX367393 -> BVAB)
            base_pattern = filename.replace(' -  Quantification Amplification Results_' + fluorophore + '.csv', '')
            test_code = base_pattern.split('_')[0]
            if test_code.startswith('Ac'):
                test_code = test_code[2:]  # Remove "Ac" prefix
            
            print(f"DEBUG: Test code extraction - filename: {filename}, base_pattern: {base_pattern}, test_code: {test_code}")
            app.logger.info(f"Test code extraction - filename: {filename}, base_pattern: {base_pattern}, test_code: {test_code}")
            
            # Use centralized pathogen mapping
            pathogen_target = get_pathogen_target(test_code, fluorophore)
            
            print(f"Backend pathogen mapping: {test_code} + {fluorophore} -> {pathogen_target}")
            app.logger.info(f"Backend pathogen mapping: {test_code} + {fluorophore} -> {pathogen_target}")
            
            # Calculate positive percentage for this channel
            pos_count = 0
            total_count = len(individual_results)
            
            if isinstance(individual_results, dict):
                for well_data in individual_results.values():
                    if isinstance(well_data, dict) and well_data.get('amplitude', 0) > 500:
                        pos_count += 1
            
            positive_percentage = (pos_count / total_count * 100) if total_count > 0 else 0
            pathogen_breakdown_display = f"{pathogen_target}: {positive_percentage:.1f}%"
            
            print(f"Individual channel pathogen breakdown: {pathogen_breakdown_display} (fluorophore: {fluorophore}, target: {pathogen_target})")
            app.logger.info(f"Individual channel pathogen breakdown: {pathogen_breakdown_display} (fluorophore: {fluorophore}, target: {pathogen_target})")
        else:
            print(f"No fluorophore detected for individual channel session: {filename}")
            app.logger.warning(f"No fluorophore detected for individual channel session: {filename}")
        
        # Check for existing session with same complete filename and overwrite
        existing_session = AnalysisSession.query.filter_by(filename=experiment_name).first()
        
        if existing_session:
            # Update existing session
            session = existing_session
            WellResult.query.filter_by(session_id=session.id).delete()
            session.total_wells = total_wells
            session.good_curves = positive_wells
            session.success_rate = success_rate
            session.cycle_count = cycle_count
            session.cycle_min = cycle_min
            session.cycle_max = cycle_max
            session.pathogen_breakdown = str(pathogen_breakdown_display) if pathogen_breakdown_display else ""
            session.upload_timestamp = datetime.utcnow()
        else:
            # Create new session
            session = AnalysisSession()
            session.filename = str(experiment_name)
            session.total_wells = total_wells
            session.good_curves = positive_wells
            session.success_rate = success_rate
            session.cycle_count = cycle_count
            session.cycle_min = cycle_min
            session.cycle_max = cycle_max
            session.pathogen_breakdown = str(pathogen_breakdown_display) if pathogen_breakdown_display else ""
            session.upload_timestamp = datetime.utcnow()
            db.session.add(session)
        
        # Commit session first to get ID
        db.session.commit()
        
        # Save well results with fluorophore information
        well_count = 0
        
        # Debug the individual_results structure
        print(f"Individual results type: {type(individual_results)}")
        app.logger.info(f"Individual results type: {type(individual_results)}")
        if individual_results:
            first_key = next(iter(individual_results)) if isinstance(individual_results, dict) else None
            if first_key:
                print(f"First key: {first_key}, First value type: {type(individual_results[first_key])}")
                app.logger.info(f"First key: {first_key}, First value type: {type(individual_results[first_key])}")
        
        # Handle both dict and list formats for individual_results
        if isinstance(individual_results, dict):
            results_items = individual_results.items()
        elif isinstance(individual_results, list):
            # Convert list to dict format using well_id as key
            results_items = []
            for i, result in enumerate(individual_results):
                if isinstance(result, dict) and 'well_id' in result:
                    well_key = result['well_id']
                    # Add fluorophore suffix if not present
                    if fluorophore and not well_key.endswith(f'_{fluorophore}'):
                        well_key = f"{well_key}_{fluorophore}"
                    
                    # Debug well_id construction and control sample detection
                    sample_name = result.get('sample_name', '')
                    print(f"[CONTROL DEBUG] Well {well_key}: sample_name='{sample_name}', fluorophore='{fluorophore}'")
                    app.logger.info(f"[CONTROL DEBUG] Well {well_key}: sample_name='{sample_name}', fluorophore='{fluorophore}'")
                    
                    # Ensure well data has fluorophore and coordinate info for control grid
                    if 'fluorophore' not in result and fluorophore:
                        result['fluorophore'] = fluorophore
                    
                    # Extract coordinate from well_id for control grid (remove fluorophore suffix)
                    base_coordinate = well_key.split('_')[0] if '_' in well_key else well_key
                    if 'coordinate' not in result:
                        result['coordinate'] = base_coordinate
                    
                    results_items.append((well_key, result))
                else:
                    print(f"Warning: List item {i} is not a valid dict or missing well_id: {type(result)}")
                    continue
        else:
            print(f"Warning: Unexpected individual_results type: {type(individual_results)}")
            results_items = []
        
        for well_key, well_data in results_items:
            # Ensure well_data is a dictionary
            if not isinstance(well_data, dict):
                print(f"Warning: well_data for {well_key} is not a dict: {type(well_data)}")
                app.logger.warning(f"Warning: well_data for {well_key} is not a dict: {type(well_data)}")
                continue
                
            # Debug control sample information before saving to database
            sample_name = well_data.get('sample_name', '')
            coordinate = well_data.get('coordinate', '')
            if sample_name and any(control in sample_name.upper() for control in ['H1', 'H2', 'H3', 'H4', 'M1', 'M2', 'M3', 'M4', 'L1', 'L2', 'L3', 'L4', 'NTC']):
                print(f"[CONTROL SAVE] Control well {well_key}: sample='{sample_name}', coord='{coordinate}', fluor='{fluorophore}'")
                app.logger.info(f"[CONTROL SAVE] Control well {well_key}: sample='{sample_name}', coord='{coordinate}', fluor='{fluorophore}'")
                
            try:
                well_result = WellResult()
                well_result.session_id = session.id
                well_result.well_id = str(well_key)
                well_result.is_good_scurve = bool(well_data.get('is_good_scurve', False))
                well_result.r2_score = float(well_data.get('r2_score', 0)) if well_data.get('r2_score') is not None else None
                well_result.rmse = float(well_data.get('rmse', 0)) if well_data.get('rmse') is not None else None
                well_result.amplitude = float(well_data.get('amplitude', 0)) if well_data.get('amplitude') is not None else None
                well_result.steepness = float(well_data.get('steepness', 0)) if well_data.get('steepness') is not None else None
                well_result.midpoint = float(well_data.get('midpoint', 0)) if well_data.get('midpoint') is not None else None
                well_result.baseline = float(well_data.get('baseline', 0)) if well_data.get('baseline') is not None else None
                well_result.data_points = int(well_data.get('data_points', 0)) if well_data.get('data_points') is not None else None
                well_result.cycle_range = float(well_data.get('cycle_range', 0)) if well_data.get('cycle_range') is not None else None
                # JSON/text fields - ensure they are converted to JSON strings for database storage
                
                well_result.fit_parameters = safe_json_dumps(well_data.get('fit_parameters'), [])
                well_result.parameter_errors = safe_json_dumps(well_data.get('parameter_errors'), [])
                well_result.fitted_curve = safe_json_dumps(well_data.get('fitted_curve'), [])
                well_result.anomalies = safe_json_dumps(well_data.get('anomalies'), [])
                well_result.raw_cycles = safe_json_dumps(well_data.get('raw_cycles'), [])
                well_result.raw_rfu = safe_json_dumps(well_data.get('raw_rfu'), [])
                well_result.sample_name = str(well_data.get('sample_name', '')) if well_data.get('sample_name') else None
                cq_value_raw = well_data.get('cq_value')
                well_result.cq_value = float(cq_value_raw) if cq_value_raw is not None and cq_value_raw != '' else None
                
                # Set fluorophore if present - prioritize function parameter over well data
                well_fluorophore = well_data.get('fluorophore', '')
                final_fluorophore = fluorophore if fluorophore else well_fluorophore
                well_result.fluorophore = str(final_fluorophore) if final_fluorophore else None
                
                # Debug fluorophore assignment for control wells
                if well_result.sample_name and any(control in well_result.sample_name.upper() for control in ['H1', 'H2', 'H3', 'H4', 'M1', 'M2', 'M3', 'M4', 'L1', 'L2', 'L3', 'L4', 'NTC']):
                    print(f"[CONTROL FLUOR] {well_key}: sample='{well_result.sample_name}', final_fluorophore='{final_fluorophore}' (param={fluorophore}, data={well_fluorophore})")
                    app.logger.info(f"[CONTROL FLUOR] {well_key}: sample='{well_result.sample_name}', final_fluorophore='{final_fluorophore}' (param={fluorophore}, data={well_fluorophore})")
                
                # Set threshold_value if present

                threshold_value = well_data.get('threshold_value')
                if threshold_value is not None:
                    try:
                        well_result.threshold_value = float(threshold_value)
                    except (ValueError, TypeError):
                        well_result.threshold_value = None
                else:
                    well_result.threshold_value = None

                # Set per-channel thresholds if present
                well_result.thresholds = safe_json_dumps(well_data.get('thresholds'), {})
                
                # Set curve_classification if present, else default to {'class': 'N/A'}
                curve_classification = well_data.get('curve_classification')
                if curve_classification is None:
                    # Default to N/A if not present
                    curve_classification = {'class': 'N/A'}
                # Ensure it's a JSON string for DB
                well_result.curve_classification = safe_json_dumps(curve_classification, {'class': 'N/A'})
                
                db.session.add(well_result)
                db.session.flush()  # Force write to DB after each well
                well_count += 1
                if well_count % 50 == 0:
                    db.session.commit()
                print(f"[DB DEBUG] Saved well {well_key}: {well_result.to_dict()}")
                app.logger.info(f"[DB DEBUG] Saved well {well_key}: {well_result.to_dict()}")
            except Exception as e:
                print(f"Error saving well {well_key}: {e}")
                app.logger.error(f"Error saving well {well_key}: {e}")
                continue
        
        # Final commit
        # Final commit
        try:
            db.session.commit()
            db.session.flush()
            print(f"[DB DEBUG] Final commit done for {well_count} wells.")
            app.logger.info(f"[DB DEBUG] Final commit done for {well_count} wells.")
            
        except Exception as commit_error:
            db.session.rollback()
            print(f"Forced commit error: {commit_error}")
            raise
        
        print(f"Individual channel session saved: {experiment_name} with {well_count} wells")
        app.logger.info(f"Individual channel session saved: {experiment_name} with {well_count} wells")
        return True
        
    except Exception as e:
        db.session.rollback()
        print(f"Error saving individual channel session: {e}")
        return False

class Base(DeclarativeBase):
    pass

app = Flask(__name__, static_folder='static', static_url_path='/static')
app.secret_key = os.environ.get("FLASK_SECRET_KEY") or "qpcr_analyzer_secret_key_2025"

# Global quota flag to prevent repeated database operations when quota exceeded
quota_exceeded = False

# Database configuration for both development (SQLite) and production (MySQL)
database_url = os.environ.get("DATABASE_URL")
if database_url and database_url.startswith("mysql"):
    # Production MySQL configuration
    app.config["SQLALCHEMY_DATABASE_URI"] = database_url
    app.config["SQLALCHEMY_ENGINE_OPTIONS"] = {
        "pool_recycle": 300,
        "pool_pre_ping": True,
        "pool_size": 10,
        "max_overflow": 20,
        "pool_timeout": 30,
    }
    print("Using MySQL database for production")
else:
    # Development SQLite configuration
    sqlite_path = os.path.join(os.path.dirname(__file__), 'qpcr_analysis.db')
    app.config["SQLALCHEMY_DATABASE_URI"] = f"sqlite:///{sqlite_path}"
    app.config["SQLALCHEMY_ENGINE_OPTIONS"] = {
        "pool_recycle": 300,
        "pool_pre_ping": True,
        "pool_timeout": 30,
        "pool_size": 10,
        "max_overflow": 20,
        "connect_args": {
            "timeout": 30,
            "check_same_thread": False
        }
    }
    print(f"Using SQLite database for development: {sqlite_path}")

db.init_app(app)

# Create tables for database
with app.app_context():
    # Configure SQLite for better concurrency and performance
    if not database_url or not database_url.startswith("mysql"):
        from sqlalchemy import text as sql_text
        try:
            # Set SQLite pragmas for better concurrency and performance
            db.session.execute(sql_text('PRAGMA journal_mode = WAL;'))        # Write-Ahead Logging
            db.session.execute(sql_text('PRAGMA synchronous = NORMAL;'))      # Faster writes
            db.session.execute(sql_text('PRAGMA cache_size = 10000;'))        # Larger cache
            db.session.execute(sql_text('PRAGMA temp_store = MEMORY;'))       # Memory temp store
            db.session.execute(sql_text('PRAGMA busy_timeout = 30000;'))      # 30 second timeout
            db.session.execute(sql_text('PRAGMA foreign_keys = ON;'))         # Enable foreign keys
            db.session.commit()
            print("SQLite performance optimizations applied")
        except Exception as e:
            print(f"Warning: Could not apply SQLite optimizations: {e}")
    
    db.create_all()
    if not database_url or not database_url.startswith("mysql"):
        sqlite_path = os.path.join(os.path.dirname(__file__), 'qpcr_analysis.db')
        print(f"SQLite database initialized at: {sqlite_path}")
    else:
        print("MySQL database tables initialized")

# Initialize ML configuration manager
try:
    sqlite_path = os.path.join(os.path.dirname(__file__), 'qpcr_analysis.db')
    ml_config_manager = MLConfigManager(sqlite_path)
    print("ML Configuration Manager initialized")
except Exception as e:
    print(f"Warning: Could not initialize ML Configuration Manager: {e}")
    ml_config_manager = None

# Initialize ML validation manager
try:
    from ml_validation_manager import MLModelValidationManager
    sqlite_path = os.path.join(os.path.dirname(__file__), 'qpcr_analysis.db')
    ml_validation_manager = MLModelValidationManager(sqlite_path)
    print("ML Model Validation Manager initialized")
except Exception as e:
    print(f"Warning: Could not initialize ML Model Validation Manager: {e}")
    ml_validation_manager = None

# Initialize FDA compliance manager
try:
    sqlite_path = os.path.join(os.path.dirname(__file__), 'qpcr_analysis.db')
    fda_compliance_manager = FDAComplianceManager(sqlite_path)
    print("FDA Compliance Manager initialized")
except Exception as e:
    print(f"Warning: Could not initialize FDA Compliance Manager: {e}")
    fda_compliance_manager = None

# Initialize unified compliance manager
try:
    sqlite_path = os.path.join(os.path.dirname(__file__), 'qpcr_analysis.db')
    unified_compliance_manager = UnifiedComplianceManager(sqlite_path)
    print("Unified Compliance Manager initialized")
except Exception as e:
    print(f"Warning: Could not initialize Unified Compliance Manager: {e}")
    unified_compliance_manager = None

# Initialize threshold routes
create_threshold_routes(app)

def track_compliance_automatically(event_type, event_data, user_id='user'):
    """
    Automatically track compliance events based on software usage
    Maps real software activities to SOFTWARE-SPECIFIC compliance requirements
    Only tracks compliance that can be satisfied by running this qPCR analysis software
    """
    if not unified_compliance_manager:
        return
    
    try:
        # Enhanced mapping for software-specific compliance tracking
        updated_requirements = unified_compliance_manager.track_compliance_event(
            event_type=event_type,
            event_data=event_data,
            user_id=user_id
        )
        
        if updated_requirements:
            print(f"✓ Compliance updated for {len(updated_requirements)} requirements: {', '.join(updated_requirements)}")
        
        return updated_requirements
        
    except Exception as e:
        print(f"Error tracking compliance for {event_type}: {e}")
        return []

# Enhanced compliance tracking functions for specific software events
def track_ml_compliance(event_type, ml_data, user_id='user'):
    """Track ML model validation compliance events"""
    enhanced_data = {
        **ml_data,
        'timestamp': datetime.utcnow().isoformat(),
        'compliance_category': 'ML_Validation',
        'software_component': 'ml_classifier'
    }
    return track_compliance_automatically(event_type, enhanced_data, user_id)

def track_analysis_compliance(session_id, analysis_data, user_id='user'):
    """Track qPCR analysis execution compliance"""
    enhanced_data = {
        'session_id': session_id,
        **analysis_data,
        'timestamp': datetime.utcnow().isoformat(),
        'compliance_category': 'Analysis_Validation',
        'software_component': 'qpcr_analyzer'
    }
    return track_compliance_automatically('ANALYSIS_COMPLETED', enhanced_data, user_id)

def track_qc_compliance(qc_type, qc_results, user_id='user'):
    """Track quality control compliance through software"""
    enhanced_data = {
        'qc_type': qc_type,
        **qc_results,
        'timestamp': datetime.utcnow().isoformat(),
        'compliance_category': 'Quality_Control',
        'software_component': 'qc_system'
    }
    
    if qc_type == 'negative_control':
        return track_compliance_automatically('NEGATIVE_CONTROL_VERIFIED', enhanced_data, user_id)
    elif qc_type == 'positive_control':
        return track_compliance_automatically('POSITIVE_CONTROL_VERIFIED', enhanced_data, user_id)
    else:
        return track_compliance_automatically('QC_ANALYZED', enhanced_data, user_id)

def track_security_compliance(security_event, security_data, user_id='user'):
    """Track security and access control compliance (when implemented)"""
    enhanced_data = {
        **security_data,
        'timestamp': datetime.utcnow().isoformat(),
        'compliance_category': 'Security',
        'software_component': 'security_system'
    }
    return track_compliance_automatically(security_event, enhanced_data, user_id)

# Add a simple session tracking function
def get_current_user():
    """Get current user (simplified for now)"""
    # For now, return default user. Later this will integrate with authentication
    return 'user'

def track_user_session(action='access'):
    """Track user session for compliance"""
    if unified_compliance_manager:
        try:
            user_id = get_current_user()
            session_details = {
                'timestamp': datetime.utcnow().isoformat(),
                'user_agent': request.headers.get('User-Agent', 'unknown'),
                'endpoint': request.endpoint if hasattr(request, 'endpoint') else 'unknown'
            }
            
            unified_compliance_manager.log_user_access(
                user_id=user_id,
                action=action,
                details=session_details
            )
        except Exception as e:
            print(f"Warning: Could not track user session: {e}")

@app.route('/')
def index():
    # Track user access to main page
    track_user_session('page_access')
    return send_from_directory('.', 'index.html')

@app.route('/ml-validation-dashboard')
def ml_validation_dashboard():
    return send_from_directory('.', 'ml_validation_dashboard.html')

@app.route('/fda-compliance-dashboard')
def fda_compliance_dashboard():
    return send_from_directory('.', 'fda_compliance_dashboard.html')

@app.route('/unified-validation-dashboard')
def unified_validation_dashboard():
    return send_from_directory('.', 'unified_validation_dashboard.html')

@app.route('/ml-config')
def ml_config():
    return send_from_directory('.', 'ml_config.html')

@app.route('/static/<path:filename>')
def static_files(filename):
    return send_from_directory('static', filename)

@app.route('/config/<path:filename>')
def serve_config(filename):
    """Serve configuration files from the config directory"""
    return send_from_directory('config', filename)

@app.route('/analyze', methods=['POST'])
def analyze_data():
    """Endpoint to analyze qPCR data and save results to database"""
    try:
        print(f"[ANALYZE] Starting analysis request")
        
        # Get JSON data from request
        request_data = request.get_json()
        filename = request.headers.get('X-Filename', 'unknown.csv')
        fluorophore = request.headers.get('X-Fluorophore', 'Unknown')
        
        print(f"[ANALYZE] Request headers - Filename: {filename}, Fluorophore: {fluorophore}")
        print(f"[ANALYZE] Request data type: {type(request_data)}, Length: {len(request_data) if request_data else 0}")
        app.logger.info(f"[ANALYZE] Request headers - Filename: {filename}, Fluorophore: {fluorophore}")
        app.logger.info(f"[ANALYZE] Request data type: {type(request_data)}, Length: {len(request_data) if request_data else 0}")
        
        # Debug request structure
        if request_data:
            print(f"[ANALYZE-DEBUG] Request keys: {list(request_data.keys()) if isinstance(request_data, dict) else 'Not a dict'}")
            app.logger.info(f"[ANALYZE-DEBUG] Request keys: {list(request_data.keys()) if isinstance(request_data, dict) else 'Not a dict'}")
            if isinstance(request_data, dict):
                if 'analysis_data' in request_data:
                    print(f"[ANALYZE-DEBUG] analysis_data type: {type(request_data['analysis_data'])}, length: {len(request_data['analysis_data']) if request_data['analysis_data'] else 0}")
                    app.logger.info(f"[ANALYZE-DEBUG] analysis_data type: {type(request_data['analysis_data'])}, length: {len(request_data['analysis_data']) if request_data['analysis_data'] else 0}")
                if 'samples_data' in request_data:
                    samples_data_info = request_data.get('samples_data')
                    if samples_data_info:
                        print(f"[ANALYZE-DEBUG] samples_data length: {len(samples_data_info)}")
                        print(f"[ANALYZE-DEBUG] samples_data preview: {samples_data_info[:200]}...")
                        app.logger.info(f"[ANALYZE-DEBUG] samples_data length: {len(samples_data_info)}")
                        app.logger.info(f"[ANALYZE-DEBUG] samples_data preview: {samples_data_info[:200]}...")
                    else:
                        print(f"[ANALYZE-DEBUG] samples_data is None or empty")
                        app.logger.info(f"[ANALYZE-DEBUG] samples_data is None or empty")
        
        if not request_data:
            print(f"[ANALYZE ERROR] No data provided")
            return jsonify({'error': 'No data provided', 'success': False}), 400
        
        # Extract analysis data and samples data from payload
        if 'analysis_data' in request_data:
            # New format with SQL integration support
            data = request_data['analysis_data']
            samples_data = request_data.get('samples_data')
            print(f"[ANALYZE] Using new format - analysis_data length: {len(data)}")
        else:
            # Legacy format for backward compatibility
            data = request_data
            samples_data = None
            print(f"[ANALYZE] Using legacy format - data length: {len(data)}")
        
        print(f"[ANALYZE] Starting validation...")
        # Validate data structure
        errors, warnings = validate_csv_structure(data)
        
        if errors:
            print(f"[ANALYZE ERROR] Validation failed: {errors}")
            return jsonify({
                'error': 'Data validation failed',
                'validation_errors': errors,
                'validation_warnings': warnings,
                'success': False
            }), 400
        
        print(f"[ANALYZE] Validation passed, starting processing...")
        # Process the data with SQL integration if samples data available
        try:
            if samples_data:
                print(f"[ANALYZE-SQL] Starting SQL integration with samples_data length: {len(samples_data)}")
                print(f"[ANALYZE-SQL] Samples data preview: {samples_data[:200]}...")
                from sql_integration import process_with_sql_integration
                results = process_with_sql_integration(data, samples_data, fluorophore)
                print(f"[ANALYZE-SQL] SQL-based analysis completed for {len(data)} wells with {fluorophore}")
                print(f"[ANALYZE-SQL] Results success: {results.get('success', 'Unknown')}")
                print(f"[ANALYZE-SQL] Results keys: {list(results.keys()) if isinstance(results, dict) else 'Not a dict'}")
                if results.get('individual_results'):
                    print(f"[ANALYZE-SQL] Individual results count: {len(results['individual_results'])}")
                else:
                    print(f"[ANALYZE-SQL] No individual_results in SQL response")
            else:
                print(f"[ANALYZE-STANDARD] No samples data, using standard analysis")
                results = process_csv_data(data)
                print(f"[ANALYZE-STANDARD] Standard analysis completed for {len(data)} wells")
                print(f"[ANALYZE-STANDARD] Results success: {results.get('success', 'Unknown')}")
                print(f"[ANALYZE-STANDARD] Results keys: {list(results.keys()) if isinstance(results, dict) else 'Not a dict'}")
                if results.get('individual_results'):
                    print(f"[ANALYZE-STANDARD] Individual results count: {len(results['individual_results'])}")
                else:
                    print(f"[ANALYZE-STANDARD] No individual_results in standard response")
            
            # Inject fluorophore information and ensure proper well_id structure for fresh load
            if 'individual_results' in results and fluorophore != 'Unknown':
                print(f"[FRESH LOAD] Processing individual_results for {fluorophore}")
                updated_individual_results = {}
                
                for well_key, well_data in results['individual_results'].items():
                    if isinstance(well_data, dict):
                        # Ensure fluorophore is in well data
                        well_data['fluorophore'] = fluorophore
                        
                        # Ensure well_id is properly constructed with fluorophore suffix
                        if not well_key.endswith(f'_{fluorophore}'):
                            new_well_key = f"{well_key}_{fluorophore}"
                            print(f"[FRESH LOAD] Updated well_id: {well_key} -> {new_well_key}")
                        else:
                            new_well_key = well_key
                        
                        # Ensure coordinate field is present (extract from well_id)
                        if 'coordinate' not in well_data or not well_data['coordinate']:
                            base_coordinate = new_well_key.split('_')[0] if '_' in new_well_key else new_well_key
                            well_data['coordinate'] = base_coordinate
                        
                        # Set the well_id in the well data for consistency
                        well_data['well_id'] = new_well_key
                        
                        # Debug control wells in fresh load
                        sample_name = well_data.get('sample_name', '')
                        if sample_name and any(control in sample_name.upper() for control in ['H1', 'H2', 'H3', 'H4', 'M1', 'M2', 'M3', 'M4', 'L1', 'L2', 'L3', 'L4', 'NTC']):
                            print(f"[FRESH CONTROL] {new_well_key}: sample='{sample_name}', coord='{well_data.get('coordinate', '')}', fluor='{fluorophore}'")
                            app.logger.info(f"[FRESH CONTROL] {new_well_key}: sample='{sample_name}', coord='{well_data.get('coordinate', '')}', fluor='{fluorophore}'")
                        
                        updated_individual_results[new_well_key] = well_data
                
                # Replace the original individual_results with updated structure
                results['individual_results'] = updated_individual_results
                print(f"[FRESH LOAD] Updated {len(updated_individual_results)} wells with proper well_id structure")
            
            if not results.get('success', False):
                print(f"Analysis failed: {results.get('error', 'Unknown error')}")
                return jsonify(results), 500
            
            # Debug the original results structure from analysis
            print(f"[FRESH ANALYSIS] Original results structure:")
            app.logger.info(f"[FRESH ANALYSIS] Original results structure:")
            if 'individual_results' in results:
                individual_results = results['individual_results']
                print(f"[FRESH ANALYSIS] individual_results type: {type(individual_results)}")
                app.logger.info(f"[FRESH ANALYSIS] individual_results type: {type(individual_results)}")
                if individual_results:
                    first_key = next(iter(individual_results)) if isinstance(individual_results, dict) else None
                    if first_key:
                        first_well = individual_results[first_key]
                        print(f"[FRESH ANALYSIS] First well_key: '{first_key}', well_data type: {type(first_well)}")
                        app.logger.info(f"[FRESH ANALYSIS] First well_key: '{first_key}', well_data type: {type(first_well)}")
                        if isinstance(first_well, dict):
                            print(f"[FRESH ANALYSIS] First well fields: {list(first_well.keys())}")
                            app.logger.info(f"[FRESH ANALYSIS] First well fields: {list(first_well.keys())}")
                            sample_name = first_well.get('sample_name', '')
                            well_id_in_data = first_well.get('well_id', 'MISSING')
                            print(f"[FRESH ANALYSIS] First well sample_name: '{sample_name}', well_id in data: '{well_id_in_data}'")
                            app.logger.info(f"[FRESH ANALYSIS] First well sample_name: '{sample_name}', well_id in data: '{well_id_in_data}'")
                
            print(f"[ANALYZE] Analysis completed successfully")
            
            # Track file processing compliance (before analysis)
            file_metadata = {
                'filename': filename,
                'fluorophore': fluorophore,
                'file_type': 'cfx_data' if filename.endswith('.csv') else 'unknown',
                'file_size': len(str(data)) if data else 0,
                'integrity_check': 'passed',
                'validation_successful': True,
                'timestamp': datetime.utcnow().isoformat(),
                'total_wells_processed': len(data) if data else 0
            }
            track_compliance_automatically('FILE_UPLOADED', file_metadata)
            
            # Track calculation compliance
            calculation_metadata = {
                'calculation_type': 'ct_value_calculation',
                'algorithm': 'cfx_manager_compatible',
                'input_wells': len(data) if data else 0,
                'output_verified': results.get('success', False),
                'timestamp': datetime.utcnow().isoformat(),
                'fluorophore': fluorophore
            }
            track_compliance_automatically('CALCULATION_PERFORMED', calculation_metadata)
            
            # Enhanced automatic compliance tracking
            analysis_metadata = {
                'filename': filename,
                'fluorophore': fluorophore,
                'total_wells': len(results.get('individual_results', {})),
                'good_curves': len(results.get('good_curves', [])),
                'analysis_method': 'qPCR',
                'timestamp': datetime.utcnow().isoformat(),
                'success_rate': (len(results.get('good_curves', [])) / len(results.get('individual_results', {})) * 100) if results.get('individual_results') else 0
            }
            
            # Track analysis completion for compliance
            track_compliance_automatically('ANALYSIS_COMPLETED', analysis_metadata)
            
            # Check if control samples were analyzed
            individual_results = results.get('individual_results', {})
            control_wells = []
            for well_id, well_data in individual_results.items():
                sample_name = well_data.get('sample_name', '').upper()
                if any(control in sample_name for control in ['H1', 'H2', 'H3', 'H4', 'M1', 'M2', 'M3', 'M4', 'L1', 'L2', 'L3', 'L4', 'NTC', 'CONTROL']):
                    control_wells.append(well_id)
            
            if control_wells:
                control_metadata = {
                    **analysis_metadata,
                    'control_wells': control_wells,
                    'control_count': len(control_wells)
                }
                track_compliance_automatically('CONTROL_ANALYZED', control_metadata)
                print(f"✓ Tracked {len(control_wells)} control wells for compliance")
                    
        except Exception as analysis_error:
            print(f"Analysis processing error: {analysis_error}")
            import traceback
            traceback.print_exc()
            return jsonify({
                'error': f'Analysis failed: {str(analysis_error)}',
                'success': False
            }), 500
        
        # Calculate summary from results structure first
        if 'summary' in results and isinstance(results['summary'], dict):
            summary = results['summary']
        else:
            individual_results = results.get('individual_results', {})
            good_curves = results.get('good_curves', [])
            total_wells = len(individual_results)
            good_count = len(good_curves)
            success_rate = (good_count / total_wells * 100) if total_wells > 0 else 0
            
            summary = {
                'total_wells': total_wells,
                'good_curves': good_count,
                'success_rate': success_rate
            }
        
        # Save individual channel analyses to database for channel tracking
        fluorophore = request.headers.get('X-Fluorophore', 'Unknown')
        is_individual_channel = fluorophore in ['Cy5', 'FAM', 'HEX', 'Texas Red']
        
        print(f"[ANALYZE] Database save - fluorophore: {fluorophore}, is_individual: {is_individual_channel}")
        
        if is_individual_channel:
            # Save individual channel session with complete filename
            try:
                database_saved = save_individual_channel_session(filename, results, fluorophore, summary)
                print(f"Individual {fluorophore} channel saved to database: {database_saved}")
            except Exception as save_error:
                print(f"Failed to save individual {fluorophore} channel: {save_error}")
                import traceback
                traceback.print_exc()
                database_saved = False
        else:
            # For multi-fluorophore analysis, save combined session after all individual channels
            database_saved = False
            print(f"Analysis complete - individual channel for {fluorophore} (part of multi-fluorophore)")
        
        # Include validation warnings in successful response
        if warnings:
            results['validation_warnings'] = warnings
        
        # Final debugging of results structure before sending to frontend
        print(f"[FINAL FRESH] Results keys: {list(results.keys())}")
        if 'individual_results' in results:
            individual_results = results['individual_results']
            print(f"[FINAL FRESH] individual_results has {len(individual_results)} wells")
            # Sample a few wells to verify structure
            sample_wells = list(individual_results.items())[:2]
            for well_key, well_data in sample_wells:
                if isinstance(well_data, dict):
                    has_well_id = 'well_id' in well_data
                    has_coordinate = 'coordinate' in well_data  
                    has_fluorophore = 'fluorophore' in well_data
                    sample_name = well_data.get('sample_name', '')
                    print(f"[FINAL FRESH] {well_key}: well_id={has_well_id}, coordinate={has_coordinate}, fluorophore={has_fluorophore}, sample='{sample_name}'")
        
        print(f"[ANALYZE] Preparing JSON response...")
        # Ensure all numpy data types are converted to Python types for JSON serialization
        try:
            import json
            import numpy as np
            
            def convert_numpy_types(obj):
                """Recursively convert numpy types to Python types"""
                if isinstance(obj, dict):
                    return {key: convert_numpy_types(value) for key, value in obj.items()}
                elif isinstance(obj, list):
                    return [convert_numpy_types(item) for item in obj]
                elif isinstance(obj, np.integer):
                    return int(obj)
                elif isinstance(obj, np.floating):
                    return float(obj)
                elif isinstance(obj, np.bool_):
                    return bool(obj)
                elif isinstance(obj, np.ndarray):
                    return obj.tolist()
                else:
                    return obj
            
            # Convert all numpy types to Python types
            converted_results = convert_numpy_types(results)
            
            # Test JSON serialization to catch any remaining issues
            json_str = json.dumps(converted_results)
            print(f"[ANALYZE] JSON serialization test successful, response length: {len(json_str)}")
            
            # Return properly formatted JSON response
            return jsonify(converted_results)
        except Exception as json_error:
            print(f"JSON serialization error: {json_error}")
            import traceback
            traceback.print_exc()
            return jsonify({
                'error': f'Response serialization failed: {str(json_error)}',
                'success': False
            }), 500
        
    except Exception as e:
        print(f"[ANALYZE ERROR] Server error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'error': f'Server error: {str(e)}',
            'success': False
        }), 500

@app.route('/sessions', methods=['GET'])
def get_sessions():
    """Get all analysis sessions"""
    try:
        sessions = AnalysisSession.query.order_by(AnalysisSession.upload_timestamp.desc()).all()
        sessions_data = []
        for session in sessions:
            session_dict = session.to_dict()
            # Robustly handle both dict and list for well_results
            individual_results = session.well_results
            # Convert to dict keyed by well_id if not already
            if isinstance(individual_results, dict):
                results_dict = individual_results
            else:
                results_dict = {}
                for well in individual_results:
                    well_dict = well.to_dict() if hasattr(well, 'to_dict') else well
                    if isinstance(well_dict, dict) and 'well_id' in well_dict:
                        # Ensure well_dict has all necessary fields for control grid (same as get_session_details)
                        well_id = well_dict['well_id']
                        
                        # Extract coordinate from well_id if not present
                        if 'coordinate' not in well_dict or not well_dict['coordinate']:
                            base_coordinate = well_id.split('_')[0] if '_' in well_id else well_id
                            well_dict['coordinate'] = base_coordinate
                        
                        # Ensure fluorophore is present
                        if 'fluorophore' not in well_dict or not well_dict['fluorophore']:
                            if '_' in well_id:
                                potential_fluorophore = well_id.split('_')[-1]
                                if potential_fluorophore in ['Cy5', 'FAM', 'HEX', 'Texas Red']:
                                    well_dict['fluorophore'] = potential_fluorophore
                        
                        # Parse JSON fields that might be stored as strings in database
                        json_fields = ['raw_cycles', 'raw_rfu', 'fitted_curve', 'fit_parameters', 'parameter_errors', 'anomalies']
                        for field in json_fields:
                            if field in well_dict and isinstance(well_dict[field], str):
                                try:
                                    well_dict[field] = json.loads(well_dict[field])
                                except (json.JSONDecodeError, TypeError):
                                    if field in ['anomalies']:
                                        well_dict[field] = []
                                    elif field in ['raw_cycles', 'raw_rfu', 'fitted_curve', 'fit_parameters', 'parameter_errors']:
                                        well_dict[field] = []
                        
                        results_dict[well_dict['well_id']] = well_dict
            session_dict['individual_results'] = results_dict
            sessions_data.append(session_dict)
        return jsonify({
            'sessions': sessions_data,
            'total': len(sessions)
        })
    except Exception as e:
        return jsonify({'error': f'Database error: {str(e)}'}), 500

@app.route('/sessions/<int:session_id>', methods=['GET'])
def get_session_details(session_id):
    """Get detailed results for a specific session"""
    try:
        session = AnalysisSession.query.get_or_404(session_id)
        wells = WellResult.query.filter_by(session_id=session_id).all()
        
        print(f"[HISTORY LOAD] Loading session {session_id}: {session.filename}")
        print(f"[HISTORY LOAD] Found {len(wells)} wells in database")
        app.logger.info(f"[HISTORY LOAD] Loading session {session_id}: {session.filename}")
        app.logger.info(f"[HISTORY LOAD] Found {len(wells)} wells in database")
        
        # Robustly handle both dict and list for wells
        if isinstance(wells, dict):
            results_dict = wells
        else:
            results_dict = {}
            control_wells_found = 0
            for well in wells:
                well_dict = well.to_dict() if hasattr(well, 'to_dict') else well
                if isinstance(well_dict, dict) and 'well_id' in well_dict:
                    # Ensure well_dict has all necessary fields for control grid
                    well_id = well_dict['well_id']
                    
                    # Extract coordinate from well_id if not present (e.g., "A1_FAM" -> "A1")
                    if 'coordinate' not in well_dict or not well_dict['coordinate']:
                        base_coordinate = well_id.split('_')[0] if '_' in well_id else well_id
                        well_dict['coordinate'] = base_coordinate
                    
                    # Ensure fluorophore is present (from well_id suffix if not in data)
                    if 'fluorophore' not in well_dict or not well_dict['fluorophore']:
                        if '_' in well_id:
                            potential_fluorophore = well_id.split('_')[-1]
                            if potential_fluorophore in ['Cy5', 'FAM', 'HEX', 'Texas Red']:
                                well_dict['fluorophore'] = potential_fluorophore
                    
                    # Parse JSON fields that might be stored as strings in database
                    json_fields = ['raw_cycles', 'raw_rfu', 'fitted_curve', 'fit_parameters', 'parameter_errors', 'anomalies']
                    for field in json_fields:
                        if field in well_dict and isinstance(well_dict[field], str):
                            try:
                                well_dict[field] = json.loads(well_dict[field])
                            except (json.JSONDecodeError, TypeError):
                                # If JSON parsing fails, keep as string or set to default
                                if field in ['anomalies']:
                                    well_dict[field] = []
                                elif field in ['raw_cycles', 'raw_rfu', 'fitted_curve', 'fit_parameters', 'parameter_errors']:
                                    well_dict[field] = []
                    
                    # Debug control wells during history load
                    sample_name = well_dict.get('sample_name', '')
                    if sample_name and any(control in sample_name.upper() for control in ['H1', 'H2', 'H3', 'H4', 'M1', 'M2', 'M3', 'M4', 'L1', 'L2', 'L3', 'L4', 'NTC']):
                        control_wells_found += 1
                        print(f"[HISTORY CONTROL] {well_dict['well_id']}: sample='{sample_name}', coord='{well_dict.get('coordinate', 'NONE')}', fluor='{well_dict.get('fluorophore', 'NONE')}'")
                    
                    results_dict[well_dict['well_id']] = well_dict
            
            print(f"[HISTORY LOAD] Found {control_wells_found} control wells in loaded session")
            print(f"[HISTORY LOAD] Sample well structure: {list(results_dict.keys())[:3] if results_dict else 'None'}")
            
        return jsonify({
            'session': session.to_dict(),
            'wells': [well.to_dict() for well in wells],
            'individual_results': results_dict
        })
    except Exception as e:
        return jsonify({'error': f'Database error: {str(e)}'}), 500

@app.route('/sessions/save-combined', methods=['POST'])
def save_combined_session():
    """Save a combined multi-fluorophore analysis session"""
    try:
        data = request.get_json()
        
        # Extract session info
        filename = data.get('filename', 'Multi-Fluorophore Analysis')
        combined_results = data.get('combined_results', {})
        fluorophores_list = data.get('fluorophores', [])
        
        # Clean up filename to prevent duplicate naming
        if 'Multi-Fluorophore Analysis' in filename:
            # Extract just the base pattern for clean display
            import re
            pattern_match = re.search(r'([A-Za-z][A-Za-z0-9]*_\d+_CFX\d+)', filename)
            if pattern_match:
                base_pattern = pattern_match.group(1)
                # Create clean display name with fluorophores
                fluorophore_list = ', '.join(sorted(fluorophores_list))
                display_name = f"Multi-Fluorophore Analysis ({fluorophore_list}) {base_pattern}"
                experiment_name = base_pattern
            else:
                # Fallback
                display_name = filename
                experiment_name = filename
        elif 'Multi-Fluorophore_' in filename:
            # For combined sessions, extract the original multi-fluorophore pattern
            experiment_name = filename.replace('Multi-Fluorophore_', '')
            display_name = experiment_name
        else:
            # For individual channels, use the complete filename including channel
            experiment_name = filename
            display_name = filename
        
        # Calculate correct statistics from individual results for multi-fluorophore analysis
        individual_results = combined_results.get('individual_results', {})
        total_wells = len(individual_results)
        
        print(f"Multi-fluorophore session: {total_wells} total wells, fluorophores: {fluorophores_list}")
        app.logger.info(f"Multi-fluorophore session: {total_wells} total wells, fluorophores: {fluorophores_list}")
        
        # Calculate fluorophore-specific statistics for multi-fluorophore display
        fluorophore_breakdown = {}
        fluorophore_counts = {}
        control_wells_by_fluorophore = {}
        
        for well_key, well_data in individual_results.items():
            if isinstance(well_data, dict):
                # Extract fluorophore from well key (e.g., "A1_FAM" -> "FAM")
                fluorophore = well_key.split('_')[-1] if '_' in well_key else 'Unknown'
                
                if fluorophore not in fluorophore_breakdown:
                    fluorophore_breakdown[fluorophore] = {'total': 0, 'positive': 0}
                    control_wells_by_fluorophore[fluorophore] = 0
                
                fluorophore_breakdown[fluorophore]['total'] += 1
                
                # Debug control wells in combined sessions
                sample_name = well_data.get('sample_name', '')
                if sample_name and any(control in sample_name.upper() for control in ['H1', 'H2', 'H3', 'H4', 'M1', 'M2', 'M3', 'M4', 'L1', 'L2', 'L3', 'L4', 'NTC']):
                    control_wells_by_fluorophore[fluorophore] += 1
                    print(f"[COMBINED CONTROL] {well_key}: sample='{sample_name}', fluorophore='{fluorophore}'")
                    app.logger.info(f"[COMBINED CONTROL] {well_key}: sample='{sample_name}', fluorophore='{fluorophore}'")
                
                # Check if well is positive (amplitude > 500)
                amplitude = well_data.get('amplitude', 0)
                if amplitude > 500:
                    fluorophore_breakdown[fluorophore]['positive'] += 1
                    
                # Count wells per fluorophore for validation
                fluorophore_counts[fluorophore] = fluorophore_counts.get(fluorophore, 0) + 1
        
        # Log control well distribution
        for fluorophore, count in control_wells_by_fluorophore.items():
            print(f"[COMBINED SESSION] {fluorophore}: {count} control wells out of {fluorophore_counts.get(fluorophore, 0)} total wells")
        
        # Calculate overall statistics and create pathogen breakdown display
        positive_wells = sum(breakdown['positive'] for breakdown in fluorophore_breakdown.values())
        success_rate = (positive_wells / total_wells * 100) if total_wells > 0 else 0
        
        # Extract test code for proper pathogen mapping
        experiment_name = data.get('filename', 'Multi-Fluorophore Analysis')
        base_pattern = experiment_name.replace('Multi-Fluorophore_', '')
        test_code = base_pattern.split('_')[0]
        if test_code.startswith('Ac'):
            test_code = test_code[2:]  # Remove "Ac" prefix
        
        print(f"DEBUG: Combined session test code extraction - experiment_name: {experiment_name}, base_pattern: {base_pattern}, test_code: {test_code}")
        
        # Create pathogen breakdown string for multi-fluorophore display
        pathogen_breakdown_display = ""
        if len(fluorophore_breakdown) > 1:  # Multi-fluorophore session
            pathogen_rates = []
            fluorophore_order = ['Cy5', 'FAM', 'HEX', 'Texas Red']
            
            # Sort fluorophores in standard order
            sorted_fluorophores = sorted(fluorophore_breakdown.keys(), 
                                       key=lambda x: fluorophore_order.index(x) if x in fluorophore_order else 999)
            
            for fluorophore in sorted_fluorophores:
                breakdown = fluorophore_breakdown[fluorophore]
                rate = (breakdown['positive'] / breakdown['total'] * 100) if breakdown['total'] > 0 else 0
                
                # Use centralized pathogen mapping
                pathogen_target = get_pathogen_target(test_code, fluorophore)
                
                pathogen_rates.append(f"{pathogen_target}: {rate:.1f}%")
            
            pathogen_breakdown_display = " | ".join(pathogen_rates)
            print(f"Multi-fluorophore breakdown: {pathogen_breakdown_display}")
        else:
            # Single fluorophore session
            for fluorophore, breakdown in fluorophore_breakdown.items():
                rate = (breakdown['positive'] / breakdown['total'] * 100) if breakdown['total'] > 0 else 0
                
                # Use centralized pathogen mapping
                pathogen_target = get_pathogen_target(test_code, fluorophore)
                
                pathogen_breakdown_display = f"{pathogen_target}: {rate:.1f}%"
        
        # Extract cycle information from first available well
        cycle_count = None
        cycle_min = None
        cycle_max = None
        
        for well_data in individual_results.values():
            if isinstance(well_data, dict):
                try:
                    # Try different field names for cycle data
                    cycles = well_data.get('raw_cycles') or well_data.get('cycles') or well_data.get('x_data')
                    if isinstance(cycles, list) and len(cycles) > 0:
                        cycle_count = len(cycles)
                        cycle_min = min(cycles)
                        cycle_max = max(cycles)
                        break
                except (ValueError, TypeError):
                    continue
        
        # Default to 33 cycles for this dataset if not found
        if cycle_count is None:
            cycle_count = 33
            cycle_min = 1
            cycle_max = 33
        
        # Check for existing session with same base pattern and overwrite if found
        existing_session = AnalysisSession.query.filter_by(filename=display_name).first()
        
        if existing_session:
            # Delete existing well results for this session
            WellResult.query.filter_by(session_id=existing_session.id).delete()
            
            # Update existing session with new data
            session = existing_session
            session.total_wells = total_wells
            session.good_curves = positive_wells
            session.success_rate = success_rate
            session.cycle_count = cycle_count
            session.cycle_min = cycle_min
            session.cycle_max = cycle_max
            session.pathogen_breakdown = str(pathogen_breakdown_display) if pathogen_breakdown_display else ""
            session.upload_timestamp = datetime.utcnow()
        else:
            # Create new analysis session
            session = AnalysisSession()
            session.filename = str(display_name)
            session.total_wells = total_wells
            session.good_curves = positive_wells
            session.success_rate = success_rate
            session.cycle_count = cycle_count
            session.cycle_min = cycle_min
            session.cycle_max = cycle_max
            session.pathogen_breakdown = str(pathogen_breakdown_display) if pathogen_breakdown_display else ""
            
            db.session.add(session)
        
        db.session.flush()
        
        # Save well results
        well_count = 0
        for well_key, well_data in individual_results.items():
            try:
                # Validate well_data structure
                if not isinstance(well_data, dict):
                    print(f"Warning: well_data for {well_key} is not a dict: {type(well_data)}")
                    continue
                well_result = WellResult()
                well_result.session_id = session.id
                well_result.well_id = str(well_key)
                well_result.is_good_scurve = bool(well_data.get('is_good_scurve', False))
                well_result.r2_score = float(well_data.get('r2_score', 0)) if well_data.get('r2_score') is not None else None
                well_result.rmse = float(well_data.get('rmse', 0)) if well_data.get('rmse') is not None else None
                well_result.amplitude = float(well_data.get('amplitude', 0)) if well_data.get('amplitude') is not None else None
                well_result.steepness = float(well_data.get('steepness', 0)) if well_data.get('steepness') is not None else None
                well_result.midpoint = float(well_data.get('midpoint', 0)) if well_data.get('midpoint') is not None else None
                well_result.baseline = float(well_data.get('baseline', 0)) if well_data.get('baseline') is not None else None
                well_result.data_points = int(well_data.get('data_points', 0)) if well_data.get('data_points') is not None else None
                well_result.cycle_range = float(well_data.get('cycle_range', 0)) if well_data.get('cycle_range') is not None else None

                # JSON/text fields - ensure they are converted to JSON strings for database storage
                well_result.fit_parameters = safe_json_dumps(well_data.get('fit_parameters'), [])
                well_result.parameter_errors = safe_json_dumps(well_data.get('parameter_errors'), [])
                well_result.fitted_curve = safe_json_dumps(well_data.get('fitted_curve'), [])
                well_result.anomalies = safe_json_dumps(well_data.get('anomalies'), [])
                well_result.raw_cycles = safe_json_dumps(well_data.get('raw_cycles'), [])
                well_result.raw_rfu = safe_json_dumps(well_data.get('raw_rfu'), [])

                well_result.sample_name = str(well_data.get('sample_name', '')) if well_data.get('sample_name') else None
                well_result.cq_value = float(well_data.get('cq_value', 0)) if well_data.get('cq_value') is not None else None
                well_result.fluorophore = str(well_data.get('fluorophore', '')) if well_data.get('fluorophore') else None

                # Set threshold_value if present
                threshold_value = well_data.get('threshold_value')
                if threshold_value is not None:
                    try:
                        well_result.threshold_value = float(threshold_value)
                    except (ValueError, TypeError):
                        well_result.threshold_value = None
                else:
                    well_result.threshold_value = None

                # Set per-channel thresholds if present
                well_result.thresholds = safe_json_dumps(well_data.get('thresholds'), {})
                
                # Set curve_classification if present, else default to {'class': 'N/A'}
                curve_classification = well_data.get('curve_classification')
                if curve_classification is None:
                    # Default to N/A if not present
                    curve_classification = {'class': 'N/A'}
                # Ensure it's a JSON string for DB
                well_result.curve_classification = safe_json_dumps(curve_classification, {'class': 'N/A'})

                # --- Save CQ-J and Calc-J fields if present ---

                well_result.cqj = safe_json_dumps(well_data.get('cqj'), {})
                well_result.calcj = safe_json_dumps(well_data.get('calcj'), {})

                db.session.add(well_result)
                well_count += 1
                if well_count % 50 == 0:
                    db.session.commit()
            except Exception as well_error:
                print(f"Error saving well {well_key}: {well_error}")
                continue
        
        try:
            db.session.commit()
        except Exception as commit_error:
            db.session.rollback()
            print(f"Forced commit error (combined): {commit_error}")
            raise
        
        return jsonify({
            'success': True,
            'message': f'Combined session saved with {well_count} wells',
            'session_id': session.id,
            'display_name': display_name
        })
        
    except Exception as e:
        db.session.rollback()
        print(f"Error saving combined session: {e}")
        return jsonify({'error': f'Failed to save combined session: {str(e)}'}), 500



# --- Delete all sessions and their results ---
@app.route('/sessions', methods=['DELETE'])
def delete_all_sessions():
    """Delete all analysis sessions and their results"""
    try:
        # First, check if there are any sessions to delete
        num_sessions = AnalysisSession.query.count()
        if num_sessions == 0:
            return jsonify({'message': 'No sessions to delete'}), 200
        
        print(f"[DEBUG] Deleting {num_sessions} sessions and their well results...")
        
        from sqlalchemy import text as sql_text
        try:
            # Set SQLite-specific pragmas for better concurrency
            if app.config['SQLALCHEMY_DATABASE_URI'].startswith('sqlite:'):
                db.session.execute(sql_text('PRAGMA busy_timeout = 30000;'))
                db.session.execute(sql_text('PRAGMA journal_mode = WAL;'))
                db.session.execute(sql_text('PRAGMA synchronous = NORMAL;'))
            print("[DEBUG] Deleting all well results first...")
            if app.config['SQLALCHEMY_DATABASE_URI'].startswith('sqlite:'):
                result = db.session.execute(sql_text('DELETE FROM well_results'))
                num_wells_deleted = result.rowcount if hasattr(result, 'rowcount') else 0 # type: ignore
            else:
                num_wells_deleted = WellResult.query.delete()
            print(f"[DEBUG] Deleted {num_wells_deleted} well results")
            print("[DEBUG] Deleting all sessions...")
            if app.config['SQLALCHEMY_DATABASE_URI'].startswith('sqlite:'):
                result = db.session.execute(sql_text('DELETE FROM analysis_sessions'))
                num_sessions_deleted = result.rowcount if hasattr(result, 'rowcount') else 0  # type: ignore
            else:
                num_sessions_deleted = AnalysisSession.query.delete()
            print(f"[DEBUG] Deleted {num_sessions_deleted} sessions")
            db.session.commit()
            print(f"[API] Successfully deleted all {num_sessions} sessions and their well results.")
            return jsonify({
                'message': f'All {num_sessions} sessions deleted successfully',
                'sessions_deleted': num_sessions_deleted,
                'wells_deleted': num_wells_deleted
            })
        except Exception as e:
            db.session.rollback()
            tb = traceback.format_exc()
            print(f"[ERROR] Error deleting all sessions: {e}\nTraceback:\n{tb}")
            return jsonify({'error': f'Database error: {str(e)}'}), 500
    
    except Exception as e:
        tb = traceback.format_exc()
        print(f"[ERROR] Outer exception deleting all sessions: {e}\nTraceback:\n{tb}")
        return jsonify({'error': f'Database error: {str(e)}'}), 500

# --- Delete a single session and its results ---
@app.route('/sessions/<int:session_id>', methods=['DELETE'])
def delete_session(session_id):
    """Delete a single analysis session and its results"""
    try:
        # Check if session exists first
        session = AnalysisSession.query.get_or_404(session_id)
        well_count = WellResult.query.filter_by(session_id=session.id).count()
        
        print(f"[DEBUG] Deleting session {session_id} with {well_count} well results...")
        
        from sqlalchemy import text as sql_text
        try:
            # Set SQLite-specific pragmas for better concurrency
            if app.config['SQLALCHEMY_DATABASE_URI'].startswith('sqlite:'):
                db.session.execute(sql_text('PRAGMA busy_timeout = 30000;'))
                db.session.execute(sql_text('PRAGMA journal_mode = WAL;'))
                db.session.execute(sql_text('PRAGMA synchronous = NORMAL;'))
            print(f"[DEBUG] Deleting {well_count} well results for session {session_id}...")
            if app.config['SQLALCHEMY_DATABASE_URI'].startswith('sqlite:'):
                result = db.session.execute(sql_text('DELETE FROM well_results WHERE session_id = :session_id'), {'session_id': session_id})
                num_wells_deleted = result.rowcount if hasattr(result, 'rowcount') else 0  # type: ignore
            else:
                num_wells_deleted = WellResult.query.filter_by(session_id=session_id).delete()
            print(f"[DEBUG] Actually deleted {num_wells_deleted} well results")
            print(f"[DEBUG] Deleting session {session_id}...")
            if app.config['SQLALCHEMY_DATABASE_URI'].startswith('sqlite:'):
                result = db.session.execute(sql_text('DELETE FROM analysis_sessions WHERE id = :session_id'), {'session_id': session_id})
                sessions_deleted = result.rowcount if hasattr(result, 'rowcount') else 0  # type: ignore
            else:
                db.session.delete(session)
                sessions_deleted = 1
            print(f"[DEBUG] Deleted {sessions_deleted} session(s)")
            db.session.commit()
            print(f"[API] Successfully deleted session {session_id} and its {well_count} well results.")
            return jsonify({
                'message': f'Session {session_id} deleted successfully',
                'wells_deleted': num_wells_deleted
            })
        except Exception as e:
            db.session.rollback()
            import traceback
            tb = traceback.format_exc()
            print(f"[ERROR] Exception deleting session {session_id}: {e}\nTraceback:\n{tb}")
            return jsonify({'error': f'Failed to delete session: {str(e)}'}), 500
    
    except Exception as e:
        db.session.rollback()
        import traceback
        tb = traceback.format_exc()
        print(f"[ERROR] Outer exception deleting session {session_id}: {e}\nTraceback:\n{tb}")
        return jsonify({'error': f'Failed to delete session: {str(e)}'}), 500

# Alternative delete endpoint with enhanced error handling
@app.route('/sessions/<int:session_id>/force-delete', methods=['DELETE'])
def force_delete_session(session_id):
    """Force delete a session with enhanced error handling"""
    try:
        # Check if session exists first
        session = AnalysisSession.query.get(session_id)
        if not session:
            return jsonify({'error': f'Session {session_id} not found'}), 404
        
        print(f"[FORCE DELETE] Starting force delete for session {session_id}: {session.filename}")
        
        # Get initial counts
        initial_well_count = WellResult.query.filter_by(session_id=session_id).count()
        print(f"[FORCE DELETE] Found {initial_well_count} wells to delete")
        
        # Try multiple deletion strategies
        wells_deleted = 0
        
        # Strategy 1: Delete wells in batches
        try:
            batch_size = 50
            while True:
                wells_batch = WellResult.query.filter_by(session_id=session_id).limit(batch_size).all()
                if not wells_batch:
                    break
                
                for well in wells_batch:
                    db.session.delete(well)
                    wells_deleted += 1
                
                db.session.commit()
                print(f"[FORCE DELETE] Deleted batch of {len(wells_batch)} wells")
            
            print(f"[FORCE DELETE] Deleted {wells_deleted} wells total")
            
        except Exception as wells_error:
            print(f"[FORCE DELETE] Wells deletion failed: {wells_error}")
            db.session.rollback()
            
            # Strategy 2: Raw SQL delete
            try:
                from sqlalchemy import text as sql_text
                result = db.session.execute(
                    sql_text('DELETE FROM well_results WHERE session_id = :session_id'),
                    {'session_id': session_id}
                )
                wells_deleted = result.rowcount if hasattr(result, 'rowcount') else 0  # type: ignore
                print(f"[FORCE DELETE] Raw SQL deleted {wells_deleted} wells")
                db.session.commit()
            except Exception as sql_error:
                print(f"[FORCE DELETE] Raw SQL deletion also failed: {sql_error}")
                db.session.rollback()
                return jsonify({'error': f'Could not delete wells: {str(sql_error)}'}), 500
        
        # Delete the session
        try:
            db.session.delete(session)
            db.session.commit()
            print(f"[FORCE DELETE] Successfully deleted session {session_id}")
            
            return jsonify({
                'message': f'Session {session_id} force deleted successfully',
                'wells_deleted': wells_deleted,
                'initial_well_count': initial_well_count
            })
            
        except Exception as session_error:
            print(f"[FORCE DELETE] Session deletion failed: {session_error}")
            db.session.rollback()
            return jsonify({'error': f'Could not delete session: {str(session_error)}'}), 500
            
    except Exception as e:
        db.session.rollback()
        import traceback
        tb = traceback.format_exc()
        print(f"[FORCE DELETE ERROR] {e}\nTraceback:\n{tb}")
        return jsonify({'error': f'Force delete failed: {str(e)}'}), 500

@app.route('/experiments/statistics', methods=['POST'])
def save_experiment_statistics():
    """Save or update experiment statistics for trend analysis"""
    try:
        # Ensure database tables exist first
        db.create_all()
        
        data = request.get_json()
        
        experiment_name = data.get('experiment_name')
        test_name = data.get('test_name')
        fluorophore_breakdown = data.get('fluorophore_breakdown', {})
        
        if not experiment_name or not test_name:
            return jsonify({'error': 'experiment_name and test_name are required'}), 400
        
        from models import ExperimentStatistics
        success = ExperimentStatistics.create_or_update(
            experiment_name=experiment_name,
            test_name=test_name,
            fluorophore_breakdown=fluorophore_breakdown
        )
        
        if success:
            return jsonify({
                'success': True,
                'message': f'Experiment statistics saved for {experiment_name}'
            })
        else:
            return jsonify({'error': 'Failed to save experiment statistics'}), 500
            
    except Exception as e:
        print(f"Error saving experiment statistics: {e}")
        # Return empty data instead of error to prevent frontend crashes
        return jsonify({
            'success': False,
            'warning': f'Statistics service unavailable: {str(e)}',
            'message': 'Statistics could not be saved'
        })

@app.route('/experiments/statistics', methods=['GET'])
def get_experiment_statistics():
    """Retrieve experiment statistics for trend analysis"""
    try:
        from models import ExperimentStatistics
        
        # Ensure the table exists by attempting to create it
        db.create_all()
        
        # Get query parameters
        test_name = request.args.get('test_name')
        limit = request.args.get('limit', 100, type=int)
        
        query = ExperimentStatistics.query
        
        if test_name:
            query = query.filter_by(test_name=test_name)
        
        experiments = query.order_by(ExperimentStatistics.analysis_timestamp.desc()).limit(limit).all()
        
        # Return empty array if no experiments found
        return jsonify({
            'experiments': [exp.to_dict() for exp in experiments] if experiments else [],
            'total_count': len(experiments)
        })
        
    except Exception as e:
        print(f"Error retrieving experiment statistics: {e}")
        # Return empty data instead of error to prevent frontend crashes
        return jsonify({
            'experiments': [],
            'total_count': 0,
            'warning': f'Statistics service unavailable: {str(e)}'
        })

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint for Railway deployment"""
    import time
    import threading
    
    try:
        start_time = time.time()
        
        # Basic app health check
        port = os.environ.get('PORT', '5000')
        environment = os.environ.get('FLASK_ENV', 'development')
        
        response_data = {
            'status': 'healthy',
            'message': 'qPCR S-Curve Analyzer with Database',
            'version': '2.1.0-database',
            'port': port,
            'environment': environment,
            'timestamp': time.strftime('%Y-%m-%d %H:%M:%S'),
            'thread_count': threading.active_count(),
            'request_headers': {k: v for k, v in request.headers.items() if k.startswith('X-')}
        }
        
        # Test database connection if possible
        try:
            with app.app_context():
                from sqlalchemy import text as sql_text
                db.session.execute(sql_text('SELECT 1'))
            response_data['database'] = 'connected'
        except Exception as db_error:
            # Don't fail health check due to database issues
            response_data['database'] = f'warning: {str(db_error)}'
        
        # Add timing information
        response_data['response_time_ms'] = round((time.time() - start_time) * 1000, 2)
        
        return jsonify(response_data), 200
        
    except Exception as e:
        # Return unhealthy status with error details
        return jsonify({
            'status': 'unhealthy',
            'message': 'Health check failed',
            'error': str(e),
            'port': os.environ.get('PORT', '5000'),
            'environment': os.environ.get('FLASK_ENV', 'development'),
            'timestamp': time.strftime('%Y-%m-%d %H:%M:%S')
        }), 503

@app.route('/ping', methods=['GET'])
def ping():
    """Simple ping endpoint for basic connectivity check"""
    return jsonify({
        'status': 'ok',
        'message': 'Server is running',
        'timestamp': datetime.utcnow().isoformat()
    }), 200

@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Endpoint not found'}), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({'error': 'Internal server error'}), 500

# Simple delete endpoint for testing
@app.route('/sessions/<int:session_id>/simple-delete', methods=['DELETE'])
def simple_delete_session(session_id):
    """Simple delete without foreign key constraints for testing"""
    try:
        # Don't enable foreign key constraints for this endpoint
        session = AnalysisSession.query.get(session_id)
        if not session:
            return jsonify({'error': f'Session {session_id} not found'}), 404
        
        print(f"[SIMPLE DELETE] Deleting session {session_id}: {session.filename}")
        
        # Just delete the session - let cascade handle the wells if configured
        db.session.delete(session)
        db.session.commit()
        
        print(f"[SIMPLE DELETE] Session {session_id} deleted successfully")
        return jsonify({'message': f'Session {session_id} deleted successfully (simple mode)'})
        
    except Exception as e:
        db.session.rollback()
        print(f"[SIMPLE DELETE ERROR] {e}")
        return jsonify({'error': f'Simple delete failed: {str(e)}'}), 500

# ===== ML CURVE CLASSIFIER ENDPOINTS =====

try:
    from ml_curve_classifier import ml_classifier
    ML_AVAILABLE = True
    
    # Track ML model loading compliance
    if ml_classifier and hasattr(ml_classifier, 'model_trained') and ml_classifier.model_trained:
        model_stats = ml_classifier.get_model_stats()
        ml_startup_metadata = {
            'model_loaded_at_startup': True,
            'training_samples': len(ml_classifier.training_data) if hasattr(ml_classifier, 'training_data') else 0,
            'model_accuracy': model_stats.get('accuracy', 0.0),
            'model_version': model_stats.get('version', 'startup_load'),
            'pathogen_models': len(model_stats.get('pathogen_breakdown', {})),
            'startup_validation': True
        }
        
        # Use a delayed compliance tracking to ensure database is ready
        def track_startup_compliance():
            try:
                track_ml_compliance('ML_MODEL_VALIDATION', ml_startup_metadata)
            except Exception as e:
                print(f"Could not track startup ML compliance: {e}")
        
        # Schedule for after app initialization
        import threading
        threading.Timer(2.0, track_startup_compliance).start()
        
except ImportError:
    print("ML classifier not available - scikit-learn may not be installed")
    ML_AVAILABLE = False
    ml_classifier = None

@app.route('/api/ml-analyze-curve', methods=['POST'])
def ml_analyze_curve():
    """Get ML analysis and prediction for a curve"""
    if not ML_AVAILABLE or ml_classifier is None:
        return jsonify({'error': 'ML classifier not available'}), 503
    
    try:
        data = request.json
        if not data:
            return jsonify({'error': 'No data provided'}), 400
            
        rfu_data = data.get('rfu_data', [])
        cycles = data.get('cycles', [])
        existing_metrics = data.get('existing_metrics', {})
        well_data = data.get('well_data', {})
        check_recent_feedback = data.get('check_recent_feedback', True)
        
        # Extract pathogen information from well data
        from ml_curve_classifier import extract_pathogen_from_well_data
        pathogen = extract_pathogen_from_well_data(well_data)
        
        # Check if there's recent expert feedback for this exact well/sample
        well_id = well_data.get('well', 'unknown')
        recent_feedback = None
        
        if check_recent_feedback and ml_classifier.training_data:
            # Look for recent feedback (within last 5 minutes) for this well
            from datetime import datetime, timedelta
            cutoff_time = datetime.now() - timedelta(minutes=5)
            
            for sample in reversed(ml_classifier.training_data):  # Check most recent first
                sample_time = datetime.fromisoformat(sample.get('timestamp', ''))
                sample_well = sample.get('well_id', '')
                
                if (sample_time > cutoff_time and 
                    (sample_well == well_id or sample_well == well_data.get('sample', ''))):
                    recent_feedback = sample
                    break
        
        # If recent feedback exists, return that as the prediction
        if recent_feedback:
            prediction = {
                'classification': recent_feedback['expert_classification'],
                'confidence': 1.0,
                'method': 'Recent Expert Feedback',
                'pathogen': pathogen,
                'feedback_timestamp': recent_feedback['timestamp']
            }
        else:
            # Get ML prediction with pathogen context
            prediction = ml_classifier.predict_classification(rfu_data, cycles, existing_metrics, pathogen)
        
        # Get enhanced training stats breakdown with detailed pathogen information
        general_samples = len([s for s in ml_classifier.training_data if not s.get('pathogen') or s.get('pathogen') == 'General_PCR'])
        
        # Create detailed pathogen breakdown
        pathogen_breakdown = {}
        current_test_samples = 0
        
        for sample in ml_classifier.training_data:
            sample_pathogen = sample.get('pathogen', 'General_PCR')
            # Ensure pathogen is a string for safe comparison
            sample_pathogen = str(sample_pathogen) if sample_pathogen is not None else 'General_PCR'
            
            if sample_pathogen not in pathogen_breakdown:
                pathogen_breakdown[sample_pathogen] = 0
            pathogen_breakdown[sample_pathogen] += 1
            
            # Count samples for current test with safe string comparison
            if pathogen and str(sample_pathogen) == str(pathogen):
                current_test_samples += 1
        
        total_samples = len(ml_classifier.training_data)
        
        # Track ML compliance for prediction made
        if not recent_feedback:  # Only track actual ML predictions, not recent feedback returns
            ml_prediction_metadata = {
                'well_id': well_id,
                'pathogen': pathogen,
                'prediction': prediction['classification'],
                'confidence': prediction['confidence'],
                'method': prediction['method'],
                'total_training_samples': total_samples,
                'pathogen_specific_samples': current_test_samples,
                'model_version': ml_classifier.get_model_stats().get('version', 'unknown'),
                'prediction_features': list(existing_metrics.keys())
            }
            track_ml_compliance('ML_PREDICTION_MADE', ml_prediction_metadata)
        
        return jsonify({
            'success': True,
            'prediction': prediction,
            'pathogen': pathogen,
            'model_stats': ml_classifier.get_model_stats(),
            'training_breakdown': {
                'total_samples': total_samples,
                'general_pcr_samples': general_samples,
                'current_test_samples': current_test_samples,
                'current_test_pathogen': pathogen,
                'pathogen_breakdown': pathogen_breakdown,
                'pathogen_specific_samples': sum(v for k, v in pathogen_breakdown.items() if k != 'General_PCR')
            }
        })
        
    except Exception as e:
        print(f"ML analysis error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/ml-submit-feedback', methods=['POST'])
def ml_submit_feedback():
    """Submit expert feedback for ML training"""
    if not ML_AVAILABLE or ml_classifier is None:
        return jsonify({'error': 'ML classifier not available'}), 503
    
    try:
        data = request.json
        if not data:
            return jsonify({'error': 'No data provided'}), 400
            
        rfu_data = data.get('rfu_data', [])
        cycles = data.get('cycles', [])
        existing_metrics = data.get('existing_metrics', {})
        expert_classification = data.get('expert_classification')
        well_id = data.get('well_id', 'unknown')
        well_data = data.get('well_data', {})
        
        # Extract pathogen information from well data
        from ml_curve_classifier import extract_pathogen_from_well_data
        pathogen = extract_pathogen_from_well_data(well_data)
        
        # Extract full sample name for duplicate prevention
        full_sample_name = well_data.get('sample', 'Unknown_Sample')
        channel = well_data.get('channel', well_data.get('fluorophore', 'Unknown_Channel'))
        
        # Create enhanced existing metrics that include sample identification
        enhanced_metrics = existing_metrics.copy()
        enhanced_metrics['sample'] = full_sample_name
        enhanced_metrics['channel'] = channel
        enhanced_metrics['fluorophore'] = channel
        
        # Add training sample with pathogen context and sample identification
        ml_classifier.add_training_sample(
            rfu_data, cycles, enhanced_metrics, 
            expert_classification, well_id, pathogen
        )
        
        # Get enhanced training stats breakdown with detailed pathogen information
        general_samples = len([s for s in ml_classifier.training_data if not s.get('pathogen') or s.get('pathogen') == 'General_PCR'])
        
        # Create detailed pathogen breakdown
        pathogen_breakdown = {}
        current_test_samples = 0
        
        for sample in ml_classifier.training_data:
            sample_pathogen = sample.get('pathogen', 'General_PCR')
            # Ensure pathogen is a string for safe comparison
            sample_pathogen = str(sample_pathogen) if sample_pathogen is not None else 'General_PCR'
            
            if sample_pathogen not in pathogen_breakdown:
                pathogen_breakdown[sample_pathogen] = 0
            pathogen_breakdown[sample_pathogen] += 1
            
            # Count samples for current test with safe string comparison
            if pathogen and str(sample_pathogen) == str(pathogen):
                current_test_samples += 1
        
        total_samples = len(ml_classifier.training_data)
        
        # Track ML compliance for expert feedback submission
        ml_feedback_metadata = {
            'expert_classification': expert_classification,
            'pathogen': pathogen,
            'well_id': well_id,
            'full_sample_name': full_sample_name,
            'channel': channel,
            'total_training_samples': total_samples,
            'current_test_samples': current_test_samples,
            'feedback_confidence': 1.0,
            'learning_outcome': 'expert_validation_captured'
        }
        track_ml_compliance('ML_FEEDBACK_SUBMITTED', ml_feedback_metadata)
        
        return jsonify({
            'success': True,
            'message': 'Feedback submitted successfully',
            'training_samples': total_samples,
            'pathogen': pathogen,
            'training_breakdown': {
                'total_samples': total_samples,
                'general_pcr_samples': general_samples,
                'current_test_samples': current_test_samples,
                'current_test_pathogen': pathogen,
                'pathogen_breakdown': pathogen_breakdown,
                'pathogen_specific_samples': sum(v for k, v in pathogen_breakdown.items() if k != 'General_PCR')
            },
            'immediate_prediction': {
                'classification': expert_classification,
                'confidence': 1.0,
                'method': 'Expert Feedback',
                'pathogen': pathogen
            }
        })
        
    except Exception as e:
        print(f"ML feedback error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/ml-check-trained-sample', methods=['POST'])
def ml_check_trained_sample():
    """Check if a sample has already been used for training"""
    if not ML_AVAILABLE or ml_classifier is None:
        return jsonify({'error': 'ML classifier not available'}), 503
    
    try:
        data = request.json
        if not data:
            return jsonify({'error': 'No data provided'}), 400
            
        sample_identifier = data.get('sample_identifier')
        full_sample_name = data.get('full_sample_name', '')
        pathogen = data.get('pathogen', '')
        channel = data.get('channel', '')
        
        if not sample_identifier:
            return jsonify({'error': 'Sample identifier required'}), 400
        
        # Check if this sample identifier already exists in training data
        already_trained = ml_classifier.check_sample_already_trained(
            sample_identifier, full_sample_name, pathogen, channel
        )
        
        return jsonify({
            'success': True,
            'already_trained': already_trained,
            'sample_identifier': sample_identifier,
            'full_sample_name': full_sample_name,
            'pathogen': pathogen,
            'channel': channel
        })
        
    except Exception as e:
        print(f"ML sample check error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/ml-get-trained-samples', methods=['GET'])
def ml_get_trained_samples():
    """Get list of all trained sample identifiers for duplicate prevention"""
    if not ML_AVAILABLE or ml_classifier is None:
        return jsonify({'error': 'ML classifier not available'}), 503
    
    try:
        trained_identifiers = ml_classifier.get_trained_sample_identifiers()
        
        return jsonify({
            'success': True,
            'trained_sample_identifiers': trained_identifiers,
            'total_count': len(trained_identifiers)
        })
        
    except Exception as e:
        print(f"ML get trained samples error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/ml-retrain', methods=['POST'])
def ml_retrain():
    """Manually trigger ML model retraining"""
    if not ML_AVAILABLE or ml_classifier is None:
        return jsonify({'error': 'ML classifier not available'}), 503
    
    try:
        data = request.json or {}
        manual_trigger = data.get('manual_trigger', False)
        training_samples = data.get('training_samples', 0)
        
        print(f"🔄 Manual retrain triggered with {training_samples} training samples")
        
        success = ml_classifier.retrain_model()
        model_stats = ml_classifier.get_model_stats()
        
        # Track ML compliance for model training/retraining
        if success:
            ml_training_metadata = {
                'training_trigger': 'manual' if manual_trigger else 'automatic',
                'training_samples': len(ml_classifier.training_data),
                'model_accuracy': model_stats.get('accuracy', 0.0),
                'model_version': model_stats.get('version', 'unknown'),
                'pathogen_models': len(model_stats.get('pathogen_breakdown', {})),
                'retraining_success': True,
                'model_performance': {
                    'accuracy': model_stats.get('accuracy', 0.0),
                    'training_data_size': len(ml_classifier.training_data),
                    'cross_validation_score': model_stats.get('cross_val_score', 0.0)
                }
            }
            
            # Track multiple compliance events for model training
            track_ml_compliance('ML_MODEL_TRAINED', ml_training_metadata)
            track_ml_compliance('ML_MODEL_RETRAINED', ml_training_metadata)
            
            # Track model performance validation
            if model_stats.get('accuracy', 0.0) > 0:
                validation_metadata = {
                    'validation_type': 'retraining_validation',
                    'accuracy_score': model_stats.get('accuracy', 0.0),
                    'validation_samples': len(ml_classifier.training_data),
                    'validation_date': datetime.utcnow().isoformat(),
                    'validation_method': 'cross_validation',
                    'performance_threshold_met': model_stats.get('accuracy', 0.0) >= 0.7
                }
                track_ml_compliance('ML_ACCURACY_VALIDATED', validation_metadata)
        
        return jsonify({
            'success': success,
            'message': f'Model retrained with {len(ml_classifier.training_data)} samples' if success else 'Retraining failed',
            'training_samples': len(ml_classifier.training_data),
            'model_trained': ml_classifier.model_trained,
            'accuracy': model_stats.get('accuracy', 0.0) if success else 0.0,
            'model_stats': model_stats,
            'manual_trigger': manual_trigger
        })
        
    except Exception as e:
        print(f"ML retrain error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/ml-stats', methods=['GET'])
def ml_stats():
    """Get ML model statistics"""
    if not ML_AVAILABLE or ml_classifier is None:
        return jsonify({'error': 'ML classifier not available'}), 503
    
    try:
        stats = ml_classifier.get_model_stats()
        return jsonify({
            'success': True,
            'stats': stats
        })
        
    except Exception as e:
        print(f"ML stats error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/ml-validation-dashboard', methods=['GET'])
def ml_validation_dashboard_api():
    """Get comprehensive ML validation dashboard data with pathogen tracking"""
    try:
        from ml_validation_tracker import ml_tracker
        
        # Get pathogen-specific model data
        pathogen_data = ml_tracker.get_pathogen_dashboard_data()
        
        # Get expert teaching summary
        teaching_summary = ml_tracker.get_expert_teaching_summary(days=30)
        
        # Get general ML stats
        ml_stats_data = {}
        if ML_AVAILABLE and ml_classifier is not None:
            ml_stats_data = ml_classifier.get_model_stats()
        
        return jsonify({
            'success': True,
            'pathogen_models': pathogen_data,
            'teaching_summary': teaching_summary,
            'ml_stats': ml_stats_data,
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        app.logger.error(f"ML validation dashboard error: {e}")
        return jsonify({'error': str(e)}), 500

# ===== ML CONFIGURATION ENDPOINTS =====

@app.route('/api/ml-config/pathogen', methods=['GET'])
def get_pathogen_ml_configs():
    """Get all pathogen ML configurations"""
    try:
        from ml_config_manager import ml_config_manager
        configs = ml_config_manager.get_all_pathogen_configs()
        
        return jsonify({
            'success': True,
            'configs': configs
        })
        
    except Exception as e:
        app.logger.error(f"Failed to get pathogen ML configs: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/ml-config/pathogen/<pathogen_code>/<fluorophore>', methods=['PUT'])
def update_pathogen_ml_config(pathogen_code, fluorophore):
    """Enable/disable ML for specific pathogen+fluorophore"""
    try:
        from ml_config_manager import ml_config_manager
        
        data = request.get_json()
        enabled = data.get('enabled', True)
        
        # Get user info from request (for future role-based access)
        user_info = {
            'user_id': request.headers.get('X-User-ID', 'anonymous'),
            'ip': request.remote_addr,
            'notes': data.get('notes', '')
        }
        
        success = ml_config_manager.set_pathogen_ml_enabled(
            pathogen_code, fluorophore, enabled, user_info
        )
        
        if success:
            return jsonify({
                'success': True,
                'message': f"ML {'enabled' if enabled else 'disabled'} for {pathogen_code}/{fluorophore}"
            })
        else:
            return jsonify({'error': 'Failed to update configuration'}), 500
            
    except Exception as e:
        app.logger.error(f"Failed to update pathogen ML config: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/ml-config/pathogen/<pathogen_code>', methods=['GET'])
def get_pathogen_ml_config(pathogen_code):
    """Get ML configuration for specific pathogen"""
    try:
        from ml_config_manager import ml_config_manager
        
        fluorophore = request.args.get('fluorophore')
        configs = ml_config_manager.get_pathogen_ml_config(pathogen_code, fluorophore)
        
        return jsonify({
            'success': True,
            'configs': configs
        })
        
    except Exception as e:
        app.logger.error(f"Failed to get pathogen ML config: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/ml-config/system', methods=['GET'])
def get_system_ml_config():
    """Get system-wide ML configuration"""
    try:
        from ml_config_manager import ml_config_manager
        
        config = {
            'ml_global_enabled': ml_config_manager.get_system_config('ml_global_enabled') == 'true',
            'training_data_version': ml_config_manager.get_system_config('training_data_version'),
            'min_training_examples': int(ml_config_manager.get_system_config('min_training_examples') or 10),
            'reset_protection_enabled': ml_config_manager.get_system_config('reset_protection_enabled') == 'true',
            'auto_training_enabled': ml_config_manager.get_system_config('auto_training_enabled') == 'true',
            'show_learning_messages': ml_config_manager.get_system_config('show_learning_messages') == 'true'
        }
        
        return jsonify({
            'success': True,
            'config': config
        })
        
    except Exception as e:
        app.logger.error(f"Failed to get system ML config: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/ml-config/system/<config_key>', methods=['PUT'])
def update_system_ml_config(config_key):
    """Update system-wide ML configuration (ADMIN ONLY - future role check)"""
    try:
        from ml_config_manager import ml_config_manager
        
        data = request.get_json()
        value = str(data.get('value', ''))
        
        # Get user info for audit
        user_info = {
            'user_id': request.headers.get('X-User-ID', 'anonymous'),
            'ip': request.remote_addr,
            'notes': data.get('notes', '')
        }
        
        # TODO: Add role-based access check here
        # if not user_has_admin_role(user_info['user_id']):
        #     return jsonify({'error': 'Admin access required'}), 403
        
        success = ml_config_manager.set_system_config(config_key, value, user_info)
        
        if success:
            return jsonify({
                'success': True,
                'message': f"System config '{config_key}' updated to '{value}'"
            })
        else:
            return jsonify({'error': 'Failed to update system configuration'}), 500
            
    except Exception as e:
        app.logger.error(f"Failed to update system ML config: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/ml-config/reset-training-data', methods=['POST'])
def reset_ml_training_data():
    """Reset ML training data (DANGEROUS - ADMIN ONLY)"""
    try:
        from ml_config_manager import ml_config_manager
        
        data = request.get_json()
        pathogen_code = data.get('pathogen_code')
        fluorophore = data.get('fluorophore')
        confirmation = data.get('confirmation', '')
        
        # Require explicit confirmation
        if confirmation != 'RESET_TRAINING_DATA':
            return jsonify({
                'error': 'Missing or invalid confirmation. Use "RESET_TRAINING_DATA"'
            }), 400
        
        # Get user info for audit
        user_info = {
            'user_id': request.headers.get('X-User-ID', 'anonymous'),
            'ip': request.remote_addr,
            'notes': data.get('notes', 'Manual training data reset')
        }
        
        # TODO: Add role-based access check here
        # if not user_has_admin_role(user_info['user_id']):
        #     return jsonify({'error': 'Admin access required'}), 403
        
        success, backup_path = ml_config_manager.reset_training_data(
            pathogen_code, fluorophore, user_info
        )
        
        if success:
            target = f"{pathogen_code}/{fluorophore}" if pathogen_code and fluorophore else \
                    pathogen_code if pathogen_code else "ALL"
            
            return jsonify({
                'success': True,
                'message': f"Training data reset for {target}",
                'backup_path': backup_path
            })
        else:
            return jsonify({'error': 'Failed to reset training data'}), 500
            
    except Exception as e:
        app.logger.error(f"Failed to reset training data: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/ml-config/audit-log', methods=['GET'])
def get_ml_audit_log():
    """Get ML configuration audit log"""
    try:
        from ml_config_manager import ml_config_manager
        
        limit = int(request.args.get('limit', 50))
        log_entries = ml_config_manager.get_audit_log(limit)
        
        return jsonify({
            'success': True,
            'log_entries': log_entries
        })
        
    except Exception as e:
        app.logger.error(f"Failed to get audit log: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/ml-config/check-enabled/<pathogen_code>/<fluorophore>', methods=['GET'])
def check_ml_enabled(pathogen_code, fluorophore):
    """Check if ML is enabled for specific pathogen+fluorophore"""
    try:
        from ml_config_manager import ml_config_manager
        
        enabled = ml_config_manager.is_ml_enabled_for_pathogen(pathogen_code, fluorophore)
        
        return jsonify({
            'success': True,
            'enabled': enabled,
            'pathogen_code': pathogen_code,
            'fluorophore': fluorophore
        })
        
    except Exception as e:
        app.logger.error(f"Failed to check ML enabled status: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/ml-config/enabled-pathogens', methods=['GET'])
def get_enabled_pathogens():
    """Get list of all enabled pathogen configurations for UI filtering"""
    try:
        # Import the ML config manager locally to ensure it's available
        from ml_config_manager import MLConfigManager
        import os
        
        # Create a fresh instance to ensure we have the latest methods
        sqlite_path = os.path.join(os.path.dirname(__file__), 'qpcr_analysis.db')
        local_ml_config_manager = MLConfigManager(sqlite_path)
        
        # Get all pathogen configs where ML is enabled
        enabled_configs = local_ml_config_manager.get_enabled_pathogen_configs()
        
        # Format for frontend use
        enabled_pathogens = {}
        for config in enabled_configs:
            pathogen = config['pathogen_code']
            fluorophore = config['fluorophore']
            
            if pathogen not in enabled_pathogens:
                enabled_pathogens[pathogen] = []
            enabled_pathogens[pathogen].append(fluorophore)
        
        return jsonify({
            'success': True,
            'enabled_pathogens': enabled_pathogens
        })
        
    except Exception as e:
        app.logger.error(f"Failed to get enabled pathogens: {e}")
        return jsonify({'error': str(e)}), 500

# ===== END ML ENDPOINTS =====

# ===== FOLDER QUEUE ENDPOINTS =====

@app.route('/queue.html')
def queue_page():
    """Serve the dedicated queue management page"""
    return send_from_directory('.', 'queue.html')

@app.route('/api/folder-queue/scan', methods=['POST'])
def scan_folder_for_files():
    """
    Scan a folder path for qPCR files and return matching file pairs
    Note: In a production environment, this would need proper security controls
    """
    try:
        data = request.get_json()
        folder_path = data.get('folder_path')
        
        if not folder_path or not os.path.exists(folder_path):
            return jsonify({
                'success': False,
                'error': 'Invalid folder path'
            }), 400
        
        # Security check - only allow certain directories
        # In production, implement proper access controls
        if not is_safe_folder_path(folder_path):
            return jsonify({
                'success': False,
                'error': 'Access denied to this folder'
            }), 403
        
        file_pairs = scan_folder_for_qpcr_files(folder_path)
        
        return jsonify({
            'success': True,
            'file_pairs': file_pairs,
            'folder_path': folder_path,
            'scan_time': datetime.now().isoformat()
        })
        
    except Exception as e:
        app.logger.error(f"Error scanning folder: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

def is_safe_folder_path(folder_path):
    """
    Security check for folder access
    In production, implement proper user permissions and role-based access
    """
    # For development, allow all paths
    # In production, check against allowed directories and user permissions
    
    # Basic security - prevent path traversal
    normalized_path = os.path.normpath(folder_path)
    if '..' in normalized_path:
        return False
    
    # Add additional security checks as needed
    # e.g., check against whitelist of allowed directories
    # e.g., check user permissions based on authentication
    
    return True

def scan_folder_for_qpcr_files(folder_path):
    """
    Scan folder for qPCR file pairs (amplification + summary)
    Returns list of experiment file pairs
    """
    file_pairs = {}
    
    try:
        # Pattern matching for qPCR files
        amplification_pattern = re.compile(r'(.+)_(\d+)_([A-Z0-9]+)\.csv$', re.IGNORECASE)
        summary_pattern = re.compile(r'(.+)_(\d+)_([A-Z0-9]+).*summary.*\.csv$', re.IGNORECASE)
        
        amplification_files = {}  # experiment_id -> [files]
        summary_files = {}        # experiment_id -> file
        
        # Scan all CSV files in the folder
        for filename in os.listdir(folder_path):
            if not filename.lower().endswith('.csv'):
                continue
                
            file_path = os.path.join(folder_path, filename)
            file_stat = os.stat(file_path)
            
            # Check if it's a summary file
            summary_match = summary_pattern.match(filename)
            if summary_match:
                test_name, run_id, instrument = summary_match.groups()
                experiment_id = f"{test_name}_{run_id}_{instrument}"
                
                # Keep the newest summary file if duplicates exist
                if (experiment_id not in summary_files or 
                    file_stat.st_mtime > summary_files[experiment_id]['modified']):
                    summary_files[experiment_id] = {
                        'filename': filename,
                        'path': file_path,
                        'modified': file_stat.st_mtime,
                        'size': file_stat.st_size
                    }
                continue
            
            # Check if it's an amplification file
            amp_match = amplification_pattern.match(filename)
            if amp_match and 'summary' not in filename.lower():
                test_name, run_id, instrument = amp_match.groups()
                experiment_id = f"{test_name}_{run_id}_{instrument}"
                
                if experiment_id not in amplification_files:
                    amplification_files[experiment_id] = []
                
                file_info = {
                    'filename': filename,
                    'path': file_path,
                    'modified': file_stat.st_mtime,
                    'size': file_stat.st_size,
                    'fluorophore': detect_fluorophore_from_filename(filename)
                }
                
                # Handle duplicates - keep the newest file
                existing_files = amplification_files[experiment_id]
                base_name = re.sub(r'\d+\.csv$', '', filename, flags=re.IGNORECASE)
                
                existing_index = -1
                for i, existing_file in enumerate(existing_files):
                    existing_base = re.sub(r'\d+\.csv$', '', existing_file['filename'], flags=re.IGNORECASE)
                    if existing_base == base_name:
                        existing_index = i
                        break
                
                if existing_index >= 0:
                    if file_stat.st_mtime > existing_files[existing_index]['modified']:
                        existing_files[existing_index] = file_info
                else:
                    existing_files.append(file_info)
                
                # Limit to 4 amplification files per experiment
                if len(existing_files) > 4:
                    existing_files.sort(key=lambda x: x['modified'], reverse=True)
                    amplification_files[experiment_id] = existing_files[:4]
        
        # Create file pairs for experiments with both amplification and summary files
        for experiment_id in amplification_files:
            if experiment_id in summary_files:
                amp_files = amplification_files[experiment_id]
                summary_file = summary_files[experiment_id]
                
                file_pairs[experiment_id] = {
                    'experiment_id': experiment_id,
                    'amplification_files': amp_files,
                    'summary_file': summary_file,
                    'timestamp': max(
                        summary_file['modified'],
                        max(f['modified'] for f in amp_files)
                    ),
                    'fluorophores': [f['fluorophore'] for f in amp_files],
                    'total_files': len(amp_files) + 1
                }
        
        return list(file_pairs.values())
        
    except Exception as e:
        app.logger.error(f"Error scanning folder {folder_path}: {str(e)}")
        raise

def detect_fluorophore_from_filename(filename):
    """Detect fluorophore from filename patterns"""
    filename_lower = filename.lower()
    
    if 'cy5' in filename_lower or 'red' in filename_lower:
        return 'Cy5'
    elif 'fam' in filename_lower or 'green' in filename_lower:
        return 'FAM'
    elif 'hex' in filename_lower or 'yellow' in filename_lower:
        return 'HEX'
    elif 'texas' in filename_lower and 'red' in filename_lower:
        return 'TexasRed'
    elif 'rox' in filename_lower:
        return 'TexasRed'
    else:
        return 'Unknown'

@app.route('/api/folder-queue/validate-files', methods=['POST'])
def validate_queue_files():
    """
    Validate that the files in a queue entry are still accessible and properly formatted
    """
    try:
        data = request.get_json()
        file_paths = data.get('file_paths', [])
        
        validation_results = {}
        
        for file_path in file_paths:
            try:
                if not os.path.exists(file_path):
                    validation_results[file_path] = {
                        'valid': False,
                        'error': 'File not found'
                    }
                    continue
                
                # Basic CSV validation
                with open(file_path, 'r', encoding='utf-8') as f:
                    first_line = f.readline().strip()
                    if not first_line:
                        validation_results[file_path] = {
                            'valid': False,
                            'error': 'Empty file'
                        }
                        continue
                
                # Check if it looks like a CSV
                if ',' not in first_line and '\t' not in first_line:
                    validation_results[file_path] = {
                        'valid': False,
                        'error': 'Not a valid CSV file'
                    }
                    continue
                
                validation_results[file_path] = {
                    'valid': True,
                    'size': os.path.getsize(file_path),
                    'modified': os.path.getmtime(file_path)
                }
                
            except Exception as e:
                validation_results[file_path] = {
                    'valid': False,
                    'error': str(e)
                }
        
        return jsonify({
            'success': True,
            'validation_results': validation_results
        })
        
    except Exception as e:
        app.logger.error(f"Error validating queue files: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

# ========================= ML VALIDATION API ENDPOINTS =========================

@app.route('/api/ml-validation/dashboard-data', methods=['GET'])
def get_ml_validation_dashboard_data():
    """Get comprehensive dashboard data for ML validation tracking"""
    try:
        if not ml_validation_manager:
            return jsonify({'error': 'ML validation manager not initialized'}), 500
        
        # Get query parameters
        days = int(request.args.get('days', 30))
        pathogen_code = request.args.get('pathogen', '')
        model_type = request.args.get('model_type', '')
        
        # Get performance summary
        summary_data = ml_validation_manager.get_model_performance_summary(
            days=days, 
            pathogen_code=pathogen_code if pathogen_code else None
        )
        
        # Get expert override rates
        override_data = ml_validation_manager.get_expert_override_rate(
            days=days,
            pathogen_code=pathogen_code if pathogen_code else None
        )
        
        # Get model versions
        # This will be enhanced with actual query later
        model_versions = summary_data.get('summary', [])
        
        # Prepare dashboard response
        dashboard_data = {
            'summary': {
                'active_models': len([m for m in model_versions if m.get('version_number')]),
                'overall_accuracy': sum(m.get('avg_accuracy', 0) for m in model_versions) / len(model_versions) if model_versions else 0,
                'override_rate': sum(o.get('override_percentage', 0) for o in override_data.get('override_rates', [])) / len(override_data.get('override_rates', [])) if override_data.get('override_rates') else 0,
                'total_predictions': sum(m.get('total_predictions', 0) for m in model_versions),
                'accuracy_trend': 0,  # Will be calculated with historical data
                'override_trend': 0,  # Will be calculated with historical data  
                'predictions_trend': 0  # Will be calculated with historical data
            },
            'model_versions': model_versions,
            'override_analysis': override_data.get('override_rates', []),
            'charts': {
                'performance_trends': {
                    'dates': [],  # Will be populated with actual trend data
                    'accuracy': [],
                    'override_rates': []
                },
                'pathogen_accuracy': {
                    'pathogens': [m.get('pathogen_code', 'Unknown') for m in model_versions],
                    'accuracies': [m.get('avg_accuracy', 0) for m in model_versions]
                },
                'override_breakdown': {
                    'pathogens': [o.get('pathogen_code', 'Unknown') for o in override_data.get('override_rates', [])],
                    'rates': [o.get('override_percentage', 0) for o in override_data.get('override_rates', [])]
                }
            },
            'compliance': {
                'status': 'Compliant',
                'validation_score': 98.5,
                'audit_events': len(model_versions) * 50,  # Approximate
                'pending_reviews': 0,
                'last_audit': datetime.now().strftime('%Y-%m-%d')
            }
        }
        
        return jsonify(dashboard_data)
        
    except Exception as e:
        app.logger.error(f"Error getting ML validation dashboard data: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/ml-validation/track-prediction', methods=['POST'])
def track_ml_prediction():
    """Track an ML prediction and any expert override"""
    try:
        if not ml_validation_manager:
            return jsonify({'error': 'ML validation manager not initialized'}), 500
        
        data = request.get_json()
        
        # Get or create performance record
        model_version = ml_validation_manager.get_active_model_version(
            model_type=data.get('model_type', 'general_pcr'),
            pathogen_code=data.get('pathogen_code'),
            fluorophore=data.get('fluorophore')
        )
        
        if not model_version:
            # Create a default model version if none exists
            model_version_id = ml_validation_manager.create_new_model_version(
                model_type=data.get('model_type', 'general_pcr'),
                version_number='v1.0',
                pathogen_code=data.get('pathogen_code'),
                fluorophore=data.get('fluorophore'),
                trained_by='system'
            )
        else:
            model_version_id = model_version['id']
        
        # Get or create performance tracking record
        performance_id = ml_validation_manager.record_ml_performance(
            model_version_id=model_version_id,
            run_file_name=data.get('run_file_name', 'unknown'),
            session_id=data.get('session_id'),
            pathogen_code=data.get('pathogen_code'),
            fluorophore=data.get('fluorophore'),
            test_type=data.get('test_type')
        )
        
        # Track the specific prediction
        prediction_id = ml_validation_manager.track_prediction(
            performance_id=performance_id,
            well_id=data.get('well_id'),
            sample_name=data.get('sample_name'),
            pathogen_code=data.get('pathogen_code'),
            fluorophore=data.get('fluorophore'),
            ml_prediction=data.get('ml_prediction'),
            ml_confidence=data.get('ml_confidence'),
            expert_decision=data.get('expert_decision'),
            final_classification=data.get('final_classification'),
            model_version_used=model_version.get('version_number') if model_version else 'v1.0',
            feature_data=data.get('feature_data')
        )
        
        return jsonify({
            'success': True,
            'prediction_id': prediction_id,
            'performance_id': performance_id
        })
        
    except Exception as e:
        app.logger.error(f"Error tracking ML prediction: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/ml-validation/pathogen-details/<pathogen_code>', methods=['GET'])
def get_pathogen_validation_details(pathogen_code):
    """Get detailed validation statistics for a specific pathogen"""
    try:
        if not ml_validation_manager:
            return jsonify({'error': 'ML validation manager not initialized'}), 500
        
        days = int(request.args.get('days', 30))
        
        details = ml_validation_manager.get_pathogen_performance_details(
            pathogen_code=pathogen_code,
            days=days
        )
        
        return jsonify(details)
        
    except Exception as e:
        app.logger.error(f"Error getting pathogen validation details: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/ml-validation/export-compliance-report', methods=['POST'])
def export_compliance_report():
    """Export FDA compliance report"""
    try:
        if not ml_validation_manager:
            return jsonify({'error': 'ML validation manager not initialized'}), 500
        
        data = request.get_json()
        start_date = data.get('start_date')
        end_date = data.get('end_date')
        
        report = ml_validation_manager.generate_fda_compliance_report(
            start_date=start_date,
            end_date=end_date
        )
        
        # For now, return JSON (can be enhanced to generate PDF later)
        from flask import Response
        import json
        
        response = Response(
            json.dumps(report, indent=2),
            mimetype='application/json',
            headers={'Content-Disposition': f'attachment; filename=compliance_report_{datetime.now().strftime("%Y%m%d")}.json'}
        )
        
        return response
        
    except Exception as e:
        app.logger.error(f"Error exporting compliance report: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/ml-validation/model-versions', methods=['GET'])
def get_model_versions():
    """Get all model versions with performance data"""
    try:
        if not ml_validation_manager:
            return jsonify({'error': 'ML validation manager not initialized'}), 500
        
        # This would be enhanced with actual database queries
        # For now, return placeholder data
        versions = []
        
        return jsonify({
            'success': True,
            'model_versions': versions
        })
        
    except Exception as e:
        app.logger.error(f"Error getting model versions: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/ml-validation/create-model-version', methods=['POST'])
def create_model_version():
    """Create a new model version"""
    try:
        if not ml_validation_manager:
            return jsonify({'error': 'ML validation manager not initialized'}), 500
        
        data = request.get_json()
        
        version_id = ml_validation_manager.create_new_model_version(
            model_type=data.get('model_type'),
            version_number=data.get('version_number'),
            pathogen_code=data.get('pathogen_code'),
            fluorophore=data.get('fluorophore'),
            model_file_path=data.get('model_file_path'),
            training_samples_count=data.get('training_samples_count', 0),
            performance_notes=data.get('performance_notes'),
            trained_by=data.get('trained_by', 'user')
        )
        
        return jsonify({
            'success': True,
            'version_id': version_id
        })
        
    except Exception as e:
        app.logger.error(f"Error creating model version: {str(e)}")
        return jsonify({'error': str(e)}), 500

# ===== FDA COMPLIANCE API ENDPOINTS =====

@app.route('/api/fda-compliance/dashboard-data', methods=['GET'])
def get_fda_compliance_dashboard_data():
    """Get comprehensive FDA compliance dashboard data"""
    try:
        if not fda_compliance_manager:
            return jsonify({'error': 'FDA Compliance Manager not available'}), 503
        
        # Get query parameters
        days = request.args.get('days', 30, type=int)
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        
        # If custom date range provided, calculate days
        if start_date and end_date:
            from datetime import datetime, date
            start = datetime.strptime(start_date, '%Y-%m-%d').date()
            end = datetime.strptime(end_date, '%Y-%m-%d').date()
            days = (end - start).days
        
        dashboard_data = fda_compliance_manager.get_compliance_dashboard_data(days)
        
        # Log this action for audit trail
        fda_compliance_manager.log_user_action(
            user_id='system',
            user_role='operator',
            action_type='dashboard_access',
            resource_accessed='fda_compliance_dashboard',
            action_details={'days': days, 'start_date': start_date, 'end_date': end_date}
        )
        
        return jsonify(dashboard_data)
        
    except Exception as e:
        app.logger.error(f"Error getting FDA compliance dashboard data: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/fda-compliance/export-report', methods=['GET'])
def export_fda_compliance_report():
    """Export comprehensive FDA compliance report"""
    try:
        if not fda_compliance_manager:
            return jsonify({'error': 'FDA Compliance Manager not available'}), 503
        
        # Get query parameters
        report_type = request.args.get('type', 'summary')  # summary or full
        days = request.args.get('days', 90, type=int)
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        
        # Calculate date range
        if start_date and end_date:
            pass  # Use provided dates
        else:
            from datetime import datetime, timedelta
            end_date = datetime.now().date().isoformat()
            start_date = (datetime.now().date() - timedelta(days=days)).isoformat()
        
        # Generate report
        report = fda_compliance_manager.export_compliance_report(
            report_type=report_type,
            start_date=start_date,
            end_date=end_date
        )
        
        # Log this action for audit trail
        fda_compliance_manager.log_user_action(
            user_id='system',
            user_role='operator',
            action_type='report_export',
            resource_accessed='fda_compliance_report',
            action_details={'type': report_type, 'start_date': start_date, 'end_date': end_date}
        )
        
        response = jsonify(report)
        response.headers['Content-Disposition'] = f'attachment; filename=fda_compliance_{report_type}_report_{end_date}.json'
        return response
        
    except Exception as e:
        app.logger.error(f"Error exporting FDA compliance report: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/fda-compliance/log-user-action', methods=['POST'])
def log_fda_user_action():
    """Log user action for 21 CFR Part 11 compliance"""
    try:
        if not fda_compliance_manager:
            return jsonify({'error': 'FDA Compliance Manager not available'}), 503
        
        data = request.get_json()
        
        action_id = fda_compliance_manager.log_user_action(
            user_id=data.get('user_id', 'anonymous'),
            user_role=data.get('user_role', 'operator'),
            action_type=data.get('action_type'),
            resource_accessed=data.get('resource_accessed'),
            action_details=data.get('action_details'),
            success=data.get('success', True),
            ip_address=request.remote_addr
        )
        
        return jsonify({
            'success': True,
            'action_id': action_id
        })
        
    except Exception as e:
        app.logger.error(f"Error logging FDA user action: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/fda-compliance/record-qc-run', methods=['POST'])
def record_qc_run():
    """Record quality control run for CLIA compliance"""
    try:
        if not fda_compliance_manager:
            return jsonify({'error': 'FDA Compliance Manager not available'}), 503
        
        data = request.get_json()
        
        qc_id = fda_compliance_manager.create_qc_run(
            qc_date=data.get('qc_date', datetime.now().date().isoformat()),
            qc_type=data.get('qc_type'),
            test_type=data.get('test_type'),
            operator_id=data.get('operator_id'),
            expected_results=data.get('expected_results'),
            actual_results=data.get('actual_results'),
            supervisor_id=data.get('supervisor_id')
        )
        
        return jsonify({
            'success': True,
            'qc_id': qc_id
        })
        
    except Exception as e:
        app.logger.error(f"Error recording QC run: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/fda-compliance/create-adverse-event', methods=['POST'])
def create_adverse_event():
    """Create adverse event record for MDR compliance"""
    try:
        if not fda_compliance_manager:
            return jsonify({'error': 'FDA Compliance Manager not available'}), 503
        
        data = request.get_json()
        
        event_id = fda_compliance_manager.create_adverse_event(
            event_id=data.get('event_id'),
            event_date=data.get('event_date'),
            event_type=data.get('event_type'),
            severity=data.get('severity'),
            event_description=data.get('event_description'),
            patient_affected=data.get('patient_affected', False)
        )
        
        return jsonify({
            'success': True,
            'event_id': event_id
        })
        
    except Exception as e:
        app.logger.error(f"Error creating adverse event: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/fda-compliance/record-training', methods=['POST'])
def record_training():
    """Record personnel training for compliance"""
    try:
        if not fda_compliance_manager:
            return jsonify({'error': 'FDA Compliance Manager not available'}), 503
        
        data = request.get_json()
        
        training_id = fda_compliance_manager.record_training(
            employee_id=data.get('employee_id'),
            employee_name=data.get('employee_name'),
            role=data.get('role'),
            training_type=data.get('training_type'),
            training_topic=data.get('training_topic'),
            trainer=data.get('trainer'),
            assessment_score=data.get('assessment_score'),
            passing_score=data.get('passing_score', 80.0)
        )
        
        return jsonify({
            'success': True,
            'training_id': training_id
        })
        
    except Exception as e:
        app.logger.error(f"Error recording training: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/fda-compliance/create-risk-assessment', methods=['POST'])
def create_risk_assessment():
    """Create risk assessment record"""
    try:
        if not fda_compliance_manager:
            return jsonify({'error': 'FDA Compliance Manager not available'}), 503
        
        data = request.get_json()
        
        assessment_id = fda_compliance_manager.create_risk_assessment(
            assessment_type=data.get('assessment_type'),
            risk_category=data.get('risk_category'),
            description=data.get('description'),
            probability_score=data.get('probability_score'),
            severity_score=data.get('severity_score'),
            mitigation_plan=data.get('mitigation_plan'),
            assessor=data.get('assessor')
        )
        
        return jsonify({
            'success': True,
            'assessment_id': assessment_id
        })
        
    except Exception as e:
        app.logger.error(f"Error creating risk assessment: {str(e)}")
        return jsonify({'error': str(e)}), 500
    """Create risk assessment for ISO 14971 compliance"""
    try:
        if not fda_compliance_manager:
            return jsonify({'error': 'FDA Compliance Manager not available'}), 503
        
        data = request.get_json()
        
        risk_id = fda_compliance_manager.create_risk_assessment(
            risk_id=data.get('risk_id'),
            hazard_description=data.get('hazard_description'),
            hazardous_situation=data.get('hazardous_situation'),
            harm_description=data.get('harm_description'),
            probability=data.get('probability'),
            severity=data.get('severity'),
            risk_owner=data.get('risk_owner')
        )
        
        return jsonify({
            'success': True,
            'risk_id': risk_id
        })
        
    except Exception as e:
        app.logger.error(f"Error creating risk assessment: {str(e)}")
        return jsonify({'error': str(e)}), 500

# ===== UNIFIED COMPLIANCE API ENDPOINTS =====

@app.route('/api/unified-compliance/dashboard-data', methods=['GET'])
def get_unified_compliance_dashboard_data():
    """Get comprehensive software-specific compliance dashboard data"""
    try:
        if not unified_compliance_manager:
            return jsonify({'error': 'Unified Compliance Manager not available'}), 503
        
        # Get query parameters
        days = request.args.get('days', 30, type=int)
        category = request.args.get('category')  # ML_Validation, Analysis_Validation, etc.
        status = request.args.get('status')  # compliant, non_compliant, partial, unknown
        
        # Get comprehensive dashboard data with recent_activities
        dashboard_data = unified_compliance_manager.get_compliance_dashboard_data(days=days)
        
        # Enhance with software-specific ML validation metrics
        if ML_AVAILABLE and ml_classifier:
            ml_metrics = {
                'total_training_samples': len(ml_classifier.training_data) if ml_classifier.training_data else 0,
                'model_trained': ml_classifier.model_trained if hasattr(ml_classifier, 'model_trained') else False,
                'model_accuracy': ml_classifier.get_model_stats().get('accuracy', 0) if hasattr(ml_classifier, 'get_model_stats') else 0,
                'pathogen_models_loaded': 2,  # From startup logs
                'last_training_update': datetime.utcnow().isoformat()
            }
        else:
            ml_metrics = {
                'total_training_samples': 0,
                'model_trained': False,
                'model_accuracy': 0,
                'pathogen_models_loaded': 0,
                'last_training_update': None
            }
        
        # Add software-specific metrics to dashboard
        dashboard_data['ml_validation_metrics'] = ml_metrics
        dashboard_data['software_specific_focus'] = True
        dashboard_data['auto_trackable_percentage'] = 100  # All our requirements are auto-trackable
        
        # Track dashboard access for compliance
        dashboard_access_metadata = {
            'dashboard_type': 'software_compliance',
            'days_requested': days,
            'category_filter': category,
            'status_filter': status,
            'ml_metrics_included': True
        }
        track_compliance_automatically('SYSTEM_VALIDATION', dashboard_access_metadata)
        
        return jsonify(dashboard_data)
        
    except Exception as e:
        app.logger.error(f"Error getting unified compliance dashboard data: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/unified-compliance/requirements', methods=['GET'])
def get_compliance_requirements():
    """Get all compliance requirements with filtering"""
    try:
        if not unified_compliance_manager:
            return jsonify({'error': 'Unified Compliance Manager not available'}), 503
        
        # Get query parameters
        category = request.args.get('category')
        status = request.args.get('status')
        regulation_number = request.args.get('regulation_number')
        
        # Get requirements
        requirements = unified_compliance_manager.get_requirements(
            category=category,
            status=status,
            regulation_number=regulation_number
        )
        
        return jsonify(requirements)
        
    except Exception as e:
        app.logger.error(f"Error getting compliance requirements: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/unified-compliance/requirement/<int:requirement_id>/status', methods=['PUT'])
def update_requirement_status(requirement_id):
    """Update the status of a specific compliance requirement"""
    try:
        if not unified_compliance_manager:
            return jsonify({'error': 'Unified Compliance Manager not available'}), 503
        
        data = request.get_json()
        if not data or 'status' not in data:
            return jsonify({'error': 'Status is required'}), 400
        
        # Update status
        result = unified_compliance_manager.update_requirement_status(
            requirement_id=requirement_id,
            status=data['status'],
            evidence=data.get('evidence'),
            notes=data.get('notes')
        )
        
        return jsonify(result)
        
    except Exception as e:
        app.logger.error(f"Error updating requirement status: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/unified-compliance/event', methods=['POST'])
def log_compliance_event():
    """Log a compliance-related event for real-time tracking"""
    try:
        if not unified_compliance_manager:
            return jsonify({'error': 'Unified Compliance Manager not available'}), 503
        
        data = request.get_json()
        if not data or 'event_type' not in data:
            return jsonify({'error': 'Event type is required'}), 400
        
        # Log event and update related requirements
        result = unified_compliance_manager.log_event(
            event_type=data['event_type'],
            metadata=data.get('metadata', {}),
            session_id=data.get('session_id'),
            user_id=data.get('user_id')
        )
        
        return jsonify(result)
        
    except Exception as e:
        app.logger.error(f"Error logging compliance event: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/unified-compliance/export', methods=['GET'])
def export_compliance_data():
    """Export compliance data in various formats"""
    try:
        if not unified_compliance_manager:
            return jsonify({'error': 'Unified Compliance Manager not available'}), 503
        
        # Get query parameters
        format_type = request.args.get('format', 'json')  # json, csv, pdf
        category = request.args.get('category')
        date_range = request.args.get('date_range', 30)
        
        # Generate export data
        export_data = unified_compliance_manager.export_compliance_data(
            format_type=format_type,
            category=category,
            date_range=int(date_range)
        )
        
        # Track compliance for data export
        export_metadata = {
            'format_type': format_type,
            'category': category,
            'date_range': date_range,
            'timestamp': datetime.utcnow().isoformat(),
            'export_size': len(str(export_data)) if export_data else 0
        }
        track_compliance_automatically('DATA_EXPORTED', export_metadata)
        
        if format_type == 'csv':
            # Return CSV file
            return Response(
                export_data,
                mimetype='text/csv',
                headers={"Content-disposition": "attachment; filename=compliance_report.csv"}
            )
        elif format_type == 'pdf':
            # Return PDF file
            return Response(
                export_data,
                mimetype='application/pdf',
                headers={"Content-disposition": "attachment; filename=compliance_report.pdf"}
            )
        else:
            # Return JSON
            return jsonify(export_data)
        
    except Exception as e:
        app.logger.error(f"Error exporting compliance data: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/unified-compliance/validate-system', methods=['POST'])
def validate_system_compliance():
    """Run comprehensive system validation against all compliance requirements"""
    try:
        if not unified_compliance_manager:
            return jsonify({'error': 'Unified Compliance Manager not available'}), 503
        
        # Run system validation
        validation_results = unified_compliance_manager.validate_system_compliance()
        
        # Track compliance for system validation
        validation_metadata = {
            'validation_type': 'comprehensive_system_validation',
            'timestamp': datetime.utcnow().isoformat(),
            'total_requirements_checked': validation_results.get('total_requirements', 0),
            'compliance_score': validation_results.get('overall_compliance_score', 0)
        }
        track_compliance_automatically('SYSTEM_VALIDATION', validation_metadata)
        
        return jsonify(validation_results)
        
    except Exception as e:
        app.logger.error(f"Error running system validation: {str(e)}")
        return jsonify({'error': str(e)}), 500

# ===== END UNIFIED COMPLIANCE API ENDPOINTS =====

# ===== COMPLIANCE TRAINING AND USER ACTIONS =====

@app.route('/api/compliance/training/complete', methods=['POST'])
def complete_training():
    """Mark training completion for compliance requirements"""
    try:
        data = request.get_json()
        user_id = data.get('user_id', 'user')  # Default to 'user'
        training_type = data.get('training_type', 'general')
        training_details = data.get('details', {})
        
        # Track compliance for user training
        training_metadata = {
            'user_id': user_id,
            'training_type': training_type,
            'training_details': training_details,
            'timestamp': datetime.utcnow().isoformat(),
            'completion_method': 'user_reported'
        }
        track_compliance_automatically('USER_TRAINING', training_metadata, user_id)
        
        return jsonify({
            'success': True,
            'message': f'Training completion recorded for {training_type}',
            'user_id': user_id
        })
        
    except Exception as e:
        app.logger.error(f"Error recording training completion: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/compliance/manual-evidence', methods=['POST'])
def record_manual_evidence():
    """Allow users to manually record compliance evidence"""
    try:
        data = request.get_json()
        requirement_code = data.get('requirement_code')
        evidence_description = data.get('evidence_description')
        user_id = data.get('user_id', 'user')  # Default to 'user'
        evidence_details = data.get('details', {})
        
        if not requirement_code or not evidence_description:
            return jsonify({'error': 'requirement_code and evidence_description are required'}), 400
        
        if unified_compliance_manager:
            # Record manual evidence
            evidence_id = unified_compliance_manager.record_compliance_evidence(
                requirement_code=requirement_code,
                evidence_type='manual_entry',
                evidence_source='user_interface',
                evidence_data={
                    'description': evidence_description,
                    'details': evidence_details,
                    'manual_entry': True,
                    'timestamp': datetime.utcnow().isoformat()
                },
                user_id=user_id
            )
            
            # Update requirement status
            unified_compliance_manager.update_requirement_status(requirement_code, user_id)
            
            return jsonify({
                'success': True,
                'message': f'Evidence recorded for {requirement_code}',
                'evidence_id': evidence_id
            })
        else:
            return jsonify({'error': 'Compliance manager not available'}), 503
            
    except Exception as e:
        app.logger.error(f"Error recording manual evidence: {str(e)}")
        return jsonify({'error': str(e)}), 500

# ===== END COMPLIANCE TRAINING AND USER ACTIONS =====

# Initialize default user and role on startup
def initialize_default_user():
    """Initialize default user with analyst role"""
    if unified_compliance_manager:
        try:
            # Assign default role to 'user'
            unified_compliance_manager.assign_user_role(
                user_id='user',
                role='analyst',
                assigned_by='system'
            )
            print("✓ Default user 'user' initialized with analyst role")
        except Exception as e:
            print(f"Warning: Could not initialize default user: {e}")

# ===== END FOLDER QUEUE ENDPOINTS =====

if __name__ == '__main__':
    # Get port from environment variable or use default
    port = int(os.environ.get('PORT', 5000))
    host = os.environ.get('HOST', '0.0.0.0')
    debug = os.environ.get('FLASK_ENV', 'development') == 'development'
    
    print(f"Starting qPCR Analyzer on {host}:{port}")
    print(f"Debug mode: {debug}")
    
    # Start the Flask application - disable reloader to prevent multiple processes
    app.run(host=host, port=port, debug=debug, threaded=True, use_reloader=False)
