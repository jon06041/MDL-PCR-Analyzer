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

- **qPCR Analysis**: Threshold detection, CQJ calculation, and concentration (CalcJ) determination
- **Control-Based Calculations**: Advanced CalcJ calculations using H/L control-based standard curves with outlier detection
- **Backend/Frontend Alignment**: Unified calculation methods ensuring consistent results between manual and automated analysis
- **Centralized Configuration**: Single-source control values managed via `config/concentration_controls.json`
- **Control Behavior**: H/M/L controls maintain constant CalcJ values; samples recalculated based on threshold changes
- **ML-powered Classification**: S-curve, exponential, linear, noise classification with real-time learning
- **Pathogen-specific Configuration**: Test-specific thresholds and control values
- **Administrative Controls**: ML training data management and feedback system
- **Automated Reporting**: Real-time results table and chart visualization

For detailed documentation, see the consolidated markdown files listed above.
we need this for Amazon and Entra:

Info for Entra integration:

Client_ID: 6345cabe-25c6-4f2d-a81f-dbc6f392f234
Client_secret: aaee4e07-3143-4df5-a1f9-7c306a227677
access_token_url= https://login.microsoftonline.com/5d79b88b-9063-46f3-92a6-41f3807a3d60/oauth2/v2.0/token
authorize_url= https://login.microsoftonline.com/5d79b88b-9063-46f3-92a6-41f3807a3d60/oauth2/v2.0/authorize

Let me know the redirect URL I should use. 
