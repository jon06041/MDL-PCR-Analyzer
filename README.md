# MDL PCR Analyzer

A comprehensive qPCR analysis tool with ML-powered curve classification, regulatory compliance tracking, and automated reporting for production laboratory environments.

## Project Structure

This project uses consolidated documentation for maintainability:

- **Agent_instructions.md** - Main project documentation, development history, and AI agent instructions
- **ML_CURVE_CLASSIFICATION_DOCUMENTATION.md** - Machine learning algorithms, hybrid features, and classification logic  
- **THRESHOLD_STRATEGIES.md** - Threshold detection and curve analysis strategies

## Quick Start

1. Install dependencies: `pip install -r requirements.txt`
2. Run the application: `python app.py`
3. Access the web interface at `http://localhost:5000`

## Features

### Core qPCR Analysis
- **qPCR Analysis**: Threshold detection, CQJ calculation, and concentration (CalcJ) determination
- **Centralized Configuration**: Single-source control values managed via `config/concentration_controls.json`
- **Control Behavior**: H/M/L controls maintain constant CalcJ values; samples recalculated based on threshold changes
- **Pathogen-specific Configuration**: Test-specific thresholds and control values
- **Automated Reporting**: Real-time results table and chart visualization

### Machine Learning & Validation
- **ML-powered Classification**: S-curve, exponential, linear, noise classification with real-time learning
- **Expert Decision Tracking**: Logs expert corrections and confirmations for continuous improvement
- **Model Versioning**: Pathogen-specific model versions with training sample tracking
- **Milestone-based Training**: Requires minimum 40 teaching samples before version advancement
- **QC Validation System**: Run-level quality control with evidence-based assessment

### Regulatory Compliance
- **FDA Compliance Dashboard**: Comprehensive regulatory compliance monitoring (21 CFR Part 820, 21 CFR Part 11, CLIA)
- **Software-Specific Tracking**: 48 auto-trackable compliance requirements
- **Audit Trail**: Complete user action logging with timestamps
- **Electronic Records**: Preparation for electronic signatures and data integrity
- **Quality Control**: CLIA-compliant QC procedure tracking

### Configuration Management
- **Centralized Controls**: All concentration controls managed from single JSON configuration
- **Test-Specific Settings**: Pathogen-specific thresholds and control values
- **Threshold Strategies**: Multiple threshold detection algorithms (exponential phase, linear, manual)
- **Administrative Controls**: ML training data management and feedback system

## Production Roadmap

**Current Status**: Phase 1 Complete - Core compliance system with ML validation
**Next Priority**: Phase 2 - User management & authentication with Microsoft Entra ID

For detailed documentation, see the consolidated markdown files listed above.
