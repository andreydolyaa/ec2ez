"""
EC2EZ Summary Module
Session summary and reporting
"""

from .utils import log, log_separator, log_info, log_success, log_warning, format_timestamp
from .config import COLORS


class SessionSummary:
    """Track and display session findings"""

    def __init__(self):
        self.findings = {
            'imds': {
                'token': None,
                'token_length': 0,
                'metadata_count': 0,
                'secrets_found': 0
            },
            'credentials': {
                'extracted': False,
                'valid': False,
                'role_name': None,
                'account_id': None,
                'region': None
            },
            'roles': [],
            'permissions': {
                'total': 0,
                'discovered': [],
                'dangerous': []
            },
            's3': {
                'buckets': [],
                'accessible_count': 0
            }
        }

    def set_token(self, token):
        """Record IMDSv2 token"""
        self.findings['imds']['token'] = token
        self.findings['imds']['token_length'] = len(token) if token else 0

    def set_credentials(self, credentials, validation):
        """Record extracted credentials"""
        self.findings['credentials'] = {
            'extracted': True,
            'valid': validation.get('valid', False),
            'role_name': credentials.get('RoleName'),
            'account_id': validation.get('account_id'),
            'region': validation.get('region')
        }

    def add_role(self, role_data):
        """Add discovered role"""
        self.findings['roles'].append(role_data)

    def set_permissions(self, perm_data):
        """Record permission data"""
        self.findings['permissions'] = perm_data

    def set_metadata_count(self, count):
        """Set metadata entry count"""
        self.findings['imds']['metadata_count'] = count

    def set_secrets_count(self, count):
        """Set secrets found count"""
        self.findings['imds']['secrets_found'] = count

    def add_s3_buckets(self, buckets):
        """Add S3 buckets"""
        self.findings['s3']['buckets'] = buckets
        self.findings['s3']['accessible_count'] = len(buckets)

    def display(self):
        """Display comprehensive session summary"""
        log_separator()
        log(f"{COLORS.BRIGHT}SESSION SUMMARY{COLORS.RESET}", color="cyan")
        log_separator()

        # IMDS Findings
        log("\n📡 IMDS Findings:", color="bright")
        if self.findings['imds']['token']:
            log_success(f"  ✓ Token obtained (length: {self.findings['imds']['token_length']})")
        log_info(f"  Metadata entries: {self.findings['imds']['metadata_count']}")
        if self.findings['imds']['secrets_found'] > 0:
            log_warning(f"  ⚠ Secrets found: {self.findings['imds']['secrets_found']}")

        # Credentials
        log("\n🔑 Credentials:", color="bright")
        creds = self.findings['credentials']
        if creds['extracted']:
            status = "✓ Valid" if creds['valid'] else "✗ Invalid"
            log(f"  {status}", color="green" if creds['valid'] else "red")
            log_info(f"  Role: {creds['role_name']}")
            log_info(f"  Account: {creds['account_id']}")
            log_info(f"  Region: {creds['region']}")

        # Roles
        if self.findings['roles']:
            log(f"\n👤 Roles ({len(self.findings['roles'])}):", color="bright")
            for role in self.findings['roles']:
                log(f"  - {role}", color="cyan")

        # Permissions
        log("\n🔐 Permissions:", color="bright")
        perms = self.findings['permissions']
        log_info(f"  Total discovered: {perms['total']}")
        if perms['dangerous']:
            log_warning(f"  ⚠ Dangerous: {len(perms['dangerous'])}")
            for perm in perms['dangerous'][:5]:
                log(f"    - {perm}", color="magenta")

        # S3
        if self.findings['s3']['accessible_count'] > 0:
            log("\n☁️  S3 Access:", color="bright")
            log_success(f"  ✓ Accessible buckets: {self.findings['s3']['accessible_count']}")

        log_separator()
