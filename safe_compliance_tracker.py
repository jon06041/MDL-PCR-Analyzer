#!/usr/bin/env python3
"""
Non-Blocking Compliance Tracking System
Solves database locking issues during ML feedback submission
"""

import threading
import queue
import time
import sqlite3
import json
import os
from datetime import datetime
from typing import Dict, Any, Optional

class NonBlockingComplianceTracker:
    """
    Thread-safe compliance tracker that queues events and processes them in background
    Prevents database locking during critical operations like ML feedback submission
    """
    
    def __init__(self, db_path='qpcr_analysis.db', max_queue_size=1000):
        self.db_path = db_path
        self.event_queue = queue.Queue(maxsize=max_queue_size)
        self.worker_thread = None
        self.running = False
        self.processed_count = 0
        self.error_count = 0
        
        # Start background worker
        self.start_worker()
    
    def start_worker(self):
        """Start the background worker thread"""
        if self.worker_thread is None or not self.worker_thread.is_alive():
            self.running = True
            self.worker_thread = threading.Thread(
                target=self._worker_loop, 
                daemon=True,
                name="ComplianceTracker"
            )
            self.worker_thread.start()
            print("✅ Non-blocking compliance tracker started")
    
    def stop_worker(self):
        """Stop the background worker thread"""
        self.running = False
        if self.worker_thread and self.worker_thread.is_alive():
            self.worker_thread.join(timeout=5.0)
            print("🛑 Non-blocking compliance tracker stopped")
    
    def _worker_loop(self):
        """Background worker loop that processes compliance events"""
        while self.running:
            try:
                # Get event from queue with timeout
                event = self.event_queue.get(timeout=1.0)
                
                # Process the compliance event
                self._process_compliance_event(event)
                self.processed_count += 1
                
                # Mark task as done
                self.event_queue.task_done()
                
            except queue.Empty:
                # No events in queue, continue loop
                continue
            except Exception as e:
                self.error_count += 1
                print(f"⚠️ Error processing compliance event: {e}")
    
    def _process_compliance_event(self, event: Dict[str, Any]):
        """Process a single compliance event in the database"""
        try:
            # Use a separate connection for background processing
            conn = sqlite3.connect(self.db_path, timeout=30.0)
            cursor = conn.cursor()
            
            # Extract event data
            event_type = event.get('event_type')
            event_data = event.get('event_data', {})
            user_id = event.get('user_id', 'system')
            timestamp = event.get('timestamp', datetime.utcnow().isoformat())
            
            # Map event to compliance requirements
            requirements = self._map_event_to_requirements(event_type, event_data)
            
            # Insert compliance evidence for each requirement using correct schema
            for req_code in requirements:
                evidence_data = {
                    'event_type': event_type,
                    'event_data': event_data,
                    'timestamp': timestamp
                }
                
                cursor.execute("""
                    INSERT INTO compliance_evidence 
                    (requirement_code, evidence_type, evidence_source, evidence_data, user_id, compliance_score)
                    VALUES (?, ?, ?, ?, ?, ?)
                """, (
                    req_code,
                    'automated_log',
                    f'qpcr_analyzer_{event_type}',
                    json.dumps(evidence_data),
                    user_id,
                    85  # Standard compliance score for automated tracking
                ))
            
            conn.commit()
            conn.close()
            
            if requirements:
                print(f"✓ Background compliance: {event_type} → {len(requirements)} requirements")
                
        except Exception as e:
            print(f"⚠️ Error in background compliance processing: {e}")
            if 'conn' in locals():
                conn.close()
    
    def _map_event_to_requirements(self, event_type: str, event_data: Dict[str, Any]) -> list:
        """Map events to specific compliance requirements"""
        requirements = []
        
        # FDA 21 CFR Part 11 mappings
        if event_type in ['ANALYSIS_COMPLETED', 'QC_ANALYZED']:
            requirements.extend(['CFR_11_10_A', 'CFR_11_10_C'])
            
        if event_type in ['DATA_EXPORTED', 'FILE_UPLOADED', 'DATA_MODIFIED']:
            requirements.extend(['CFR_11_10_B', 'CFR_11_10_D'])
            
        if event_type in ['REPORT_GENERATED']:
            requirements.extend(['CFR_11_10_C', 'CFR_11_10_D'])
        
        # ML/AI compliance mappings
        if event_type in ['ML_MODEL_TRAINED', 'ML_PREDICTION_MADE']:
            requirements.extend(['AI_ML_VALIDATION', 'AI_ML_VERSION_CONTROL'])
            
        if event_type in ['ML_FEEDBACK_SUBMITTED', 'ML_ACCURACY_VALIDATED']:
            requirements.extend(['AI_ML_PERFORMANCE_MONITORING', 'AI_ML_TRAINING_VALIDATION'])
            
        if event_type in ['ML_MODEL_RETRAINED', 'ML_VERSION_CONTROL']:
            requirements.extend(['AI_ML_VERSION_CONTROL', 'AI_ML_AUDIT_COMPLIANCE'])
        
        # CLIA mappings
        if event_type in ['QC_ANALYZED', 'CONTROL_ANALYZED', 'NEGATIVE_CONTROL_VERIFIED']:
            requirements.extend(['CLIA_493_1251', 'CLIA_493_1252', 'CLIA_493_1253'])
            
        if event_type in ['ANALYSIS_COMPLETED', 'RESULT_VERIFIED']:
            requirements.append('CLIA_493_1281')
        
        # CAP mappings
        if event_type in ['SYSTEM_VALIDATION', 'ANALYSIS_COMPLETED']:
            requirements.append('CAP_GEN_43400')
            
        if event_type in ['DATA_EXPORTED', 'CALCULATION_PERFORMED']:
            requirements.append('CAP_GEN_43420')
            
        if event_type in ['QC_ANALYZED', 'CONTROL_ANALYZED']:
            requirements.append('CAP_GEN_40425')
        
        # ISO 15189 mappings
        if event_type in ['SYSTEM_VALIDATION', 'QC_ANALYZED']:
            requirements.extend(['ISO_15189_5_5_1', 'ISO_15189_5_8_2'])
            
        if event_type in ['DATA_EXPORTED', 'REPORT_GENERATED']:
            requirements.append('ISO_15189_4_14_7')
        
        return list(set(requirements))  # Remove duplicates
    
    def track_event_async(self, event_type: str, event_data: Dict[str, Any], user_id: str = 'user') -> bool:
        """
        Queue a compliance event for background processing (non-blocking)
        Returns True if successfully queued, False if queue is full
        """
        try:
            event = {
                'event_type': event_type,
                'event_data': event_data,
                'user_id': user_id,
                'timestamp': datetime.utcnow().isoformat()
            }
            
            # Add to queue without blocking
            self.event_queue.put_nowait(event)
            return True
            
        except queue.Full:
            print(f"⚠️ Compliance queue full! Dropping event: {event_type}")
            return False
        except Exception as e:
            print(f"⚠️ Error queuing compliance event: {e}")
            return False
    
    def get_status(self) -> Dict[str, Any]:
        """Get status of the compliance tracker"""
        return {
            'running': self.running,
            'queue_size': self.event_queue.qsize(),
            'processed_count': self.processed_count,
            'error_count': self.error_count,
            'worker_alive': self.worker_thread.is_alive() if self.worker_thread else False
        }
    
    def flush_queue(self, timeout: float = 10.0):
        """Wait for all queued events to be processed"""
        try:
            self.event_queue.join()  # Wait for all tasks to complete
        except:
            pass

