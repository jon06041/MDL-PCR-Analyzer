# MDL PCR Analyzer

A qPCR analysis tool with ML-powered curve classification and automated reporting.

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

- qPCR curve analysis and Cq calculation
- ML-powered curve classification (S-curve, exponential, linear, noise)
- Pathogen-specific configuration and thresholds
- Real-time feedback and learning system
- Administrative controls for ML training data
- Automated report generation

For detailed documentation, see the consolidated markdown files listed above.
