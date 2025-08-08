"""
Safe Compliance Tracker
Non-blocking compliance tracking that prevents database conflicts and system failures
"""

import logging
import threading
import queue
import time
from typing import Dict, Any, Optional
from datetime import datetime

class SafeComplianceTracker:
    """
    Thread-safe, non-blocking compliance tracker that queues events
    and processes them asynchronously to prevent database conflicts
    """
    
    def __init__(self, max_queue_size: int = 1000):
        self.max_queue_size = max_queue_size
        self.event_queue = queue.Queue(maxsize=max_queue_size)
        self.ml_queue = queue.Queue(maxsize=max_queue_size)
        self.logger = logging.getLogger(__name__)
        self.running = True
        
        # Start background processing threads
        self._start_processors()
    
    def _start_processors(self):
        """Start background threads to process queued events"""
        # Regular compliance event processor
        self.event_thread = threading.Thread(
            target=self._process_compliance_events,
            daemon=True
        )
        self.event_thread.start()
        
        # ML compliance event processor
        self.ml_thread = threading.Thread(
            target=self._process_ml_events,
            daemon=True
        )
        self.ml_thread.start()
    
    def _process_compliance_events(self):
        """Background thread to process regular compliance events"""
        while self.running:
            try:
                # Get event from queue with timeout
                event = self.event_queue.get(timeout=1.0)
                self._safe_process_event(event)
                self.event_queue.task_done()
            except queue.Empty:
                continue
            except Exception as e:
                self.logger.error(f"Error processing compliance event: {e}")
    
    def _process_ml_events(self):
        """Background thread to process ML compliance events"""
        while self.running:
            try:
                # Get event from queue with timeout
                event = self.ml_queue.get(timeout=1.0)
                self._safe_process_ml_event(event)
                self.ml_queue.task_done()
            except queue.Empty:
                continue
            except Exception as e:
                self.logger.error(f"Error processing ML compliance event: {e}")
    
    def _safe_process_event(self, event: Dict[str, Any]):
        """Safely process a compliance event with error handling"""
        try:
            # Try to use the MySQL unified compliance manager if available
            try:
                from mysql_unified_compliance_manager import MySQLUnifiedComplianceManager
                import os
                # Get MySQL config from environment variables (same as app.py)
                mysql_config = {
                    'host': os.environ.get('MYSQL_HOST', '127.0.0.1'),
                    'port': int(os.environ.get('MYSQL_PORT', 3306)),
                    'user': os.environ.get('MYSQL_USER', 'qpcr_user'),
                    'password': os.environ.get('MYSQL_PASSWORD', 'qpcr_password'),
                    'database': os.environ.get('MYSQL_DATABASE', 'qpcr_analysis'),
                    'charset': 'utf8mb4'
                }
                manager = MySQLUnifiedComplianceManager(mysql_config)
                manager.track_compliance_event(
                    event_type=event['event_type'],
                    event_data=event['event_data'],
                    user_id=event.get('user_id', 'user')
                )
                self.logger.info(f"✓ Processed compliance event: {event['event_type']}")
            except Exception as db_error:
                # If database fails, just log the event
                self.logger.warning(f"Database unavailable, logging event: {event['event_type']} - {db_error}")
                self._log_compliance_event(event)
        except Exception as e:
            self.logger.error(f"Failed to process compliance event: {e}")
    
    def _safe_process_ml_event(self, event: Dict[str, Any]):
        """Safely process an ML compliance event with error handling"""
        try:
            # Try to use the MySQL unified compliance manager if available
            try:
                from mysql_unified_compliance_manager import MySQLUnifiedComplianceManager
                import os
                # Get MySQL config from environment variables (same as app.py)
                mysql_config = {
                    'host': os.environ.get('MYSQL_HOST', '127.0.0.1'),
                    'port': int(os.environ.get('MYSQL_PORT', 3306)),
                    'user': os.environ.get('MYSQL_USER', 'qpcr_user'),
                    'password': os.environ.get('MYSQL_PASSWORD', 'qpcr_password'),
                    'database': os.environ.get('MYSQL_DATABASE', 'qpcr_analysis'),
                    'charset': 'utf8mb4'
                }
                manager = MySQLUnifiedComplianceManager(mysql_config)
                manager.track_compliance_event(
                    event_type=event['event_type'],
                    event_data=event['event_data'],
                    user_id=event.get('user_id', 'user')
                )
                self.logger.info(f"✓ Processed ML compliance event: {event['event_type']}")
            except Exception as db_error:
                # If database fails, just log the event
                self.logger.warning(f"Database unavailable, logging ML event: {event['event_type']} - {db_error}")
                self._log_ml_event(event)
        except Exception as e:
            self.logger.error(f"Failed to process ML compliance event: {e}")
    
    def _log_compliance_event(self, event: Dict[str, Any]):
        """Log compliance event to file when database is unavailable"""
        try:
            timestamp = datetime.now().isoformat()
            log_entry = f"{timestamp} | COMPLIANCE | {event['event_type']} | {event.get('user_id', 'user')} | {event['event_data']}\n"
            
            with open('compliance_fallback.log', 'a') as f:
                f.write(log_entry)
        except Exception as e:
            self.logger.error(f"Failed to write fallback compliance log: {e}")
    
    def _log_ml_event(self, event: Dict[str, Any]):
        """Log ML event to file when database is unavailable"""
        try:
            timestamp = datetime.now().isoformat()
            log_entry = f"{timestamp} | ML_COMPLIANCE | {event['event_type']} | {event.get('user_id', 'user')} | {event['event_data']}\n"
            
            with open('ml_compliance_fallback.log', 'a') as f:
                f.write(log_entry)
        except Exception as e:
            self.logger.error(f"Failed to write fallback ML compliance log: {e}")
    
    def track_event_safe(self, event_type: str, event_data: Dict[str, Any], user_id: str = 'user') -> bool:
        """
        Safely queue a compliance event for background processing
        Returns True if successfully queued, False if queue is full
        """
        try:
            event = {
                'event_type': event_type,
                'event_data': event_data,
                'user_id': user_id,
                'timestamp': datetime.now().isoformat()
            }
            
            self.event_queue.put_nowait(event)
            return True
        except queue.Full:
            self.logger.warning(f"Compliance event queue full, dropping event: {event_type}")
            return False
        except Exception as e:
            self.logger.error(f"Error queuing compliance event: {e}")
            return False
    
    def track_ml_event_safe(self, event_type: str, ml_data: Dict[str, Any], user_id: str = 'user') -> bool:
        """
        Safely queue an ML compliance event for background processing
        Returns True if successfully queued, False if queue is full
        """
        try:
            event = {
                'event_type': event_type,
                'event_data': ml_data,
                'user_id': user_id,
                'timestamp': datetime.now().isoformat()
            }
            
            self.ml_queue.put_nowait(event)
            return True
        except queue.Full:
            self.logger.warning(f"ML compliance event queue full, dropping event: {event_type}")
            return False
        except Exception as e:
            self.logger.error(f"Error queuing ML compliance event: {e}")
            return False
    
    def shutdown(self):
        """Gracefully shutdown the tracker"""
        self.running = False
        
        # Wait for queues to empty
        try:
            self.event_queue.join()
            self.ml_queue.join()
        except Exception as e:
            self.logger.error(f"Error during shutdown: {e}")

# Global instance
_tracker = None

def get_tracker() -> SafeComplianceTracker:
    """Get or create the global safe compliance tracker"""
    global _tracker
    if _tracker is None:
        _tracker = SafeComplianceTracker()
    return _tracker

# Convenience functions that match the expected API
def track_compliance_event_safe(event_type: str, event_data: Dict[str, Any], user_id: str = 'user') -> bool:
    """Safe, non-blocking compliance event tracking"""
    tracker = get_tracker()
    return tracker.track_event_safe(event_type, event_data, user_id)

def track_ml_compliance_safe(event_type: str, ml_data: Dict[str, Any], user_id: str = 'user') -> bool:
    """Safe, non-blocking ML compliance event tracking"""
    tracker = get_tracker()
    return tracker.track_ml_event_safe(event_type, ml_data, user_id)

# Cleanup function for application shutdown
def shutdown_safe_tracker():
    """Shutdown the safe compliance tracker"""
    global _tracker
    if _tracker is not None:
        _tracker.shutdown()
        _tracker = None
