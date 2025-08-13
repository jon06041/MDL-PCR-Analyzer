"""
ML Training Pause/Resume Management
Allows QC and Research users to pause ML training during exploratory sessions
"""

import mysql.connector
import os
import json
import datetime
from typing import Dict, Optional

class MLTrainingManager:
    """Manages ML training pause/resume functionality"""
    
    def __init__(self):
        self.mysql_config = {
            'host': os.environ.get('MYSQL_HOST', 'localhost'),
            'user': os.environ.get('MYSQL_USER', 'qpcr_user'),
            'password': os.environ.get('MYSQL_PASSWORD', 'qpcr_password'),
            'database': os.environ.get('MYSQL_DATABASE', 'qpcr_analysis'),
            'autocommit': True
        }
        self._initialize_training_state_table()
    
    def _initialize_training_state_table(self):
        """Initialize the ML training state tracking table"""
        try:
            connection = mysql.connector.connect(**self.mysql_config)
            cursor = connection.cursor()
            
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS ml_training_state (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    user_id VARCHAR(255) NOT NULL,
                    username VARCHAR(255) NOT NULL,
                    session_id VARCHAR(255) NOT NULL,
                    is_paused BOOLEAN DEFAULT FALSE,
                    scope ENUM('session', 'global') DEFAULT 'session',
                    paused_at TIMESTAMP NULL,
                    paused_by VARCHAR(255) NULL,
                    pause_reason TEXT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    INDEX idx_session_id (session_id),
                    INDEX idx_user_id (user_id),
                    INDEX idx_scope (scope),
                    INDEX idx_is_paused (is_paused),
                    UNIQUE KEY unique_session_scope (session_id, scope)
                )
            """)
            
            cursor.close()
            connection.close()
            
        except Exception as e:
            print(f"Error initializing ML training state table: {e}")
    
    def pause_training(self, user_id: str, username: str, session_id: str, reason: str = None, scope: str = 'session') -> bool:
        """
        Pause ML training for a specific scope
        
        Args:
            user_id: User identifier
            username: Username for audit trail
            session_id: Current session ID
            reason: Optional reason for pausing
            scope: 'session' (individual) or 'global' (system-wide)
            
        Returns:
            bool: True if successfully paused, False otherwise
        """
        try:
            connection = mysql.connector.connect(**self.mysql_config)
            cursor = connection.cursor()
            
            if scope == 'global':
                # Global pause - affects entire system
                cursor.execute("""
                    INSERT INTO ml_training_state 
                    (user_id, username, session_id, is_paused, paused_at, paused_by, pause_reason, scope)
                    VALUES (%s, %s, 'GLOBAL', TRUE, NOW(), %s, %s, 'global')
                    ON DUPLICATE KEY UPDATE
                    is_paused = TRUE,
                    paused_at = NOW(),
                    paused_by = %s,
                    pause_reason = %s,
                    scope = 'global',
                    updated_at = NOW()
                """, (user_id, username, username, reason, username, reason))
            else:
                # Session-specific pause
                cursor.execute("""
                    INSERT INTO ml_training_state 
                    (user_id, username, session_id, is_paused, paused_at, paused_by, pause_reason, scope)
                    VALUES (%s, %s, %s, TRUE, NOW(), %s, %s, 'session')
                    ON DUPLICATE KEY UPDATE
                    is_paused = TRUE,
                    paused_at = NOW(),
                    paused_by = %s,
                    pause_reason = %s,
                    scope = 'session',
                    updated_at = NOW()
                """, (user_id, username, session_id, username, reason, username, reason))
            
            cursor.close()
            connection.close()
            
            scope_text = "globally" if scope == 'global' else f"for session {session_id}"
            print(f"ML training paused {scope_text} by user {username}")
            return True
            
        except Exception as e:
            print(f"Error pausing ML training: {e}")
            return False
    
    def resume_training(self, user_id: str, username: str, session_id: str, scope: str = 'session') -> bool:
        """
        Resume ML training for a specific scope
        
        Args:
            user_id: User identifier
            username: Username for audit trail
            session_id: Current session ID (ignored for global scope)
            scope: 'session' (individual) or 'global' (system-wide)
            
        Returns:
            bool: True if successfully resumed, False otherwise
        """
        try:
            connection = mysql.connector.connect(**self.mysql_config)
            cursor = connection.cursor()
            
            if scope == 'global':
                # Global resume - remove global pause
                cursor.execute("""
                    UPDATE ml_training_state 
                    SET is_paused = FALSE,
                        paused_at = NULL,
                        paused_by = NULL,
                        pause_reason = NULL,
                        updated_at = NOW()
                    WHERE session_id = 'GLOBAL' AND scope = 'global'
                """)
            else:
                # Session-specific resume
                cursor.execute("""
                    UPDATE ml_training_state 
                    SET is_paused = FALSE,
                        paused_at = NULL,
                        paused_by = NULL,
                        pause_reason = NULL,
                        updated_at = NOW()
                    WHERE session_id = %s AND user_id = %s AND scope = 'session'
                """, (session_id, user_id))
            
            cursor.close()
            connection.close()
            
            scope_text = "globally" if scope == 'global' else f"for session {session_id}"
            print(f"ML training resumed {scope_text} by user {username}")
            return True
            
        except Exception as e:
            print(f"Error resuming ML training: {e}")
            return False
    
    def is_training_paused(self, session_id: str) -> bool:
        """
        Check if ML training is paused for a specific session
        Checks both global pause and session-specific pause
        
        Args:
            session_id: Session ID to check
            
        Returns:
            bool: True if training is paused (either globally or for session), False otherwise
        """
        try:
            connection = mysql.connector.connect(**self.mysql_config)
            cursor = connection.cursor()
            
            # Check for global pause first
            cursor.execute("""
                SELECT is_paused FROM ml_training_state 
                WHERE session_id = 'GLOBAL' AND scope = 'global' AND is_paused = TRUE
                ORDER BY updated_at DESC 
                LIMIT 1
            """)
            
            global_result = cursor.fetchone()
            if global_result and global_result[0]:
                cursor.close()
                connection.close()
                return True  # Global pause is active
            
            # Check for session-specific pause
            cursor.execute("""
                SELECT is_paused FROM ml_training_state 
                WHERE session_id = %s AND scope = 'session' AND is_paused = TRUE
                ORDER BY updated_at DESC 
                LIMIT 1
            """, (session_id,))
            
            session_result = cursor.fetchone()
            cursor.close()
            connection.close()
            
            return session_result[0] if session_result else False
            
        except Exception as e:
            print(f"Error checking training state: {e}")
            return False
    
    def get_training_state(self, session_id: str) -> Optional[Dict]:
        """
        Get detailed training state for a session
        
        Args:
            session_id: Session ID to check
            
        Returns:
            Dict with training state details or None
        """
        try:
            connection = mysql.connector.connect(**self.mysql_config)
            cursor = connection.cursor(dictionary=True)
            
            # Check for global pause first
            cursor.execute("""
                SELECT *, 'global' as effective_scope FROM ml_training_state 
                WHERE session_id = 'GLOBAL' AND scope = 'global' AND is_paused = TRUE
                ORDER BY updated_at DESC 
                LIMIT 1
            """)
            
            global_result = cursor.fetchone()
            if global_result:
                cursor.close()
                connection.close()
                return global_result
            
            # Check for session-specific pause
            cursor.execute("""
                SELECT *, 'session' as effective_scope FROM ml_training_state 
                WHERE session_id = %s AND scope = 'session'
                ORDER BY updated_at DESC 
                LIMIT 1
            """, (session_id,))
            
            session_result = cursor.fetchone()
            cursor.close()
            connection.close()
            
            return session_result
            
        except Exception as e:
            print(f"Error getting training state: {e}")
            return None
    
    def get_global_training_state(self) -> Optional[Dict]:
        """
        Get global training state
        
        Returns:
            Dict with global training state or None
        """
        try:
            connection = mysql.connector.connect(**self.mysql_config)
            cursor = connection.cursor(dictionary=True)
            
            cursor.execute("""
                SELECT * FROM ml_training_state 
                WHERE session_id = 'GLOBAL' AND scope = 'global'
                ORDER BY updated_at DESC 
                LIMIT 1
            """)
            
            result = cursor.fetchone()
            cursor.close()
            connection.close()
            
            return result
            
        except Exception as e:
            print(f"Error getting global training state: {e}")
            return None
    
    def cleanup_expired_states(self, hours_old: int = 24):
        """
        Clean up old training states for sessions that have expired
        
        Args:
            hours_old: Remove states older than this many hours
        """
        try:
            connection = mysql.connector.connect(**self.mysql_config)
            cursor = connection.cursor()
            
            cursor.execute("""
                DELETE FROM ml_training_state 
                WHERE updated_at < DATE_SUB(NOW(), INTERVAL %s HOUR)
            """, (hours_old,))
            
            deleted_count = cursor.rowcount
            cursor.close()
            connection.close()
            
            if deleted_count > 0:
                print(f"Cleaned up {deleted_count} expired ML training states")
                
        except Exception as e:
            print(f"Error cleaning up training states: {e}")

# Global instance
ml_training_manager = MLTrainingManager()
