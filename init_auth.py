#!/usr/bin/env python3
"""
Authentication System Initialization Script
Sets up authentication tables, creates default users, and validates configuration
"""

import os
import sys
import logging
from pathlib import Path

# Add current directory to Python path
sys.path.insert(0, str(Path(__file__).parent))

from unified_auth_manager import UnifiedAuthManager
from entra_auth import EntraAuthManager

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def main():
    """Initialize authentication system"""
    print("🔐 MDL qPCR Analyzer - Authentication System Initialization")
    print("=" * 60)
    
    try:
        # Initialize authentication manager
        print("1. Initializing Authentication Manager...")
        auth_manager = UnifiedAuthManager()
        print("   ✅ Authentication manager initialized")
        
        # Check Entra ID configuration
        print("\n2. Checking Entra ID Configuration...")
        if auth_manager.is_entra_enabled():
            print("   ✅ Entra ID authentication is enabled and configured")
            print(f"   📋 Client ID: {auth_manager.entra_auth.client_id}")
            print(f"   📋 Tenant ID: {auth_manager.entra_auth.tenant_id}")
            print(f"   📋 Redirect URI: {auth_manager.entra_auth.redirect_uri}")
        else:
            print("   ⚠️  Entra ID authentication is not configured")
            print("   💡 Set ENTRA_CLIENT_ID, ENTRA_CLIENT_SECRET, and ENTRA_TENANT_ID environment variables")
        
        # Check backdoor authentication
        print("\n3. Checking Backdoor Authentication...")
        if auth_manager.is_backdoor_enabled():
            print("   ✅ Backdoor authentication is enabled")
            print(f"   👤 Admin username: {auth_manager.backdoor_username}")
            print("   🔑 Admin password: [configured]")
            print("   ⚠️  Remember to disable backdoor in production!")
        else:
            print("   ⚠️  Backdoor authentication is disabled")
        
        # Test database connectivity
        print("\n4. Testing Database Connectivity...")
        try:
            # Try to create a test session (will fail if database is not accessible)
            import mysql.connector
            connection = mysql.connector.connect(**auth_manager.mysql_config)
            cursor = connection.cursor()
            cursor.execute("SELECT 1")
            cursor.fetchone()
            cursor.close()
            connection.close()
            print("   ✅ Database connectivity successful")
        except Exception as e:
            print(f"   ❌ Database connectivity failed: {e}")
            return False
        
        # Validate authentication system
        print("\n5. Validating Authentication System...")
        
        # Check if at least one authentication method is available
        if not auth_manager.is_entra_enabled() and not auth_manager.is_backdoor_enabled():
            print("   ❌ No authentication methods are enabled!")
            print("   💡 Enable either Entra ID or backdoor authentication")
            return False
        else:
            print("   ✅ At least one authentication method is available")
        
        print("\n🎉 Authentication System Initialization Complete!")
        print("\n📋 Summary:")
        print(f"   • Entra ID: {'✅ Enabled' if auth_manager.is_entra_enabled() else '❌ Disabled'}")
        print(f"   • Backdoor: {'✅ Enabled' if auth_manager.is_backdoor_enabled() else '❌ Disabled'}")
        print(f"   • Database: ✅ Connected")
        
        if auth_manager.is_backdoor_enabled():
            print(f"\n🚪 Backdoor Access Information:")
            print(f"   Username: {auth_manager.backdoor_username}")
            print(f"   Password: {auth_manager.backdoor_password}")
            print(f"   URL: http://localhost:5000/auth/login")
        
        if auth_manager.is_entra_enabled():
            print(f"\n🔐 Entra ID Access Information:")
            print(f"   Login URL: http://localhost:5000/auth/login")
            print(f"   Redirect URI: {auth_manager.entra_auth.redirect_uri}")
            print(f"   Tenant: {auth_manager.entra_auth.tenant_id}")
        
        return True
        
    except Exception as e:
        print(f"\n❌ Initialization failed: {e}")
        logger.error(f"Authentication initialization error: {e}", exc_info=True)
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