# Global instance
_global_tracker = None

def get_compliance_tracker() -> NonBlockingComplianceTracker:
    """Get the global compliance tracker instance"""
    global _global_tracker
    if _global_tracker is None:
        _global_tracker = NonBlockingComplianceTracker()
    return _global_tracker

def track_compliance_event_safe(event_type: str, event_data: Dict[str, Any], user_id: str = 'user') -> bool:
    """
    Safe, non-blocking compliance tracking that won't interfere with ML feedback
    Use this instead of the old track_compliance_automatically function
    """
    try:
        tracker = get_compliance_tracker()
        return tracker.track_event_async(event_type, event_data, user_id)
    except Exception as e:
        print(f"⚠️ Safe compliance tracking error: {e}")
        return False

def track_ml_compliance_safe(event_type: str, ml_data: Dict[str, Any], user_id: str = 'user') -> bool:
    """
    Safe ML compliance tracking that won't cause database locks
    Use this instead of the old track_ml_compliance function
    """
    try:
        # Enhanced ML data with compliance metadata
        enhanced_data = {
            **ml_data,
            'compliance_category': 'ML_Validation',
            'software_component': 'ml_classifier'
        }
        
        tracker = get_compliance_tracker()
        return tracker.track_event_async(event_type, enhanced_data, user_id)
    except Exception as e:
        print(f"⚠️ Safe ML compliance tracking error: {e}")
        return False

if __name__ == "__main__":
    # Test the non-blocking compliance tracker
    print("🧪 Testing Non-Blocking Compliance Tracker...")
    
    tracker = get_compliance_tracker()
    
    # Test various events
    test_events = [
        ('ML_PREDICTION_MADE', {'pathogen': 'NGON', 'accuracy': 0.95}),
        ('QC_ANALYZED', {'control_type': 'positive', 'result': 'pass'}),
        ('ANALYSIS_COMPLETED', {'sample_count': 96, 'duration': 45.2}),
        ('ML_FEEDBACK_SUBMITTED', {'sample_id': 'test123', 'feedback': 'correct'}),
        ('DATA_EXPORTED', {'export_format': 'CSV', 'record_count': 100})
    ]
    
    # Queue test events
    for event_type, data in test_events:
        success = track_compliance_event_safe(event_type, data)
        print(f"  {'✓' if success else '✗'} Queued: {event_type}")
    
    # Wait for processing
    print("\n⏳ Processing events...")
    time.sleep(3)
    
    # Show status
    status = tracker.get_status()
    print(f"\n📊 Tracker Status:")
    print(f"  Running: {status['running']}")
    print(f"  Queue Size: {status['queue_size']}")
    print(f"  Processed: {status['processed_count']}")
    print(f"  Errors: {status['error_count']}")
    
    print("\n✅ Non-blocking compliance tracker test complete!")
