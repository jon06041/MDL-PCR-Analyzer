# Railway deployment notes: encryption import fix

Problem
- Production crashed at import time: from cryptography.fernet import Fernet
- Root cause: cryptography not installed in Railway image; python-dotenv missing so env loads differed.

Fix
- requirements-railway.txt now includes:
  - cryptography==42.0.8
  - python-dotenv==1.0.0
- encryption_api.py now degrades gracefully if cryptography is missing: endpoints return 503 instead of crashing the app.

Actions to apply in Railway
- Trigger a rebuild so requirements-railway.txt is installed.
- Ensure server restarts after build to pick up the new dependencies.

Validation
- GET /api/encryption/status returns status JSON with encryption_available true once cryptography installs.
- If the package is still missing, the status shows error details and HTTP 200, while encrypt/decrypt endpoints return 503.

Troubleshooting
- Confirm which requirements file Railway uses and that pip install runs during build.
- Check logs for ENCRYPTION_IMPORT_ERROR notes.
- If using a custom buildpack, add cryptography to the install step.