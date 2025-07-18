"""
Threshold Backend Service
Handles threshold strategy updates and session management
Separate from main app.py to maintain clean architecture
"""

from flask import request, jsonify
from models import db, AnalysisSession, WellResult
from cqj_calcj_utils import calculate_cqj_calcj_for_well
import json
import traceback


def create_threshold_routes(app):
    """Create threshold-related routes for the Flask app"""
    
    @app.route('/debug/well-data/<int:session_id>', methods=['GET'])
    def debug_well_data(session_id):
        """Debug endpoint to inspect well data structure"""
        try:
            session = AnalysisSession.query.get(session_id)
            if not session:
                return jsonify({'error': f'Session {session_id} not found'}), 404
            
            wells = WellResult.query.filter_by(session_id=session_id).limit(5).all()  # Only first 5 wells
            debug_info = []
            
            for well in wells:
                well_data = {
                    'well_id': well.well_id,
                    'fluorophore': well.fluorophore,
                    'amplitude': well.amplitude,
                    'baseline': well.baseline,
                    'raw_rfu': json.loads(well.raw_rfu) if well.raw_rfu else [],
                    'raw_cycles': json.loads(well.raw_cycles) if well.raw_cycles else []
                }
                
                debug_info.append({
                    'db_well_id': well.well_id,
                    'well_id_type': type(well.well_id).__name__,
                    'well_id_value': repr(well.well_id),
                    'well_data_keys': list(well_data.keys()),
                    'well_data_well_id': well_data.get('well_id'),
                    'well_data_well_id_type': type(well_data.get('well_id')).__name__,
                    'fluorophore': well.fluorophore,
                    'sample_name': well.sample_name,
                    'has_raw_rfu': bool(well.raw_rfu),
                    'has_raw_cycles': bool(well.raw_cycles),
                    'raw_rfu_length': len(json.loads(well.raw_rfu)) if well.raw_rfu else 0,
                    'raw_cycles_length': len(json.loads(well.raw_cycles)) if well.raw_cycles else 0
                })
            
            return jsonify({
                'success': True,
                'session_id': session_id,
                'wells_count': len(wells),
                'debug_info': debug_info
            })
            
        except Exception as e:
            return jsonify({'error': str(e)}), 500
    
    @app.route('/debug/test-cqj/<int:session_id>/<string:well_id>', methods=['GET'])
    def debug_test_cqj(session_id, well_id):
        """Debug endpoint to test CQJ calculation for a specific well"""
        try:
            well = WellResult.query.filter_by(session_id=session_id, well_id=well_id).first()
            if not well:
                return jsonify({'error': f'Well {well_id} not found in session {session_id}'}), 404
            
            # Create well_data exactly as done in threshold update
            well_data = {
                'well_id': well.well_id,
                'fluorophore': well.fluorophore,
                'amplitude': well.amplitude,
                'baseline': well.baseline,
                'raw_rfu': json.loads(well.raw_rfu) if well.raw_rfu else [],
                'raw_cycles': json.loads(well.raw_cycles) if well.raw_cycles else []
            }
            
            # Test with a sample threshold
            test_threshold = 1000.0
            
            # Calculate CQJ directly
            from cqj_calcj_utils import calculate_cqj, calculate_calcj
            cqj_result = calculate_cqj(well_data, test_threshold)
            calcj_result = calculate_calcj(well_data, test_threshold)
            
            return jsonify({
                'success': True,
                'well_id': well_id,
                'well_data_structure': {
                    'keys': list(well_data.keys()),
                    'well_id': well_data.get('well_id'),
                    'well_id_type': type(well_data.get('well_id')).__name__,
                    'well_id_repr': repr(well_data.get('well_id')),
                    'fluorophore': well_data.get('fluorophore'),
                    'amplitude': well_data.get('amplitude'),
                    'raw_rfu_length': len(well_data.get('raw_rfu', [])),
                    'raw_cycles_length': len(well_data.get('raw_cycles', []))
                },
                'test_threshold': test_threshold,
                'cqj_result': cqj_result,
                'calcj_result': calcj_result
            })
            
        except Exception as e:
            import traceback
            return jsonify({
                'error': str(e),
                'traceback': traceback.format_exc()
            }), 500
    
    @app.route('/threshold/update', methods=['POST'])
    def update_threshold_strategy():
        """Handle threshold strategy updates from frontend"""
        try:
            data = request.get_json()
            
            # Extract parameters
            strategy = data.get('strategy')
            scale_mode = data.get('scale_mode', 'linear')
            session_id = data.get('session_id')
            current_scale = data.get('current_scale', 'linear')
            experiment_pattern = data.get('experiment_pattern')
            
            print(f"[THRESHOLD-BACKEND] Strategy: {strategy}, Scale: {scale_mode}, Session: {session_id}")
            
            # Return success response for frontend to handle calculations
            response = {
                'success': True,
                'strategy': strategy,
                'scale_mode': scale_mode,
                'session_id': session_id,
                'message': f'Threshold strategy "{strategy}" acknowledged by backend'
            }
            
            # If session_id provided, we could track strategy changes in database
            if session_id:
                try:
                    session = AnalysisSession.query.get(session_id)
                    if session:
                        # Could store threshold strategy in session metadata if needed
                        print(f"[THRESHOLD-BACKEND] Session {session_id} found: {session.filename}")
                        response['session_found'] = True
                    else:
                        print(f"[THRESHOLD-BACKEND] Session {session_id} not found")
                        response['session_found'] = False
                except Exception as session_error:
                    print(f"[THRESHOLD-BACKEND] Session lookup error: {session_error}")
                    response['session_error'] = str(session_error)
            
            return jsonify(response)
            
        except Exception as e:
            print(f"[THRESHOLD-BACKEND] Error: {e}")
            return jsonify({
                'success': False,
                'error': f'Threshold update failed: {str(e)}'
            }), 500
    
    @app.route('/threshold/manual', methods=['POST'])
    def handle_manual_threshold():
        """Handle manual threshold input with CQJ/CalcJ recalculation"""
        try:
            data = request.get_json()
            
            # Extract threshold parameters
            action = data.get('action', 'manual_threshold')
            channel = data.get('channel')
            scale = data.get('scale', 'linear')
            threshold = data.get('threshold')
            session_id = data.get('session_id')
            experiment_pattern = data.get('experiment_pattern')
            
            print(f"[THRESHOLD-MANUAL] Action: {action}, Channel: {channel}, Scale: {scale}, Threshold: {threshold}")
            
            if not channel or threshold is None:
                return jsonify({
                    'success': False,
                    'error': 'Missing required parameters: channel and threshold'
                }), 400
            
            try:
                threshold_value = float(threshold)
                
                # If session_id provided, recalculate CQJ/CalcJ for all wells in that session
                updated_results = {}
                if session_id:
                    updated_results = recalculate_session_cqj_calcj(
                        session_id, channel, scale, threshold_value, experiment_pattern
                    )
                
                response = {
                    'success': True,
                    'action': action,
                    'channel': channel,
                    'scale': scale,
                    'threshold_value': threshold_value,
                    'session_id': session_id,
                    'updated_results': updated_results,
                    'message': f'Manual threshold {threshold_value} applied to {channel} ({scale})'
                }
                
                if updated_results:
                    response['recalculated_wells'] = len(updated_results)
                    print(f"[THRESHOLD-MANUAL] Recalculated {len(updated_results)} wells")
                
                return jsonify(response)
                
            except (ValueError, TypeError) as e:
                return jsonify({
                    'success': False,
                    'error': f'Invalid threshold value: {threshold}'
                }), 400
                
        except Exception as e:
            print(f"[THRESHOLD-MANUAL] Error: {e}")
            traceback.print_exc()
            return jsonify({
                'success': False,
                'error': f'Manual threshold failed: {str(e)}'
            }), 500


