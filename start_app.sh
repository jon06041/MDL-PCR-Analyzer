#!/bin/bash

# MDL-PCR-Analyzer Auto-Start Script
# This script ensures MySQL is running, environment is configured, and starts the Flask app

echo "🚀 Starting MDL-PCR-Analyzer..."

# Navigate to the project directory
cd /workspaces/MDL-PCR-Analyzer

# Start MySQL service if not running
echo "📊 Checking MySQL service..."
if ! sudo service mysql status > /dev/null 2>&1; then
    echo "Starting MySQL service..."
    sudo service mysql start
    sleep 3
else
    echo "✅ MySQL is already running"
fi

# Check if qpcr_user exists, create if not
echo "🔐 Verifying MySQL user and database..."
if ! mysql -u qpcr_user -pqpcr_password -e "USE qpcr_analysis; SHOW TABLES;" > /dev/null 2>&1; then
    echo "Creating MySQL user and database..."
    sudo mysql -e "CREATE USER IF NOT EXISTS 'qpcr_user'@'localhost' IDENTIFIED BY 'qpcr_password';"
    sudo mysql -e "CREATE DATABASE IF NOT EXISTS qpcr_analysis CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
    sudo mysql -e "GRANT ALL PRIVILEGES ON qpcr_analysis.* TO 'qpcr_user'@'localhost';"
    sudo mysql -e "FLUSH PRIVILEGES;"
else
    echo "✅ MySQL user and database verified"
fi

# Activate virtual environment
echo "🐍 Activating virtual environment..."
if [ -d ".venv" ]; then
    source .venv/bin/activate
    echo "✅ Virtual environment activated"
else
    echo "⚠️ Virtual environment not found, using system Python"
fi

# Verify python-dotenv is installed
echo "📦 Checking dependencies..."
if ! python -c "import dotenv" > /dev/null 2>&1; then
    echo "Installing python-dotenv..."
    pip install python-dotenv
fi

# Verify .env file exists
if [ ! -f ".env" ]; then
    echo "📝 Creating .env file..."
    cat > .env << EOF
# MySQL Configuration for MDL-PCR-Analyzer
DATABASE_URL=mysql+pymysql://qpcr_user:qpcr_password@localhost:3306/qpcr_analysis?charset=utf8mb4
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=qpcr_user
MYSQL_PASSWORD=qpcr_password
MYSQL_DATABASE=qpcr_analysis
EOF
    echo "✅ .env file created"
else
    echo "✅ .env file exists"
fi

# Kill any existing Flask processes on port 5000
echo "🧹 Cleaning up existing processes..."
pkill -f "python app.py" > /dev/null 2>&1 || true
sleep 2

# Start the Flask application
echo "🌟 Starting Flask application..."
echo "📡 App will be available at http://localhost:5000"
echo "🔍 Check the logs below for MySQL confirmation..."
echo "───────────────────────────────────────────────────"

# Run the app (this will block and show logs)
python app.py
