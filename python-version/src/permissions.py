"""
EC2EZ Permissions Module
IAM permission enumeration and testing
"""

import boto3
from botocore.exceptions import ClientError
from .config import CONFIG
from .utils import log_info, log_success, log_warning, log, is_dangerous_permission


def test_permission(service, action, params=None):
    """Test a single permission by attempting to use it"""
    try:
        client = boto3.client(service, region_name=CONFIG.AWS_DEFAULT_REGION)
        method = getattr(client, action)

        if params:
            method(**params)
        else:
            method()

        return True
    except ClientError as e:
        error_code = e.response.get('Error', {}).get('Code', '')
        # AccessDenied means no permission, anything else means we have permission
        return error_code != 'AccessDenied'
    except Exception:
        return False


def discover_permissions():
    """Discover available permissions by testing"""
    log_info("Testing permissions...")

    discovered = []
    dangerous = []

    for test in CONFIG.PERMISSION_TESTS:
        permission = test['permission']
        service = test['service']
        action = test['action']
        params = test.get('params', None)

        if test_permission(service, action, params):
            discovered.append(permission)
            log_success(f"✓ {permission}")

            if is_dangerous_permission(permission):
                dangerous.append(permission)
                log(f"  🔥 DANGEROUS", color="magenta")

    log_success(f"\nTotal permissions discovered: {len(discovered)}")
    if dangerous:
        log_warning(f"Dangerous permissions: {len(dangerous)}")

    return {
        'total': len(discovered),
        'permissions': discovered,
        'dangerous': dangerous
    }


def enumerate_role_permissions(role_name):
    """Enumerate all permissions for an IAM role"""
    try:
        log_info(f"Enumerating permissions for role: {role_name}")

        iam = boto3.client('iam', region_name=CONFIG.AWS_DEFAULT_REGION)

        # Get attached managed policies
        attached = iam.list_attached_role_policies(RoleName=role_name)
        policy_arns = [p['PolicyArn'] for p in attached.get('AttachedPolicies', [])]

        permissions = []

        for arn in policy_arns:
            policy = iam.get_policy(PolicyArn=arn)
            version_id = policy['Policy']['DefaultVersionId']
            policy_version = iam.get_policy_version(PolicyArn=arn, VersionId=version_id)

            statements = policy_version['PolicyVersion']['Document'].get('Statement', [])
            for stmt in statements:
                if stmt.get('Effect') == 'Allow':
                    actions = stmt.get('Action', [])
                    if isinstance(actions, str):
                        actions = [actions]
                    permissions.extend(actions)

        return list(set(permissions))

    except ClientError as e:
        log_warning(f"Could not enumerate role permissions: {str(e)}")
        return []
