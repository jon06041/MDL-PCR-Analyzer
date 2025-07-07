from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
import json

db = SQLAlchemy()

class AnalysisSession(db.Model):
    """Store information about each analysis session"""
    __tablename__ = 'analysis_sessions'
    
    id = db.Column(db.Integer, primary_key=True)
    filename = db.Column(db.String(255), nullable=False)
    upload_timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    total_wells = db.Column(db.Integer, nullable=False)
    good_curves = db.Column(db.Integer, nullable=False)
    success_rate = db.Column(db.Float, nullable=False)
    cycle_min = db.Column(db.Integer)
    cycle_max = db.Column(db.Integer)
    cycle_count = db.Column(db.Integer)
    pathogen_breakdown = db.Column(db.Text)  # Store pathogen breakdown display string
    
    # Relationship to well results
    well_results = db.relationship('WellResult', backref='session', lazy=True, cascade='all, delete-orphan')
    
    def to_dict(self):
        return {
            'id': self.id,
            'filename': self.filename,
            'upload_timestamp': self.upload_timestamp.isoformat(),
            'total_wells': self.total_wells,
            'good_curves': self.good_curves,
            'success_rate': self.success_rate,
            'cycle_range': f"{self.cycle_min}-{self.cycle_max}" if self.cycle_min and self.cycle_max else None,
            'cycle_count': self.cycle_count,
            'pathogen_breakdown': self.pathogen_breakdown
        }

class WellResult(db.Model):
    """Store detailed results for each well"""
    __tablename__ = 'well_results'
    
    id = db.Column(db.Integer, primary_key=True)
    session_id = db.Column(db.Integer, db.ForeignKey('analysis_sessions.id'), nullable=False)
    well_id = db.Column(db.String(50), nullable=False)
    fluorophore = db.Column(db.String(20))  # Store fluorophore directly
    
    # Analysis results
    is_good_scurve = db.Column(db.Boolean, nullable=False)
    r2_score = db.Column(db.Float)
    rmse = db.Column(db.Float)
    amplitude = db.Column(db.Float)
    steepness = db.Column(db.Float)
    midpoint = db.Column(db.Float)
    baseline = db.Column(db.Float)
    data_points = db.Column(db.Integer)
    cycle_range = db.Column(db.Float)
    
    # JSON fields for complex data
    fit_parameters = db.Column(db.Text)  # JSON string
    parameter_errors = db.Column(db.Text)  # JSON string
    fitted_curve = db.Column(db.Text)  # JSON string
    anomalies = db.Column(db.Text)  # JSON string
    raw_cycles = db.Column(db.Text)  # JSON string
    raw_rfu = db.Column(db.Text)  # JSON string
    cq_value = db.Column(db.Float)  # Integrated Cq value
    sample_name = db.Column(db.String(255))  # Integrated sample name
    threshold_value = db.Column(db.Float)  # Threshold value for annotation
    
    def to_dict(self):
        # Get fluorophore from dedicated column first
        fluorophore = self.fluorophore or 'Unknown'
        
        # Fallback 1: Extract from fit_parameters 
        if fluorophore == 'Unknown' and self.fit_parameters:
            try:
                fit_params = json.loads(self.fit_parameters)
                fluorophore = fit_params.get('fluorophore', 'Unknown')
            except (json.JSONDecodeError, AttributeError):
                pass
        
        # Fallback 2: extract from well_id
        if fluorophore == 'Unknown' and self.well_id and '_' in self.well_id:
            fluorophore = self.well_id.split('_')[1]
        
        # Robust JSON parsing with fallback to [] or {}
        def parse_json_array(val):
            try:
                if val is None:
                    return []
                parsed = json.loads(val) if isinstance(val, str) else val
                return parsed if isinstance(parsed, list) else []
            except Exception:
                return []
        def parse_json_object(val):
            try:
                if val is None:
                    return {}
                parsed = json.loads(val) if isinstance(val, str) else val
                return parsed if isinstance(parsed, dict) else {}
            except Exception:
                return {}
        return {
            'id': self.id,
            'session_id': self.session_id,
            'well_id': self.well_id,
            'fluorophore': fluorophore,  # Add fluorophore for pathogen mapping
            'is_good_scurve': self.is_good_scurve,
            'r2_score': self.r2_score,
            'rmse': self.rmse,
            'amplitude': self.amplitude,
            'steepness': self.steepness,
            'midpoint': self.midpoint,
            'baseline': self.baseline,
            'data_points': self.data_points,
            'cycle_range': self.cycle_range,
            'fit_parameters': parse_json_object(self.fit_parameters),
            'parameter_errors': parse_json_object(self.parameter_errors),
            'fitted_curve': parse_json_array(self.fitted_curve),
            'anomalies': parse_json_array(self.anomalies),
            'raw_cycles': parse_json_array(self.raw_cycles),
            'raw_rfu': parse_json_array(self.raw_rfu),
            'cq_value': self.cq_value,
            'sample_name': self.sample_name,
            'threshold_value': self.threshold_value
        }
    
    @classmethod
    def from_analysis_result(cls, session_id, well_id, analysis_result, raw_data):
        """Create WellResult from analysis output"""
        return cls(
            session_id=session_id,
            well_id=well_id,
            is_good_scurve=analysis_result.get('is_good_scurve', False),
            r2_score=analysis_result.get('r2_score'),
            rmse=analysis_result.get('rmse'),
            amplitude=analysis_result.get('amplitude'),
            steepness=analysis_result.get('steepness'),
            midpoint=analysis_result.get('midpoint'),
            baseline=analysis_result.get('baseline'),
            data_points=analysis_result.get('data_points'),
            cycle_range=analysis_result.get('cycle_range'),
            fit_parameters=json.dumps(analysis_result.get('fit_parameters', [])),
            parameter_errors=json.dumps(analysis_result.get('parameter_errors', [])),
            fitted_curve=json.dumps(analysis_result.get('fitted_curve', [])),
            anomalies=json.dumps(analysis_result.get('anomalies', [])),
            raw_cycles=json.dumps(raw_data.get('cycles', [])),
            raw_rfu=json.dumps(raw_data.get('rfu', [])),
            cq_value=raw_data.get('cq'),
            sample_name=raw_data.get('sampleName')
        )