def recalculate_session_cqj_calcj(session_id, channel, scale, threshold_value, experiment_pattern=None):
    """
    Recalculate CQJ/CalcJ values for all wells in a session with the new threshold
    Returns dict of updated well results
    """
    updated_results = {}
    
    try:
        print(f"[RECALC-CQJ] Starting recalculation for session {session_id}, channel {channel}")
        
        # Get session from database
        session = AnalysisSession.query.get(session_id)
        if not session:
            print(f"[RECALC-CQJ] Session {session_id} not found")
            return updated_results
        
        # Get all wells for this session
        wells = WellResult.query.filter_by(session_id=session_id).all()
        if not wells:
            print(f"[RECALC-CQJ] No wells found for session {session_id}")
            return updated_results
        
        print(f"[RECALC-CQJ] Found {len(wells)} wells in session")
        
        # Debug: Show all wells in session
        for well in wells:
            print(f"[RECALC-CQJ] Available well: {well.well_id}, fluorophore: {well.fluorophore}")
        
        # Process each well
        for well in wells:
            try:
                # Parse well data
                well_data = {
                    'well_id': well.well_id,
                    'fluorophore': well.fluorophore,
                    'amplitude': well.amplitude,
                    'baseline': well.baseline,
                    'raw_rfu': json.loads(well.raw_rfu) if well.raw_rfu else [],
                    'raw_cycles': json.loads(well.raw_cycles) if well.raw_cycles else []
                }
                
                # Only recalculate for wells matching the channel
                if well_data['fluorophore'] != channel:
                    print(f"[RECALC-CQJ] Skipping well {well.well_id}: fluorophore '{well_data['fluorophore']}' != channel '{channel}'")
                    continue
                
                print(f"[RECALC-CQJ] Processing well {well.well_id} for channel {channel}")
                
                # Calculate new CQJ/CalcJ values
                recalc_result = calculate_cqj_calcj_for_well(well_data, 'manual', threshold_value)
                
                print(f"[RECALC-CQJ] Calculation result for {well.well_id}: {recalc_result}")
                
                if recalc_result:
                    # Update well in database
                    well.cqj_value = recalc_result.get('cqj_value')
                    well.calcj_value = recalc_result.get('calcj_value')
                    
                    # Update JSON fields if they exist
                    if well.cqj and recalc_result.get('cqj'):
                        cqj_data = json.loads(well.cqj) if isinstance(well.cqj, str) else well.cqj
                        cqj_data.update(recalc_result['cqj'])
                        well.cqj = json.dumps(cqj_data)
                    
                    if well.calcj and recalc_result.get('calcj'):
                        calcj_data = json.loads(well.calcj) if isinstance(well.calcj, str) else well.calcj
                        calcj_data.update(recalc_result['calcj'])
                        well.calcj = json.dumps(calcj_data)
                    
                    # Prepare result for frontend
                    updated_results[well.well_id] = {
                        'cqj_value': recalc_result.get('cqj_value'),
                        'calcj_value': recalc_result.get('calcj_value'),
                        'threshold_value': threshold_value,
                        'fluorophore': channel,
                        'scale': scale
                    }
                    
                    print(f"[RECALC-CQJ] Updated {well.well_id}: CQJ={recalc_result.get('cqj_value')}, CalcJ={recalc_result.get('calcj_value')}")
                
            except Exception as well_error:
                print(f"[RECALC-CQJ] Error processing well {well.well_id}: {well_error}")
                continue
        
        # Commit all changes
        db.session.commit()
        print(f"[RECALC-CQJ] Successfully updated {len(updated_results)} wells")
        
    except Exception as e:
        print(f"[RECALC-CQJ] Error during recalculation: {e}")
        traceback.print_exc()
        db.session.rollback()
    
    return updated_results
