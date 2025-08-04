#!/bin/bash

# Codespace Auto-Setup Script
# This runs automatically when the codespace starts

echo "🔧 Setting up MDL-PCR-Analyzer codespace..."

# Make scripts executable
chmod +x start_app.sh
chmod +x run_on_5000.sh
chmod +x run_on_8080.sh

# Ensure MySQL is installed and configured
if ! command -v mysql &> /dev/null; then
    echo "📦 Installing MySQL..."
    sudo apt-get update
    sudo apt-get install -y mysql-server
fi

# Start MySQL service
sudo service mysql start

echo "✅ Codespace setup complete!"
echo "🚀 To start the app, run: ./start_app.sh"
