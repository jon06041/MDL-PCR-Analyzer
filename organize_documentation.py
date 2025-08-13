#!/usr/bin/env python3
"""
Documentation Organization Script for MDL qPCR Analyzer

This script organizes all .md files into a structured docs directory
and creates a comprehensive index of all documentation.
"""

import os
import shutil
import re
from datetime import datetime
from pathlib import Path

class DocumentationOrganizer:
    def __init__(self, project_root="/workspaces/MDL-PCR-Analyzer"):
        self.project_root = Path(project_root)
        self.docs_dir = self.project_root / "docs"
        self.archived_dir = self.docs_dir / "archived"
        self.reports_dir = self.docs_dir / "reports"
        self.logs_dir = self.docs_dir / "logs"
        
        # Documentation categories
        self.categories = {
            "core": ["README.md", "QUICK_START.md"],
            "compliance": [
                "COMPLIANCE_CHECKLIST_PRINTABLE.md",
                "EVIDENCE_REQUIREMENTS_ANALYSIS.md",
                "encryption_requirements.md"
            ],
            "technical": [
                "ML_CURVE_CLASSIFICATION_DOCUMENTATION.md",
                "THRESHOLD_STRATEGIES.md",
                "CQJ_EDGE_CASE_IMPLEMENTATION_COMPLETE.md"
            ],
            "development": [
                "Agent_instructions.md",
                "CLASSIFICATION_FIX_SUMMARY.md",
                "MODAL_NAVIGATION_FIX.md",
                "SQLITE_ELIMINATION_COMPLETE.md"
            ],
            "results": [
                "PRESENTATION_RESULTS.md",
                "ml_learning_progression_report.md",
                "ml_learning_results.md"
            ],
            "logs": [
                "ML_VISIBILITY_FIX_LOG.md",
                "REMAINING_ISSUES_LOG.md"
            ],
            "archived": []  # Will be populated with timestamped reports
        }

    def create_directory_structure(self):
        """Create the organized docs directory structure"""
        directories = [
            self.docs_dir,
            self.docs_dir / "core",
            self.docs_dir / "compliance", 
            self.docs_dir / "technical",
            self.docs_dir / "development",
            self.docs_dir / "results",
            self.logs_dir,
            self.archived_dir,
            self.reports_dir
        ]
        
        for directory in directories:
            directory.mkdir(parents=True, exist_ok=True)
            print(f"✓ Created directory: {directory}")

    def identify_timestamped_reports(self):
        """Identify timestamped encryption evidence reports for archiving"""
        pattern = re.compile(r'encryption_evidence_.*_\d{8}_\d{6}\.md$')
        timestamped_files = []
        
        for md_file in self.project_root.glob("*.md"):
            if pattern.match(md_file.name):
                timestamped_files.append(md_file.name)
                self.categories["archived"].append(md_file.name)
        
        return timestamped_files

    def organize_files(self, dry_run=True):
        """Organize all markdown files into appropriate categories"""
        if dry_run:
            print("\n🔍 DRY RUN - No files will be moved\n")
        else:
            print("\n📁 ORGANIZING FILES\n")
        
        # Identify timestamped reports
        timestamped_reports = self.identify_timestamped_reports()
        print(f"Found {len(timestamped_reports)} timestamped reports to archive")
        
        moved_files = {}
        
        for category, files in self.categories.items():
            if not files:
                continue
                
            category_dir = self.docs_dir / category
            moved_files[category] = []
            
            for filename in files:
                source_path = self.project_root / filename
                
                # Check if file exists in root
                if source_path.exists():
                    dest_path = category_dir / filename
                    
                    if dry_run:
                        print(f"Would move: {filename} → docs/{category}/")
                    else:
                        # Check if file already exists in docs
                        existing_docs_file = self.docs_dir / filename
                        if existing_docs_file.exists() and existing_docs_file != dest_path:
                            print(f"⚠️  Duplicate found: {filename} exists in docs/ - will merge/update")
                            
                        shutil.move(str(source_path), str(dest_path))
                        print(f"✓ Moved: {filename} → docs/{category}/")
                    
                    moved_files[category].append(filename)
                else:
                    # Check if already in docs folder
                    docs_file = self.docs_dir / filename
                    if docs_file.exists():
                        dest_path = category_dir / filename
                        if docs_file != dest_path:
                            if dry_run:
                                print(f"Would reorganize within docs: {filename} → docs/{category}/")
                            else:
                                shutil.move(str(docs_file), str(dest_path))
                                print(f"✓ Reorganized: {filename} → docs/{category}/")
                            moved_files[category].append(filename)
        
        return moved_files

    def create_index_readme(self, moved_files):
        """Create a comprehensive README.md for the docs directory"""
        readme_content = f"""# MDL qPCR Analyzer Documentation

**Last Updated**: {datetime.now().strftime('%B %d, %Y')}

This directory contains all project documentation organized by category for easy navigation and maintenance.

## 📁 Directory Structure

### Core Documentation
**Location**: `docs/core/`
- Essential project documentation and quick start guides

### Compliance Documentation  
**Location**: `docs/compliance/`
- FDA CFR 21 Part 11 compliance tracking
- Evidence requirements analysis
- Encryption and security compliance

### Technical Documentation
**Location**: `docs/technical/`  
- ML curve classification algorithms
- Threshold calculation strategies
- Implementation details and technical specifications

### Development Documentation
**Location**: `docs/development/`
- Development logs and issue tracking
- Agent instructions and coding guidelines
- Implementation summaries and fixes

### Results & Reports
**Location**: `docs/results/`
- Analysis results and findings
- ML learning progression reports
- Performance metrics and outcomes

### Development Logs
**Location**: `docs/logs/`
- Issue tracking and resolution logs
- Development progress tracking
- Debugging and troubleshooting logs

### Archived Reports
**Location**: `docs/archived/`
- Timestamped evidence reports
- Historical compliance documentation
- Legacy analysis reports

---

## 📋 Document Index

"""
        
        # Add file listings for each category
        for category, files in moved_files.items():
            if files:
                category_title = category.replace('_', ' ').title()
                readme_content += f"### {category_title}\n\n"
                
                for filename in sorted(files):
                    # Extract a brief description from filename
                    clean_name = filename.replace('.md', '').replace('_', ' ')
                    readme_content += f"- [`{filename}`]({category}/{filename}) - {clean_name}\n"
                
                readme_content += "\n"

        readme_content += """---

## 🚀 Quick Access

### For Developers
- [Agent Instructions](development/Agent_instructions.md) - AI coding agent guidelines
- [Classification Fix Summary](development/CLASSIFICATION_FIX_SUMMARY.md) - Recent fixes and improvements

### For Compliance
- [Evidence Requirements Analysis](compliance/EVIDENCE_REQUIREMENTS_ANALYSIS.md) - Comprehensive compliance strategy
- [Compliance Checklist](compliance/COMPLIANCE_CHECKLIST_PRINTABLE.md) - Printable compliance checklist

### For Users
- [Quick Start Guide](core/QUICK_START.md) - Getting started with the system
- [Presentation Results](results/PRESENTATION_RESULTS.md) - Key findings and results

---

## 📝 Documentation Standards

- All documentation uses Markdown format
- Files are organized by functional category
- Timestamped reports are archived to prevent clutter
- Each document includes creation/modification dates
- Cross-references use relative links within docs structure

## 🔄 Maintenance

This documentation structure is maintained by the `organize_documentation.py` script. 
Run the script to reorganize files or update the index after adding new documentation.

```bash
# Preview changes
python3 organize_documentation.py --dry-run

# Apply organization
python3 organize_documentation.py
```
"""
        
        # Write the README
        docs_readme = self.docs_dir / "README.md"
        with open(docs_readme, 'w') as f:
            f.write(readme_content)
        
        print(f"\n✓ Created comprehensive docs README: {docs_readme}")

    def run(self, dry_run=True):
        """Execute the complete documentation organization process"""
        print("🗂️  MDL qPCR Analyzer Documentation Organization")
        print("=" * 50)
        
        # Create directory structure
        self.create_directory_structure()
        
        # Organize files
        moved_files = self.organize_files(dry_run)
        
        if not dry_run:
            # Create index README
            self.create_index_readme(moved_files)
            
            print("\n✅ Documentation organization complete!")
            print(f"📁 All documentation is now organized in: {self.docs_dir}")
        else:
            print("\n🔍 Dry run complete. Run with --apply to make changes.")

def main():
    import sys
    
    organizer = DocumentationOrganizer()
    
    dry_run = True
    if len(sys.argv) > 1 and sys.argv[1] in ['--apply', '--execute', '--run']:
        dry_run = False
    
    organizer.run(dry_run=dry_run)

if __name__ == "__main__":
    main()