class ExperimentStatistics(db.Model):
    """Store fluorophore statistics for trend analysis"""
    __tablename__ = 'experiment_statistics'
    
    id = db.Column(db.Integer, primary_key=True)
    experiment_name = db.Column(db.String(255), nullable=False, unique=True, index=True)  # e.g., AcBVAB_2578825_CFX367393
    test_name = db.Column(db.String(100), nullable=False, index=True)  # e.g., AcBVAB
    analysis_timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Store as JSON for multiple fluorophore statistics
    fluorophore_stats = db.Column(db.Text, nullable=False)  # JSON: {fluorophore: {subtest, total_wells, positive, negative, redo, pos_percentage}}
    
    def to_dict(self):
        return {
            'id': self.id,
            'experiment_name': self.experiment_name,
            'test_name': self.test_name,
            'analysis_timestamp': self.analysis_timestamp.isoformat() if self.analysis_timestamp else None,
            'fluorophore_stats': json.loads(self.fluorophore_stats) if self.fluorophore_stats else {}
        }
    
    @classmethod
    def create_or_update(cls, experiment_name, test_name, fluorophore_breakdown):
        """Create new or update existing experiment statistics"""
        try:
            # Check if experiment already exists
            existing = cls.query.filter_by(experiment_name=experiment_name).first()
            
            # Prepare fluorophore stats with subtests (fluorophore = subtest)
            stats = {}
            for fluorophore, breakdown in fluorophore_breakdown.items():
                # Handle both field name variations (total vs total_wells)
                total_wells = breakdown.get('total_wells', breakdown.get('total', 0))
                pos_percentage = breakdown.get('pos_percentage', 0.0)
                
                # Calculate percentage if not provided
                if total_wells > 0 and pos_percentage == 0.0:
                    positive = breakdown.get('positive', 0)
                    pos_percentage = (positive / total_wells) * 100
                
                stats[fluorophore] = {
                    'subtest': fluorophore,  # Each fluorophore channel is a subtest
                    'total_wells': total_wells,
                    'positive': breakdown.get('positive', 0),
                    'negative': breakdown.get('negative', 0),
                    'redo': breakdown.get('redo', 0),
                    'pos_percentage': pos_percentage
                }
            
            if existing:
                # Update existing record
                existing.test_name = test_name
                existing.analysis_timestamp = datetime.utcnow()
                existing.fluorophore_stats = json.dumps(stats)
                print(f"Updated existing experiment statistics for: {experiment_name}")
            else:
                # Create new record
                new_stats = cls(
                    experiment_name=experiment_name,
                    test_name=test_name,
                    fluorophore_stats=json.dumps(stats)
                )
                db.session.add(new_stats)
                print(f"Created new experiment statistics for: {experiment_name}")
            
            db.session.commit()
            return True
            
        except Exception as e:
            db.session.rollback()
            print(f"Error creating/updating experiment statistics: {e}")
            return False

