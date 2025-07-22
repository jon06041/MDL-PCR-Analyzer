# MDL-PCR-Analyzer

🚨 **FOR COMPLETE PROJECT INFORMATION: READ [`Agent_instructions.md`](./Agent_instructions.md)** 🚨

A web-based qPCR S-Curve analyzer with ML-enhanced curve classification for laboratory workflows.

## Quick Links

📖 **[Complete Documentation](./Agent_instructions.md)** - Comprehensive project information, status, and technical details  
🤖 **[ML Classification Guide](./ML_CURVE_CLASSIFICATION_DOCUMENTATION.md)** - Machine learning system documentation  
🔧 **[ML Configuration](./ML_CONFIG_README.md)** - ML pathogen configuration and management system  
🎯 **[Threshold Strategies](./THRESHOLD_STRATEGIES.md)** - qPCR threshold calculation methods  

## Quick Start

### For Developers/Agents
1. **READ FIRST**: [`Agent_instructions.md`](./Agent_instructions.md)
2. Understand current status and technical context
3. Follow safety procedures and development guidelines

### For Production Deployment
```bash
# Railway/Cloud deployment - automatic detection
# Local development
pip install -r requirements.txt
python app.py
```

### For Users
1. Upload CFX Manager CSV files
2. Add Quantification Summary CSV
3. Analyze qPCR curves with ML-enhanced classification
4. Provide expert feedback for ML training (robust data handling)
5. Configure pathogen-specific ML settings (admin interface)
6. Review results and adjust thresholds
7. Export analysis data

## License
MIT License - Open for laboratory and research use.
