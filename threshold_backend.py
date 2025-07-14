"""
Threshold Backend Service
Handles threshold strategy updates and session management
Separate from main app.py to maintain clean architecture
"""

from flask import request, jsonify
from models import db, AnalysisSession, WellResult
import json


def create_threshold_routes(app):
    """Create threshold-related routes for the Flask app"""
    
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
        """Handle manual threshold input"""
        try:
            data = request.get_json()
            
            manual_threshold = data.get('manual_threshold')
            session_id = data.get('session_id')
            current_scale = data.get('current_scale', 'linear')
            
            try:
                threshold_value = float(manual_threshold)
                print(f"[THRESHOLD-MANUAL] Session: {session_id}, Value: {threshold_value}, Scale: {current_scale}")
                
                return jsonify({
                    'success': True,
                    'strategy': 'manual',
                    'threshold_value': threshold_value,
                    'scale': current_scale,
                    'message': f'Manual threshold {threshold_value} acknowledged'
                })
            except (ValueError, TypeError) as e:
                return jsonify({
                    'success': False,
                    'error': f'Invalid manual threshold value: {manual_threshold}'
                }), 400
                
        except Exception as e:
            print(f"[THRESHOLD-MANUAL] Error: {e}")
            return jsonify({
                'success': False,
                'error': f'Manual threshold failed: {str(e)}'
            }), 500
