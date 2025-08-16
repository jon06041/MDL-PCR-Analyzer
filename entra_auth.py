"""
Entra ID (Azure AD) Authentication Integration for MDL-PCR-Analyzer
Provides OAuth/OIDC authentication with Microsoft Entra ID
"""

import os
import requests
import jwt
import logging
from datetime import datetime, timedelta
from typing import Dict, Optional, List
from urllib.parse import urlencode
import secrets

logger = logging.getLogger(__name__)

class EntraAuthManager:
    """Handles Microsoft Entra ID (Azure AD) authentication"""
    
    def __init__(self):
        # Entra ID configuration from environment or defaults
        self.client_id = os.getenv('ENTRA_CLIENT_ID', '6345cabe-25c6-4f2d-a81f-dbc6f392f234')
        self.client_secret = os.getenv('ENTRA_CLIENT_SECRET', 'aaee4e07-3143-4df5-a1f9-7c306a227677')
        self.tenant_id = os.getenv('ENTRA_TENANT_ID', '5d79b88b-9063-46f3-92a6-41f3807a3d60')
        
        # OAuth endpoints
        self.authority = f"https://login.microsoftonline.com/{self.tenant_id}"
        self.oauth_endpoint = f"{self.authority}/oauth2/v2.0"
        self.authorize_url = f"{self.oauth_endpoint}/authorize"
        self.token_url = f"{self.oauth_endpoint}/token"
        self.jwks_url = f"{self.authority}/discovery/v2.0/keys"
        
        # Application configuration
        self.redirect_uri = os.getenv('ENTRA_REDIRECT_URI', 'http://localhost:5000/auth/callback')
        self.scopes = ['openid', 'profile', 'email', 'User.Read']
        
        # Role mapping from Entra groups to app roles
        self.group_role_mapping = {
            # Default mappings - can be configured via environment
            'qPCR-Administrators': 'administrator',
            'qPCR-ComplianceOfficers': 'compliance_officer', 
            'qPCR-QCTechnicians': 'qc_technician',
            'qPCR-LabTechnicians': 'lab_technician',
            'qPCR-ResearchUsers': 'research_user',
            'qPCR-Viewers': 'viewer'
        }
        
        # Cache for JWKs
        self._jwks_cache = None
        self._jwks_cache_expiry = None
        
    def get_authorization_url(self, state: str = None) -> str:
        """Generate OAuth authorization URL for Entra ID login"""
        if not state:
            state = secrets.token_urlsafe(32)
            
        params = {
            'client_id': self.client_id,
            'response_type': 'code',
            'redirect_uri': self.redirect_uri,
            'scope': ' '.join(self.scopes),
            'state': state,
            'response_mode': 'query'
        }
        
        auth_url = f"{self.authorize_url}?{urlencode(params)}"
        logger.info(f"Generated Entra authorization URL with state: {state}")
        return auth_url, state
    
    def exchange_code_for_tokens(self, authorization_code: str, state: str) -> Optional[Dict]:
        """Exchange authorization code for access and ID tokens"""
        try:
            token_data = {
                'grant_type': 'authorization_code',
                'client_id': self.client_id,
                'client_secret': self.client_secret,
                'code': authorization_code,
                'redirect_uri': self.redirect_uri,
                'scope': ' '.join(self.scopes)
            }
            
            response = requests.post(self.token_url, data=token_data, timeout=10)
            response.raise_for_status()
            
            tokens = response.json()
            logger.info("Successfully exchanged authorization code for tokens")
            return tokens
            
        except requests.RequestException as e:
            logger.error(f"Failed to exchange authorization code: {e}")
            return None
        except Exception as e:
            logger.error(f"Unexpected error during token exchange: {e}")
            return None
    
    def validate_id_token(self, id_token: str) -> Optional[Dict]:
        """Validate and decode ID token from Entra ID"""
        try:
            # Get signing keys
            jwks = self._get_jwks()
            if not jwks:
                logger.error("Failed to retrieve JWKS for token validation")
                return None
            
            # Decode header to get key ID
            unverified_header = jwt.get_unverified_header(id_token)
            kid = unverified_header.get('kid')
            
            if not kid:
                logger.error("No 'kid' found in token header")
                return None
            
            # Find matching key
            signing_key = None
            for key in jwks.get('keys', []):
                if key.get('kid') == kid:
                    signing_key = jwt.algorithms.RSAAlgorithm.from_jwk(key)
                    break
            
            if not signing_key:
                logger.error(f"No matching key found for kid: {kid}")
                return None
            
            # Validate and decode token
            payload = jwt.decode(
                id_token,
                signing_key,
                algorithms=['RS256'],
                audience=self.client_id,
                issuer=f"{self.authority}/v2.0"
            )
            
            logger.info(f"Successfully validated ID token for user: {payload.get('preferred_username', 'unknown')}")
            return payload
            
        except jwt.ExpiredSignatureError:
            logger.error("ID token has expired")
            return None
        except jwt.InvalidTokenError as e:
            logger.error(f"Invalid ID token: {e}")
            return None
        except Exception as e:
            logger.error(f"Unexpected error validating ID token: {e}")
            return None
    
    def get_user_info(self, access_token: str) -> Optional[Dict]:
        """Get user information from Microsoft Graph API"""
        try:
            headers = {'Authorization': f'Bearer {access_token}'}
            response = requests.get('https://graph.microsoft.com/v1.0/me', headers=headers, timeout=10)
            response.raise_for_status()
            
            user_info = response.json()
            logger.info(f"Retrieved user info for: {user_info.get('userPrincipalName', 'unknown')}")
            return user_info
            
        except requests.RequestException as e:
            logger.error(f"Failed to get user info from Graph API: {e}")
            return None
        except Exception as e:
            logger.error(f"Unexpected error getting user info: {e}")
            return None
    
    def get_user_groups(self, access_token: str) -> List[str]:
        """Get user's group memberships from Microsoft Graph API"""
        try:
            headers = {'Authorization': f'Bearer {access_token}'}
            response = requests.get(
                'https://graph.microsoft.com/v1.0/me/memberOf',
                headers=headers,
                timeout=10
            )
            response.raise_for_status()
            
            groups_data = response.json()
            group_names = []
            
            for group in groups_data.get('value', []):
                if group.get('@odata.type') == '#microsoft.graph.group':
                    group_names.append(group.get('displayName', ''))
            
            logger.info(f"Retrieved {len(group_names)} groups for user")
            return group_names
            
        except requests.RequestException as e:
            logger.error(f"Failed to get user groups: {e}")
            return []
        except Exception as e:
            logger.error(f"Unexpected error getting user groups: {e}")
            return []
    
    def map_groups_to_role(self, group_names: List[str]) -> str:
        """Map Entra ID group memberships to application role"""
        # Find highest priority role based on group membership
        user_roles = []
        
        for group_name in group_names:
            if group_name in self.group_role_mapping:
                user_roles.append(self.group_role_mapping[group_name])
        
        if not user_roles:
            logger.warning(f"No role mapping found for groups: {group_names}")
            return 'viewer'  # Default role
        
        # Role hierarchy (higher index = higher permissions)
        role_hierarchy = ['viewer', 'lab_technician', 'research_user', 'qc_technician', 'compliance_officer', 'administrator']
        
        # Find highest role
        highest_role = 'viewer'
        highest_index = 0
        
        for role in user_roles:
            if role in role_hierarchy:
                role_index = role_hierarchy.index(role)
                if role_index > highest_index:
                    highest_index = role_index
                    highest_role = role
        
        logger.info(f"Mapped groups {group_names} to role: {highest_role}")
        return highest_role
    
    def _get_jwks(self) -> Optional[Dict]:
        """Get JSON Web Key Set from Entra ID for token validation"""
        try:
            # Check cache first
            if (self._jwks_cache and self._jwks_cache_expiry and 
                datetime.now() < self._jwks_cache_expiry):
                return self._jwks_cache
            
            # Fetch fresh JWKS
            response = requests.get(self.jwks_url, timeout=10)
            response.raise_for_status()
            
            jwks = response.json()
            
            # Cache for 1 hour
            self._jwks_cache = jwks
            self._jwks_cache_expiry = datetime.now() + timedelta(hours=1)
            
            logger.info("Successfully retrieved and cached JWKS")
            return jwks
            
        except requests.RequestException as e:
            logger.error(f"Failed to retrieve JWKS: {e}")
            return None
        except Exception as e:
            logger.error(f"Unexpected error retrieving JWKS: {e}")
            return None
    
    def create_user_session_data(self, id_token_payload: Dict, user_info: Dict, 
                                groups: List[str]) -> Dict:
        """Create user session data from Entra ID authentication"""
        # Map groups to role
        role = self.map_groups_to_role(groups)
        
        # Extract user information
        user_data = {
            'user_id': id_token_payload.get('oid'),  # Object ID from Entra
            'username': user_info.get('userPrincipalName', ''),
            'email': user_info.get('mail', user_info.get('userPrincipalName', '')),
            'display_name': user_info.get('displayName', ''),
            'given_name': user_info.get('givenName', ''),
            'family_name': user_info.get('surname', ''),
            'role': role,
            'groups': groups,
            'auth_method': 'entra_id',
            'entra_oid': id_token_payload.get('oid'),
            'tenant_id': self.tenant_id
        }
        
        logger.info(f"Created session data for Entra user: {user_data['username']} with role: {role}")
        return user_data
    
    def is_enabled(self) -> bool:
        """Check if Entra ID authentication is properly configured"""
        required_configs = [self.client_id, self.client_secret, self.tenant_id]
        configured = all(config for config in required_configs)
        
        if configured:
            logger.info("Entra ID authentication is enabled and configured")
        else:
            logger.warning("Entra ID authentication is not fully configured")
            
        return configured