class ChannelCompletionStatus(db.Model):
    """Track completion status of individual channels in multichannel processing"""
    __tablename__ = 'channel_completion_status'
    
    id = db.Column(db.Integer, primary_key=True)
    experiment_pattern = db.Column(db.String(255), nullable=False)  # e.g., "AcBVAB_2578825_CFX367393"
    fluorophore = db.Column(db.String(20), nullable=False)  # e.g., "Cy5", "FAM", "HEX", "Texas Red"
    test_code = db.Column(db.String(50), nullable=False)  # e.g., "BVAB"
    pathogen_target = db.Column(db.String(100))  # e.g., "BVAB3"
    
    # Processing status
    status = db.Column(db.String(20), nullable=False, default='pending')  # pending, processing, completed, failed
    session_id = db.Column(db.Integer, db.ForeignKey('analysis_sessions.id'))  # Link to completed session
    
    # Timestamps
    started_at = db.Column(db.DateTime, default=datetime.utcnow)
    completed_at = db.Column(db.DateTime)
    
    # Processing details
    total_wells = db.Column(db.Integer)
    good_curves = db.Column(db.Integer)
    success_rate = db.Column(db.Float)
    error_message = db.Column(db.Text)  # Store error details if failed
    
    # JSON data integrity flags
    json_data_validated = db.Column(db.Boolean, default=False)
    threshold_data_ready = db.Column(db.Boolean, default=False)
    control_grid_data_ready = db.Column(db.Boolean, default=False)
    
    def to_dict(self):
        return {
            'id': self.id,
            'experiment_pattern': self.experiment_pattern,
            'fluorophore': self.fluorophore,
            'test_code': self.test_code,
            'pathogen_target': self.pathogen_target,
            'status': self.status,
            'session_id': self.session_id,
            'started_at': self.started_at.isoformat() if self.started_at else None,
            'completed_at': self.completed_at.isoformat() if self.completed_at else None,
            'total_wells': self.total_wells,
            'good_curves': self.good_curves,
            'success_rate': self.success_rate,
            'error_message': self.error_message,
            'json_data_validated': self.json_data_validated,
            'threshold_data_ready': self.threshold_data_ready,
            'control_grid_data_ready': self.control_grid_data_ready
        }
    
    @classmethod
    def get_experiment_completion_status(cls, experiment_pattern):
        """Get completion status for all channels of an experiment"""
        channels = cls.query.filter_by(experiment_pattern=experiment_pattern).all()
        return {
            'channels': [channel.to_dict() for channel in channels],
            'total_channels': len(channels),
            'completed_channels': len([c for c in channels if c.status == 'completed']),
            'failed_channels': len([c for c in channels if c.status == 'failed']),
            'is_complete': all(c.status == 'completed' for c in channels) and len(channels) > 0
        }
    
    @classmethod
    def mark_channel_started(cls, experiment_pattern, fluorophore, test_code, pathogen_target=None):
        """Mark a channel as started processing"""
        try:
            # Check if already exists
            existing = cls.query.filter_by(
                experiment_pattern=experiment_pattern,
                fluorophore=fluorophore
            ).first()
            
            if existing:
                # Update existing record
                existing.status = 'processing'
                existing.started_at = datetime.utcnow()
                existing.test_code = test_code
                existing.pathogen_target = pathogen_target
                existing.error_message = None
            else:
                # Create new record
                new_channel = cls(
                    experiment_pattern=experiment_pattern,
                    fluorophore=fluorophore,
                    test_code=test_code,
                    pathogen_target=pathogen_target,
                    status='processing'
                )
                db.session.add(new_channel)
            
            db.session.commit()
            return True
            
        except Exception as e:
            db.session.rollback()
            print(f"Error marking channel started: {e}")
            return False
    
    @classmethod
    def mark_channel_completed(cls, experiment_pattern, fluorophore, session_id, 
                              total_wells=None, good_curves=None, success_rate=None):
        """Mark a channel as completed with validation flags"""
        try:
            channel = cls.query.filter_by(
                experiment_pattern=experiment_pattern,
                fluorophore=fluorophore
            ).first()
            
            if not channel:
                print(f"Channel not found: {experiment_pattern} - {fluorophore}")
                return False
            
            # Update completion status
            channel.status = 'completed'
            channel.completed_at = datetime.utcnow()
            channel.session_id = session_id
            channel.total_wells = total_wells
            channel.good_curves = good_curves
            channel.success_rate = success_rate
            
            # Validate JSON data integrity
            if session_id:
                from app import db as app_db
                session = AnalysisSession.query.get(session_id)
                if session and session.well_results:
                    channel.json_data_validated = True
                    channel.threshold_data_ready = True
                    channel.control_grid_data_ready = True
            
            db.session.commit()
            return True
            
        except Exception as e:
            db.session.rollback()
            print(f"Error marking channel completed: {e}")
            return False
    
    @classmethod
    def mark_channel_failed(cls, experiment_pattern, fluorophore, error_message):
        """Mark a channel as failed"""
        try:
            channel = cls.query.filter_by(
                experiment_pattern=experiment_pattern,
                fluorophore=fluorophore
            ).first()
            
            if not channel:
                print(f"Channel not found: {experiment_pattern} - {fluorophore}")
                return False
            
            channel.status = 'failed'
            channel.completed_at = datetime.utcnow()
            channel.error_message = error_message
            
            db.session.commit()
            return True
            
        except Exception as e:
            db.session.rollback()
            print(f"Error marking channel failed: {e}")
            return False