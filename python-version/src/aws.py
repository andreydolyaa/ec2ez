"""
EC2EZ AWS Module
Boto3 SDK wrapper for AWS operations
"""

import boto3
from botocore.exceptions import ClientError, NoCredentialsError
from .config import CONFIG
from .utils import log_info, log_success, log_error, log_warning, log


class AWSClient:
    """AWS client wrapper using boto3"""

    def __init__(self, region=None):
        self.region = region or CONFIG.AWS_DEFAULT_REGION
        self.session = None

    def create_session(self, profile='default'):
        """Create boto3 session with specified profile"""
        try:
            self.session = boto3.Session(profile_name=profile, region_name=self.region)
            return True
        except Exception as e:
            log_error(f"Failed to create session: {str(e)}")
            return False

    def get_client(self, service):
        """Get boto3 client for specified service"""
        if not self.session:
            self.create_session()
        return self.session.client(service, region_name=self.region)

    def validate_credentials(self, try_multiple_regions=True):
        """Validate AWS credentials"""
        try:
            log_info("Validating AWS credentials...")
            sts = self.get_client('sts')
            identity = sts.get_caller_identity()

            log_success("✓ Credentials are valid")
            log(f"  Account ID: {identity['Account']}", color="green")
            log(f"  ARN: {identity['Arn']}", color="green")
            log(f"  Region: {self.region}", color="green")

            return {
                'valid': True,
                'region': self.region,
                'account_id': identity['Account'],
                'arn': identity['Arn'],
                'user_id': identity['UserId']
            }

        except ClientError as e:
            if try_multiple_regions:
                return self._try_other_regions()
            log_error(f"Credential validation failed: {str(e)}")
            return {'valid': False}

    def _try_other_regions(self):
        """Try validating credentials in different regions"""
        log_warning("Trying alternative regions...")

        for region in CONFIG.AWS_REGIONS_TO_TRY:
            if region == self.region:
                continue

            try:
                log_info(f"Trying region: {region}")
                temp_client = boto3.client('sts', region_name=region)
                identity = temp_client.get_caller_identity()

                log_success(f"✓ Valid in region: {region}")
                self.region = region
                CONFIG.update_region(region)

                return {
                    'valid': True,
                    'region': region,
                    'account_id': identity['Account'],
                    'arn': identity['Arn'],
                    'user_id': identity['UserId']
                }
            except ClientError:
                continue

        log_error("Credentials invalid in all tested regions")
        return {'valid': False}


def list_s3_buckets():
    """List all S3 buckets"""
    try:
        client = AWSClient()
        s3 = client.get_client('s3')
        response = s3.list_buckets()

        buckets = response.get('Buckets', [])
        log_success(f"Found {len(buckets)} bucket(s)")

        for bucket in buckets:
            log(f"  - {bucket['Name']}", color="cyan")

        return buckets
    except ClientError as e:
        log_error(f"Failed to list buckets: {str(e)}")
        return []


def list_iam_users():
    """List IAM users"""
    try:
        client = AWSClient()
        iam = client.get_client('iam')
        response = iam.list_users(MaxItems=100)

        users = response.get('Users', [])
        log_success(f"Found {len(users)} user(s)")

        for user in users:
            log(f"  - {user['UserName']}", color="cyan")

        return users
    except ClientError as e:
        log_error(f"Failed to list users: {str(e)}")
        return []


def list_iam_roles():
    """List IAM roles"""
    try:
        client = AWSClient()
        iam = client.get_client('iam')
        response = iam.list_roles(MaxItems=100)

        roles = response.get('Roles', [])
        log_success(f"Found {len(roles)} role(s)")

        for role in roles:
            log(f"  - {role['RoleName']}", color="cyan")

        return roles
    except ClientError as e:
        log_error(f"Failed to list roles: {str(e)}")
        return []


def list_ec2_instances():
    """List EC2 instances"""
    try:
        client = AWSClient()
        ec2 = client.get_client('ec2')
        response = ec2.describe_instances(MaxResults=20)

        instances = []
        for reservation in response.get('Reservations', []):
            instances.extend(reservation.get('Instances', []))

        log_success(f"Found {len(instances)} instance(s)")

        for instance in instances:
            state = instance['State']['Name']
            log(f"  - {instance['InstanceId']} ({state})", color="cyan")

        return instances
    except ClientError as e:
        log_error(f"Failed to list instances: {str(e)}")
        return []
