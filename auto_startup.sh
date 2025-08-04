#!/bin/bash
# Auto-startup script for MDL-PCR-Analyzer
# This script sets up everything needed and starts the Flask app

echo "🚀 Starting MDL-PCR-Analyzer Auto Setup..."

# Navigate to the project directory
cd /workspaces/MDL-PCR-Analyzer

# Ensure MySQL is running - FORCE MySQL to work, no SQLite fallback
echo "📊 Starting MySQL service..."

# Check if MySQL is already running
if sudo mysqladmin ping --silent 2>/dev/null; then
    echo "✅ MySQL is already running"
    MYSQL_READY=true
else
    # Try different MySQL startup methods for codespace environment
    echo "🔧 Starting MySQL in codespace environment..."
    
    # Method 1: Try service command
    if sudo service mysql start 2>/dev/null; then
        echo "✓ MySQL started via service command"
    else
        # Method 2: Try mysqld_safe
        echo "🔧 Trying mysqld_safe startup..."
        sudo mysqld_safe --user=mysql --datadir=/var/lib/mysql &
        sleep 3
    fi
    
    # Wait for MySQL to be ready - extended timeout and better error handling
    echo "⏳ Waiting for MySQL to be ready..."
    MYSQL_READY=false
    for i in {1..60}; do
        if sudo mysqladmin ping --silent 2>/dev/null; then
            echo "✅ MySQL is running and ready"
            MYSQL_READY=true
            break
        fi
        if [ $((i % 10)) -eq 0 ]; then
            echo "⏳ Still waiting for MySQL... ($i/60 seconds)"
        fi
        sleep 1
    done
fi

if [ "$MYSQL_READY" != "true" ]; then
    echo "❌ ERROR: MySQL failed to start after 60 seconds"
    echo "🔧 Attempting to diagnose MySQL issues..."
    
    # Check if MySQL processes exist
    ps aux | grep mysql | grep -v grep || echo "No MySQL processes found"
    
    # Check MySQL service status
    service mysql status 2>/dev/null || echo "MySQL service status unavailable"
    
    # Check for MySQL socket
    ls -la /var/run/mysqld/ 2>/dev/null || echo "MySQL socket directory not found"
    
    # Try to start MySQL manually
    echo "� Attempting manual MySQL start..."
    sudo mysqld --user=mysql --datadir=/var/lib/mysql --socket=/var/run/mysqld/mysqld.sock &
    sleep 5
    
    # Final check
    if sudo mysqladmin ping --silent 2>/dev/null; then
        echo "✅ MySQL started manually"
        MYSQL_READY=true
    else
        echo "💡 MySQL startup failed - please check codespace MySQL configuration"
        exit 1
    fi
fi

# Create MySQL user and database - ENSURE this works
echo "🔧 Setting up MySQL database and user..."

# Create user with proper error handling
echo "� Creating MySQL user 'qpcr_user'..."
if ! sudo mysql -e "CREATE USER IF NOT EXISTS 'qpcr_user'@'localhost' IDENTIFIED BY 'qpcr_password';"; then
    echo "❌ Failed to create MySQL user"
    exit 1
fi

# Create database with proper error handling
echo "🗄️ Creating database 'qpcr_analysis'..."
if ! sudo mysql -e "CREATE DATABASE IF NOT EXISTS qpcr_analysis CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"; then
    echo "❌ Failed to create MySQL database"
    exit 1
fi

# Grant privileges with proper error handling
echo "🔑 Granting privileges..."
if ! sudo mysql -e "GRANT ALL PRIVILEGES ON qpcr_analysis.* TO 'qpcr_user'@'localhost';"; then
    echo "❌ Failed to grant MySQL privileges"
    exit 1
fi

if ! sudo mysql -e "FLUSH PRIVILEGES;"; then
    echo "❌ Failed to flush MySQL privileges"
    exit 1
fi

# Test the connection to ensure it works
echo "🧪 Testing MySQL connection..."
if ! mysql -u qpcr_user -pqpcr_password -h 127.0.0.1 -e "USE qpcr_analysis; SELECT 1;" > /dev/null 2>&1; then
    echo "❌ MySQL connection test failed"
    echo "🔧 Debugging connection..."
    mysql -u qpcr_user -pqpcr_password -h 127.0.0.1 -e "USE qpcr_analysis; SELECT 1;" 2>&1 || true
    exit 1
fi

echo "✅ MySQL database and user configured successfully"

# Activate virtual environment
echo "🐍 Activating Python virtual environment..."
source .venv/bin/activate

# Install any missing dependencies
echo "📦 Installing dependencies..."
pip install python-dotenv pymysql > /dev/null 2>&1

# Start the Flask app with FORCED MySQL configuration
echo "🌟 Starting Flask app with MySQL (NO SQLite fallback)..."
echo "✅ App will be available at: http://localhost:5000"
echo "📊 Using MySQL database: qpcr_analysis"
echo "🔗 Connection: qpcr_user@localhost:3306/qpcr_analysis"
echo ""

# FORCE MySQL by setting explicit environment variables
export DATABASE_URL="mysql+pymysql://qpcr_user:qpcr_password@localhost:3306/qpcr_analysis?charset=utf8mb4"
export MYSQL_HOST="localhost"
export MYSQL_PORT="3306"
export MYSQL_USER="qpcr_user"
export MYSQL_PASSWORD="qpcr_password"
export MYSQL_DATABASE="qpcr_analysis"
export PYTHONPATH="/workspaces/MDL-PCR-Analyzer:$PYTHONPATH"

# Unset any SQLite fallback variables
unset USE_SQLITE_FALLBACK
unset USE_MEMORY_DB

echo "🚀 Environment configured for MySQL - starting Flask app..."
python app.py
