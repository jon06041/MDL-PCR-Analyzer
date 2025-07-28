#!/usr/bin/env python3
"""
Automatic Database Backup Scheduler
Runs periodic backups and maintains backup retention policy
"""

import schedule
import time
import threading
import os
import sys
from pathlib import Path
from database_backup_manager import DatabaseBackupManager
import logging

# Add project root to path
sys.path.append(str(Path(__file__).parent))

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('backup_scheduler.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class BackupScheduler:
    def __init__(self):
        self.backup_manager = DatabaseBackupManager()
        self.is_running = False
        
    def create_scheduled_backup(self, backup_type='scheduled'):
        """Create a scheduled backup"""
        try:
            backup_path, metadata = self.backup_manager.create_backup(
                backup_type, 
                f'Automatic {backup_type} backup'
            )
            
            if backup_path:
                logger.info(f"Scheduled backup created: {backup_path}")
                return True
            else:
                logger.error("Scheduled backup failed")
                return False
                
        except Exception as e:
            logger.error(f"Scheduled backup error: {e}")
            return False
            
    def setup_schedules(self):
        """Setup backup schedules"""
        # Every hour backup (keeps last 24)
        schedule.every().hour.do(
            lambda: self.create_scheduled_backup('hourly')
        )
        
        # Daily backup at 2 AM (keeps last 30)
        schedule.every().day.at("02:00").do(
            lambda: self.create_scheduled_backup('daily')
        )
        
        # Weekly backup on Sunday at 3 AM (keeps last 12)
        schedule.every().sunday.at("03:00").do(
            lambda: self.create_scheduled_backup('weekly')
        )
        
        # Before ML model retraining (triggered manually)
        # This is handled in the ML training pipeline
        
        logger.info("Backup schedules configured:")
        logger.info("- Hourly backups")
        logger.info("- Daily backups at 2:00 AM")
        logger.info("- Weekly backups on Sundays at 3:00 AM")
        
    def run_scheduler(self):
        """Run the backup scheduler"""
        self.is_running = True
        logger.info("Backup scheduler started")
        
        while self.is_running:
            try:
                schedule.run_pending()
                time.sleep(60)  # Check every minute
            except KeyboardInterrupt:
                logger.info("Backup scheduler stopped by user")
                break
            except Exception as e:
                logger.error(f"Scheduler error: {e}")
                time.sleep(60)  # Continue after error
                
    def stop_scheduler(self):
        """Stop the backup scheduler"""
        self.is_running = False
        logger.info("Backup scheduler stopping...")
        
    def run_in_background(self):
        """Run scheduler in background thread"""
        self.setup_schedules()
        
        # Create initial backup
        self.create_scheduled_backup('startup')
        
        # Start scheduler in background
        scheduler_thread = threading.Thread(target=self.run_scheduler, daemon=True)
        scheduler_thread.start()
        
        logger.info("Backup scheduler running in background")
        return scheduler_thread


def main():
    """Main function for running scheduler as standalone script"""
    scheduler = BackupScheduler()
    
    try:
        scheduler.setup_schedules()
        
        # Create startup backup
        scheduler.create_scheduled_backup('startup')
        
        print("Backup scheduler started. Press Ctrl+C to stop.")
        scheduler.run_scheduler()
        
    except KeyboardInterrupt:
        print("\\nBackup scheduler stopped.")
    except Exception as e:
        print(f"Scheduler error: {e}")


if __name__ == '__main__':
    main()
