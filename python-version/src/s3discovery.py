"""
EC2EZ S3 Discovery Module
S3 bucket discovery and IMDS metadata enumeration
"""

import re
import boto3
from botocore.exceptions import ClientError
from .imds import fetch_metadata, enumerate_imds_recursive
from .utils import log_info, log_success, log_error, log_warning, log, detect_credentials_in_text


def extract_s3_references(metadata):
    """Extract S3 bucket names and URLs from metadata"""
    bucket_names = set()
    urls = []

    # Regex patterns for S3 references
    bucket_pattern = r's3://([a-z0-9.-]+)'
    url_pattern = r'https?://([a-z0-9.-]+)\.s3[.-]([a-z0-9-]+)?\.amazonaws\.com'

    for path, value in metadata.items():
        if not isinstance(value, str):
            continue

        # Find s3:// URLs
        for match in re.finditer(bucket_pattern, value):
            bucket_names.add(match.group(1))

        # Find HTTPS S3 URLs
        for match in re.finditer(url_pattern, value):
            bucket_names.add(match.group(1))
            urls.append(value)

    return {
        'bucket_names': list(bucket_names),
        'urls': urls
    }


def test_s3_access(bucket_name=None):
    """Test S3 access with current credentials"""
    try:
        s3 = boto3.client('s3')

        if bucket_name:
            # Test specific bucket
            log_info(f"Testing access to bucket: {bucket_name}")
            response = s3.list_objects_v2(Bucket=bucket_name, MaxKeys=10)
            objects = response.get('Contents', [])
            log_success(f"✓ Access granted ({len(objects)} objects)")
            return objects
        else:
            # List all buckets
            response = s3.list_buckets()
            buckets = response.get('Buckets', [])
            log_success(f"✓ Found {len(buckets)} accessible bucket(s)")
            return buckets

    except ClientError as e:
        log_error(f"S3 access failed: {str(e)}")
        return []


def scan_metadata_for_secrets(metadata):
    """Scan IMDS metadata for embedded credentials"""
    findings = []

    for path, value in metadata.items():
        if not isinstance(value, str):
            continue

        credentials = detect_credentials_in_text(value)

        for cred in credentials:
            findings.append({
                'path': path,
                'type': cred['type'],
                'value': cred['value']
            })

    if findings:
        log_warning(f"⚠ Found {len(findings)} potential secret(s) in metadata")
        for finding in findings:
            log(f"  {finding['type']} in {finding['path']}", color="yellow")

    return findings
