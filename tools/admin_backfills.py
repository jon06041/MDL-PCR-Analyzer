#!/usr/bin/env python3
"""
Admin Backfills (HTTP-free)

Run compliance/ML backfills directly against MySQL to avoid disrupting the Flask server.

Functions:
- backfill_ml_audit_users: normalize ml_config_audit_log.user_info to admin/system.
- backfill_implementation_status: recompute compliance_requirements_tracking from compliance_evidence.

Env vars (defaults in dev):
  MYSQL_HOST=127.0.0.1
  MYSQL_PORT=3306
  MYSQL_USER=qpcr_user
  MYSQL_PASSWORD=qpcr_password
  MYSQL_DATABASE=qpcr_analysis
"""

import os
import sys
import json
import argparse
import datetime as dt
from typing import Dict, Any

import mysql.connector

# Ensure repository root is on sys.path for imports when running from tools/
import pathlib as _pathlib
_REPO_ROOT = str(_pathlib.Path(__file__).resolve().parents[1])
if _REPO_ROOT not in sys.path:
    sys.path.insert(0, _REPO_ROOT)

# Reuse existing logic from MLConfigManager when possible
from ml_config_manager import MLConfigManager


def get_mysql_config() -> Dict[str, Any]:
    host = os.environ.get('MYSQL_HOST', '127.0.0.1')
    # Force TCP by avoiding 'localhost' implicit socket
    if host == 'localhost':
        host = '127.0.0.1'
    return {
        'host': host,
        'port': int(os.environ.get('MYSQL_PORT', '3306')),
        'user': os.environ.get('MYSQL_USER', 'qpcr_user'),
        'password': os.environ.get('MYSQL_PASSWORD', 'qpcr_password'),
        'database': os.environ.get('MYSQL_DATABASE', 'qpcr_analysis'),
        'charset': 'utf8mb4',
    }


def connect_mysql():
    cfg = get_mysql_config()
    return mysql.connector.connect(**cfg)


def backfill_ml_audit_users() -> Dict[str, Any]:
    cfg = get_mysql_config()
    mgr = MLConfigManager(use_mysql=True, mysql_config=cfg)
    return mgr.backfill_audit_users_admin_or_system()


def backfill_implementation_status() -> Dict[str, Any]:
    """Mirror the Flask route logic without HTTP.
    Rules:
      - evidence_count >= 10 -> completed
      - evidence_count > 0  -> in_progress
      - else                -> not_started
    Also updates compliance_percentage (min(100, count/10*100)) and last_evidence_timestamp.
    """
    conn = connect_mysql()
    updated = 0
    details = []
    try:
        cur = conn.cursor()
        try:
            cur.execute('SELECT requirement_id FROM compliance_requirements_tracking')
            req_ids = [row[0] for row in cur.fetchall()]

            for req_id in req_ids:
                cur.execute('SELECT COUNT(*), MAX(created_at) FROM compliance_evidence WHERE requirement_id = %s', (req_id,))
                row = cur.fetchone() or (0, None)
                count = int(row[0] or 0)
                last_ts = row[1]

                if count >= 10:
                    status = 'completed'
                elif count > 0:
                    status = 'in_progress'
                else:
                    status = 'not_started'

                percent = min(100.0, (count / 10.0) * 100.0)

                cur.execute(
                    '''UPDATE compliance_requirements_tracking
                       SET evidence_count = %s,
                           compliance_percentage = %s,
                           compliance_status = %s,
                           last_evidence_timestamp = %s,
                           updated_at = NOW()
                       WHERE requirement_id = %s''',
                    (count, percent, status, last_ts, req_id)
                )
                if cur.rowcount > 0:
                    updated += 1
                    details.append({'requirement_id': req_id, 'evidence_count': count, 'status': status})
            conn.commit()
        finally:
            cur.close()
    finally:
        conn.close()

    return {'updated': updated, 'details': details[:50]}


def main(argv=None):
    parser = argparse.ArgumentParser(description='Run admin backfills without HTTP')
    parser.add_argument('--ml-audit-users', action='store_true', help='Backfill ML audit users to admin/system')
    parser.add_argument('--implementation-status', action='store_true', help='Backfill requirement implementation statuses')
    parser.add_argument('--json', action='store_true', help='Output JSON only')

    args = parser.parse_args(argv)

    if not args.ml_audit_users and not args.implementation_status:
        parser.print_help(sys.stderr)
        return 2

    result = {}
    if args.ml_audit_users:
        result['ml_audit_users'] = backfill_ml_audit_users()
    if args.implementation_status:
        result['implementation_status'] = backfill_implementation_status()

    if args.json:
        print(json.dumps(result, indent=2, default=str))
    else:
        print('Backfills complete:')
        print(json.dumps(result, indent=2, default=str))

    return 0


if __name__ == '__main__':
    raise SystemExit(main())
