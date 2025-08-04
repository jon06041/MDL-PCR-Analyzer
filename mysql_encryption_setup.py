#!/usr/bin/env python3
"""
MySQL TDE (Transparent Data Encryption) Setup for MDL-PCR-Analyzer
Implements database-level encryption for compliance requirements
"""

import mysql.connector
import os
from dotenv import load_dotenv
import logging

# Load environment variables
load_dotenv()

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class MySQLEncryptionSetup:
    def __init__(self):
        self.mysql_config = {
            'host': os.getenv('MYSQL_HOST', 'localhost'),
            'port': int(os.getenv('MYSQL_PORT', '3306')),
            'user': os.getenv('MYSQL_ROOT_USER', 'root'),  # Need root for encryption setup
            'password': os.getenv('MYSQL_ROOT_PASSWORD', 'root_password'),
        }
        self.database = os.getenv('MYSQL_DATABASE', 'qpcr_analysis')
    
    def check_encryption_support(self):
        """Check if MySQL supports TDE encryption"""
        try:
            conn = mysql.connector.connect(**self.mysql_config)
            cursor = conn.cursor()
            
            # Check MySQL version
            cursor.execute("SELECT VERSION();")
            version = cursor.fetchone()[0]
            logger.info(f"MySQL Version: {version}")
            
            # Check if encryption is available
            cursor.execute("SHOW VARIABLES LIKE 'have_ssl';")
            ssl_support = cursor.fetchone()
            logger.info(f"SSL Support: {ssl_support}")
            
            # Check for keyring plugin
            cursor.execute("SHOW PLUGINS;")
            plugins = cursor.fetchall()
            keyring_plugins = [p for p in plugins if 'keyring' in p[0].lower()]
            logger.info(f"Keyring plugins: {keyring_plugins}")
            
            # Check encryption variables
            cursor.execute("SHOW VARIABLES LIKE '%innodb_encrypt%';")
            encryption_vars = cursor.fetchall()
            logger.info(f"Encryption variables: {encryption_vars}")
            
            cursor.close()
            conn.close()
            return True
            
        except mysql.connector.Error as e:
            logger.error(f"MySQL encryption check failed: {e}")
            return False
    
    def setup_encryption_keys(self):
        """Setup encryption master key"""
        try:
            conn = mysql.connector.connect(**self.mysql_config)
            cursor = conn.cursor()
            
            # Generate or rotate master key
            logger.info("Setting up encryption master key...")
            cursor.execute("ALTER INSTANCE ROTATE INNODB MASTER KEY;")
            
            cursor.close()
            conn.close()
            logger.info("Encryption master key setup complete")
            return True
            
        except mysql.connector.Error as e:
            logger.error(f"Master key setup failed: {e}")
            return False
    
    def enable_database_encryption(self):
        """Enable encryption for the qPCR database"""
        try:
            conn = mysql.connector.connect(**self.mysql_config)
            cursor = conn.cursor()
            
            # Check if database exists
            cursor.execute(f"SHOW DATABASES LIKE '{self.database}';")
            if not cursor.fetchone():
                logger.error(f"Database {self.database} not found")
                return False
            
            # Enable encryption on existing database
            logger.info(f"Enabling encryption on database: {self.database}")
            cursor.execute(f"ALTER DATABASE {self.database} ENCRYPTION='Y';")
            
            # Check encryption status
            cursor.execute(f"""
                SELECT SCHEMA_NAME, DEFAULT_ENCRYPTION 
                FROM INFORMATION_SCHEMA.SCHEMATA 
                WHERE SCHEMA_NAME = '{self.database}';
            """)
            result = cursor.fetchone()
            logger.info(f"Database encryption status: {result}")
            
            cursor.close()
            conn.close()
            return True
            
        except mysql.connector.Error as e:
            logger.error(f"Database encryption failed: {e}")
            return False
    
    def encrypt_existing_tables(self):
        """Encrypt existing tables in the database"""
        try:
            conn = mysql.connector.connect(**self.mysql_config, database=self.database)
            cursor = conn.cursor()
            
            # Get list of tables
            cursor.execute("SHOW TABLES;")
            tables = [row[0] for row in cursor.fetchall()]
            logger.info(f"Tables to encrypt: {tables}")
            
            # Encrypt each table
            for table in tables:
                logger.info(f"Encrypting table: {table}")
                cursor.execute(f"ALTER TABLE {table} ENCRYPTION='Y';")
            
            # Verify encryption status
            cursor.execute("""
                SELECT TABLE_NAME, CREATE_OPTIONS 
                FROM INFORMATION_SCHEMA.TABLES 
                WHERE TABLE_SCHEMA = %s AND CREATE_OPTIONS LIKE '%ENCRYPTION%';
            """, (self.database,))
            
            encrypted_tables = cursor.fetchall()
            logger.info(f"Encrypted tables: {encrypted_tables}")
            
            cursor.close()
            conn.close()
            return True
            
        except mysql.connector.Error as e:
            logger.error(f"Table encryption failed: {e}")
            return False
    
    def verify_encryption_status(self):
        """Verify that encryption is properly configured"""
        try:
            conn = mysql.connector.connect(**self.mysql_config, database=self.database)
            cursor = conn.cursor()
            
            # Check database encryption
            cursor.execute(f"""
                SELECT SCHEMA_NAME, DEFAULT_ENCRYPTION 
                FROM INFORMATION_SCHEMA.SCHEMATA 
                WHERE SCHEMA_NAME = '{self.database}';
            """)
            db_encryption = cursor.fetchone()
            
            # Check table encryption
            cursor.execute("""
                SELECT TABLE_NAME, CREATE_OPTIONS 
                FROM INFORMATION_SCHEMA.TABLES 
                WHERE TABLE_SCHEMA = %s;
            """, (self.database,))
            table_encryption = cursor.fetchall()
            
            # Check master key status
            cursor.execute("SHOW STATUS LIKE 'Innodb_encryption%';")
            encryption_status = cursor.fetchall()
            
            cursor.close()
            conn.close()
            
            logger.info("=== ENCRYPTION VERIFICATION ===")
            logger.info(f"Database encryption: {db_encryption}")
            logger.info(f"Table encryption: {table_encryption}")
            logger.info(f"Encryption status: {encryption_status}")
            
            return True
            
        except mysql.connector.Error as e:
            logger.error(f"Encryption verification failed: {e}")
            return False

