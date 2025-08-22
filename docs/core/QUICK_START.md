# MDL-PCR-Analyzer - Quick Start Guide

## 🚀 One-Command Startup

To start the qPCR Analyzer with MySQL database automatically configured:

```bash
./start_app.sh
```

This script will:
- ✅ Start MySQL service if needed
- ✅ Create database user (`qpcr_user`) and database (`qpcr_analysis`) if needed
- ✅ Activate virtual environment
- ✅ Load environment variables from `.env`
- ✅ Start Flask app with MySQL backend

## 🔧 Alternative Start Methods

### Quick start (same as above):
```bash
./run_on_5000.sh
```

### Manual start (if you prefer control):
```bash
source .venv/bin/activate
python app.py
```

## 📊 Database Configuration

The app automatically detects and prioritizes:
1. `DATABASE_URL` environment variable
2. Individual MySQL environment variables in `.env`
3. SQLite fallback (development only)

**Auto-generated `.env` file:**
```env
DATABASE_URL=mysql+pymysql://qpcr_user:qpcr_password@localhost:3306/qpcr_analysis?charset=utf8mb4
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=qpcr_user
MYSQL_PASSWORD=qpcr_password
MYSQL_DATABASE=qpcr_analysis
```

## ✅ Success Indicators

When starting, look for these messages:
- `✅ Using MySQL database for production`
- `📊 MySQL connection: localhost:3306/qpcr_analysis`
- `MySQL database tables initialized`

## 🌐 Access the Application

Once started, access the application at:
- **Local**: http://localhost:5000
- **Codespace**: Use the forwarded port URL

## 🛠️ Troubleshooting

If you see SQLite warnings instead of MySQL:
1. Check if MySQL service is running: `sudo service mysql status`
2. Verify `.env` file exists and contains MySQL configuration
3. Restart using `./start_app.sh`

The startup script handles all common issues automatically!
