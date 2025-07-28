#!/usr/bin/env python3
"""
MDL-PCR-Analyzer Database Management CLI
Easy-to-use command line interface for database operations
"""

import argparse
import sys
import os
from pathlib import Path
from database_backup_manager import DatabaseBackupManager, MLValidationTracker
import json

def main():
    parser = argparse.ArgumentParser(
        description='MDL-PCR-Analyzer Database Management',
        epilog="""
Examples:
  python db_manager.py backup --desc "Before ML training"
  python db_manager.py restore --file db_backups/qpcr_analysis_manual_20250728_143022.db
  python db_manager.py reset --dev
  python db_manager.py list
  python db_manager.py stats --pathogen FLUA --days 30
        """,
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    
    subparsers = parser.add_subparsers(dest='command', help='Available commands')
    
    # Backup command
    backup_parser = subparsers.add_parser('backup', help='Create database backup')
    backup_parser.add_argument('--desc', '--description', default='', 
                              help='Description for the backup')
    backup_parser.add_argument('--type', default='manual', 
                              choices=['manual', 'auto', 'pre-training', 'pre-reset'],
                              help='Type of backup')
    
    # Restore command
    restore_parser = subparsers.add_parser('restore', help='Restore from backup')
    restore_parser.add_argument('--file', '--backup-file', required=True,
                               help='Path to backup file to restore')
    restore_parser.add_argument('--force', action='store_true',
                               help='Skip confirmation prompt')
    
    # List command
    list_parser = subparsers.add_parser('list', help='List available backups')
    list_parser.add_argument('--count', type=int, default=10,
                            help='Number of recent backups to show')
    
    # Reset command
    reset_parser = subparsers.add_parser('reset', help='Reset database for development')
    reset_parser.add_argument('--dev', '--development', action='store_true',
                             help='Reset development data only (recommended)')
    reset_parser.add_argument('--full', action='store_true',
                             help='Full reset including schema (destructive)')
    reset_parser.add_argument('--force', action='store_true',
                             help='Skip confirmation prompt')
    
    # Statistics command
    stats_parser = subparsers.add_parser('stats', help='Show ML validation statistics')
    stats_parser.add_argument('--pathogen', 
                             help='Specific pathogen code (leave empty for all)')
    stats_parser.add_argument('--days', type=int, default=30,
                             help='Number of days to look back')
    
    # Track model change command
    track_parser = subparsers.add_parser('track-change', help='Track model changes')
    track_parser.add_argument('--model-type', required=True,
                             choices=['general_pcr', 'pathogen_specific'],
                             help='Type of model changed')
    track_parser.add_argument('--pathogen', required=True,
                             help='Pathogen code affected')
    track_parser.add_argument('--desc', '--description', required=True,
                             help='Description of the change')
    
    # Validation required command
    validation_parser = subparsers.add_parser('validation-required', 
                                            help='Show models requiring validation')
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        return
    
    # Initialize managers
    backup_manager = DatabaseBackupManager()
    validation_tracker = MLValidationTracker()
    
    try:
        if args.command == 'backup':
            backup_path, metadata = backup_manager.create_backup(args.type, args.desc)
            if backup_path:
                print(f"✅ Backup created successfully: {backup_path}")
                print(f"   Description: {args.desc or 'No description'}")
                print(f"   Size: {metadata['backup_size']:,} bytes")
            else:
                print("❌ Backup creation failed")
                sys.exit(1)
                
        elif args.command == 'restore':
            if not os.path.exists(args.file):
                print(f"❌ Backup file not found: {args.file}")
                sys.exit(1)
                
            if not args.force:
                confirm = input(f"⚠️  This will replace the current database with {args.file}. Continue? (y/N): ")
                if confirm.lower() != 'y':
                    print("Restore cancelled")
                    return
                    
            success = backup_manager.restore_backup(args.file)
            if success:
                print(f"✅ Database restored successfully from {args.file}")
            else:
                print("❌ Restore failed")
                sys.exit(1)
                
        elif args.command == 'list':
            backups = backup_manager.list_backups()
            if not backups:
                print("No backups found")
                return
                
            print(f"📋 Found {len(backups)} backup(s):")
            print(f"{'Timestamp':<20} {'Type':<12} {'Size':<10} {'Description'}")
            print("-" * 70)
            
            for backup in backups[:args.count]:
                size = backup.get('backup_size', 0)
                size_str = f"{size:,}" if size else "Unknown"
                desc = backup.get('description', 'No description')[:30]
                print(f"{backup['timestamp']:<20} {backup['backup_type']:<12} {size_str:<10} {desc}")
                
        elif args.command == 'reset':
            if args.full and args.dev:
                print("❌ Cannot use both --dev and --full options")
                sys.exit(1)
                
            if not args.dev and not args.full:
                print("❌ Must specify either --dev or --full option")
                sys.exit(1)
                
            reset_type = "development data" if args.dev else "entire database (including schema)"
            
            if not args.force:
                confirm = input(f"⚠️  This will reset {reset_type}. Continue? (y/N): ")
                if confirm.lower() != 'y':
                    print("Reset cancelled")
                    return
                    
            success = backup_manager.reset_development_data(preserve_structure=args.dev)
            if success:
                print(f"✅ {'Development data' if args.dev else 'Database'} reset successfully")
                print("   A backup was created before reset")
            else:
                print("❌ Reset failed")
                sys.exit(1)
                
        elif args.command == 'stats':
            stats = validation_tracker.get_pathogen_accuracy_stats(args.pathogen, args.days)
            
            if not stats:
                print(f"No validation statistics found for the last {args.days} days")
                return
                
            if args.pathogen:
                print(f"📊 ML Validation Statistics for {args.pathogen} (last {args.days} days):")
            else:
                print(f"📊 ML Validation Statistics (last {args.days} days):")
                
            print(f"{'Pathogen':<12} {'Accuracy':<10} {'Predictions':<12} {'Overrides':<10}")
            print("-" * 50)
            
            for stat in stats:
                accuracy = f"{stat['accuracy_percentage']:.1f}%"
                predictions = f"{stat['correct_predictions']}/{stat['total_predictions']}"
                overrides = str(stat['expert_overrides'])
                print(f"{stat['pathogen_code']:<12} {accuracy:<10} {predictions:<12} {overrides:<10}")
                
        elif args.command == 'track-change':
            affected_models = backup_manager.track_model_change_impact(
                args.model_type, args.pathogen, args.desc
            )
            print(f"✅ Model change tracked for {args.pathogen}")
            print(f"   Description: {args.desc}")
            print(f"   Affected models: {len(affected_models)}")
            if affected_models:
                print("   Models flagged for validation:")
                for model_id, version in affected_models:
                    print(f"   - Model {model_id} (version {version})")
                    
        elif args.command == 'validation-required':
            validation_required = backup_manager.get_validation_required_models()
            
            if not validation_required:
                print("✅ No models currently require validation")
                return
                
            print(f"⚠️  {len(validation_required)} model(s) require validation:")
            print(f"{'Model Type':<20} {'Pathogen':<12} {'Version':<10} {'Reason'}")
            print("-" * 70)
            
            for item in validation_required:
                reason = item['reason'][:30] + "..." if len(item['reason']) > 30 else item['reason']
                print(f"{item['model_type']:<20} {item['pathogen_code']:<12} {item['version']:<10} {reason}")
                
    except KeyboardInterrupt:
        print("\\n⚠️  Operation cancelled by user")
    except Exception as e:
        print(f"❌ Error: {e}")
        sys.exit(1)


if __name__ == '__main__':
    main()