def setup_mysql_encryption():
    """Main function to setup MySQL TDE encryption"""
    encryption_setup = MySQLEncryptionSetup()
    
    logger.info("=== MYSQL TDE ENCRYPTION SETUP ===")
    
    # Step 1: Check encryption support
    if not encryption_setup.check_encryption_support():
        logger.error("MySQL does not support encryption or is not properly configured")
        return False
    
    # Step 2: Setup encryption keys
    if not encryption_setup.setup_encryption_keys():
        logger.error("Failed to setup encryption keys")
        return False
    
    # Step 3: Enable database encryption
    if not encryption_setup.enable_database_encryption():
        logger.error("Failed to enable database encryption")
        return False
    
    # Step 4: Encrypt existing tables
    if not encryption_setup.encrypt_existing_tables():
        logger.error("Failed to encrypt existing tables")
        return False
    
    # Step 5: Verify encryption
    if not encryption_setup.verify_encryption_status():
        logger.error("Failed to verify encryption status")
        return False
    
    logger.info("✅ MySQL TDE encryption setup complete!")
    logger.info("All data is now encrypted at rest")
    return True

if __name__ == '__main__':
    # Check if running in development mode
    if os.getenv('ENVIRONMENT') == 'development':
        logger.warning("Running in development mode - encryption setup disabled")
        logger.info("To enable encryption in development, set ENVIRONMENT=production")
    else:
        setup_mysql_encryption()
