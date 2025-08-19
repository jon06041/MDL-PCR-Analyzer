"""
MySQL-based Backup Scheduler (no SQLite)
- Best-effort startup backup using mysqldump
- Background daemon thread performing periodic backups (default every 24h)
- Robust logging; errors don't crash the app
"""

import os
import logging
import threading
import time
from datetime import datetime
import pymysql
import subprocess

logger = logging.getLogger(__name__)


class BackupScheduler:
    def __init__(self, mysql_config=None):
        self.mysql_config = mysql_config or {
            'host': os.environ.get('MYSQL_HOST', 'localhost'),
            'user': os.environ.get('MYSQL_USER', 'qpcr_user'),
            'password': os.environ.get('MYSQL_PASSWORD', 'qpcr_password'),
            'database': os.environ.get('MYSQL_DATABASE', 'qpcr_analysis'),
            'port': int(os.environ.get('MYSQL_PORT', 3306)),
        }
        self._thread = None
        logger.info("✅ MySQL Backup Scheduler initialized")

    def create_backup(self, backup_name: str | None = None):
        """Create a MySQL database backup using mysqldump."""
        try:
            if not backup_name:
                backup_name = f"qpcr_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
            backup_file = f"/tmp/{backup_name}.sql"

            # Force TCP to avoid Unix socket permission issues; map localhost -> 127.0.0.1
            host = self.mysql_config.get('host') or '127.0.0.1'
            if host == 'localhost':
                host = '127.0.0.1'

            cmd = [
                'mysqldump',
                '--protocol=TCP',
                '-h', host,
                '-P', str(self.mysql_config.get('port', 3306)),
                '-u', self.mysql_config.get('user', ''),
                f"-p{self.mysql_config.get('password', '')}",
                '--column-statistics=0',
                self.mysql_config.get('database', ''),
            ]

            # Run mysqldump and write stdout to file directly
            with open(backup_file, 'wb') as fh:
                proc = subprocess.run(cmd, stdout=fh, stderr=subprocess.PIPE)
            if proc.returncode == 0:
                logger.info(f"✅ MySQL backup created: {backup_file}")
                return {'success': True, 'backup_file': backup_file}
            else:
                stderr = proc.stderr.decode('utf-8', errors='ignore')
                logger.error(f"❌ mysqldump failed (code {proc.returncode}): {stderr.strip()}")
                return {'success': False, 'error': stderr.strip()}
        except Exception as e:
            logger.error(f"❌ Backup creation failed: {e}")
            return {'success': False, 'error': str(e)}

    def get_backup_status(self):
        """Verify MySQL connectivity for backup readiness."""
        try:
            conn = pymysql.connect(**self.mysql_config)
            conn.close()
            return {
                'status': 'operational',
                'database_type': 'MySQL',
                'last_check': datetime.now().isoformat(),
                'message': 'MySQL backup system operational',
            }
        except Exception as e:
            return {
                'status': 'error',
                'database_type': 'MySQL',
                'last_check': datetime.now().isoformat(),
                'error': str(e),
            }

    def schedule_backup(self):
        """Create a single backup now (for manual or scheduled calls)."""
        logger.info("📅 Backup scheduling tick (MySQL-based)")
        return self.create_backup()

    def run_in_background(self, interval_hours: float = 24.0):
        """Run periodic MySQL backups in a background daemon thread.

        - Makes a best-effort backup immediately on start.
        - Spawns a daemon thread that sleeps for the given interval and runs backups.
        - Logs errors and keeps running on failure.
        """
        # Startup backup
        try:
            self.create_backup(backup_name=f"qpcr_startup_{datetime.now().strftime('%Y%m%d_%H%M%S')}")
        except Exception as e:
            logger.warning(f"Startup backup attempt failed: {e}")

        sleep_seconds = max(3600, int((interval_hours or 24.0) * 3600))

        def _loop():
            logger.info(f"🧵 Backup scheduler thread started (interval={interval_hours}h)")
            while True:
                try:
                    self.schedule_backup()
                except Exception as loop_err:
                    logger.error(f"Periodic backup error: {loop_err}")
                time.sleep(sleep_seconds)

        if self._thread and self._thread.is_alive():
            logger.info("ℹ️ Backup scheduler already running; skipping duplicate start")
            return self._thread

        self._thread = threading.Thread(target=_loop, name="MySQLBackupSchedulerThread", daemon=True)
        self._thread.start()
        logger.info("✅ Automatic MySQL backup scheduler running in background")
        return self._thread
