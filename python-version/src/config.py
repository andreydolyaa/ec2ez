"""
EC2EZ Configuration Module
Contains all configuration constants and settings
"""

import os
from pathlib import Path


class Colors:
    """ANSI color codes for terminal output"""
    RESET = "\033[0m"
    BRIGHT = "\033[1m"
    DIM = "\033[2m"
    RED = "\033[31m"
    GREEN = "\033[32m"
    YELLOW = "\033[33m"
    BLUE = "\033[34m"
    MAGENTA = "\033[35m"
    CYAN = "\033[36m"
    WHITE = "\033[37m"


class Config:
    """Main configuration class"""

    # SSRF Configuration
    SSRF_PARAM_NAME = "url"  # Auto-detected from URL

    # IMDSv2 Configuration
    IMDSV2_BASE_URL = "http://169.254.169.254"
    IMDSV2_TOKEN_ENDPOINT = "/latest/api/token"
    IMDSV2_TOKEN_TTL = "21600"  # 6 hours in seconds
    IMDSV2_TOKEN_HEADER = "X-aws-ec2-metadata-token"
    IMDSV2_TOKEN_TTL_HEADER = "X-aws-ec2-metadata-token-ttl-seconds"

    # IMDS Endpoints
    IMDSV2_ENDPOINTS = {
        "token": "/latest/api/token",
        "credentials_base": "/latest/meta-data/iam/security-credentials",
        "iam_info": "/latest/meta-data/iam/info",
        "instance_id": "/latest/meta-data/instance-id",
        "availability_zone": "/latest/meta-data/placement/availability-zone",
        "user_data": "/latest/user-data",
        "metadata_base": "/latest/meta-data",
    }

    # AWS Configuration
    AWS_DEFAULT_REGION = "il-central-1"  # Mutable at runtime
    AWS_CREDENTIALS_PATH = str(Path.home() / ".aws" / "credentials")
    AWS_CONFIG_PATH = str(Path.home() / ".aws" / "config")

    # Regions to try for credential validation
    AWS_REGIONS_TO_TRY = [
        "il-central-1",
        "us-east-1",
        "us-west-2",
        "eu-west-1",
        "ap-southeast-1",
    ]

    # EC2 Configuration
    EC2_AMI = "ami-006183c868a62af95"
    EC2_INSTANCE_TYPE = "t3.micro"
    EC2_TAG_NAME = "ec2ez-test-instance"

    # S3 Configuration
    S3_MAX_KEYS = 10  # Limit object listing to first N objects

    # Timeout Configuration (seconds)
    HTTP_TIMEOUT = 10
    AWS_COMMAND_TIMEOUT = 30

    # Dangerous Permissions List
    DANGEROUS_PERMISSIONS = [
        "iam:CreateUser",
        "iam:CreateAccessKey",
        "iam:AttachUserPolicy",
        "iam:PutUserPolicy",
        "iam:CreateRole",
        "iam:AttachRolePolicy",
        "iam:PutRolePolicy",
        "iam:PassRole",
        "iam:UpdateAssumeRolePolicy",
        "sts:AssumeRole",
        "ec2:RunInstances",
        "lambda:CreateFunction",
        "lambda:InvokeFunction",
        "lambda:UpdateFunctionCode",
        "s3:PutBucketPolicy",
        "s3:PutObject",
        "secretsmanager:GetSecretValue",
        "ssm:GetParameter",
        "ssm:PutParameter",
    ]

    # Permission Test Definitions
    PERMISSION_TESTS = [
        {
            "permission": "sts:GetCallerIdentity",
            "service": "sts",
            "action": "get_caller_identity",
            "test_type": "boto3",
        },
        {
            "permission": "ec2:DescribeInstances",
            "service": "ec2",
            "action": "describe_instances",
            "params": {"MaxResults": 5},
            "test_type": "boto3",
        },
        {
            "permission": "ec2:DescribeKeyPairs",
            "service": "ec2",
            "action": "describe_key_pairs",
            "params": {"MaxResults": 1},
            "test_type": "boto3",
        },
        {
            "permission": "ec2:DescribeVpcs",
            "service": "ec2",
            "action": "describe_vpcs",
            "params": {"MaxResults": 1},
            "test_type": "boto3",
        },
        {
            "permission": "ec2:DescribeSubnets",
            "service": "ec2",
            "action": "describe_subnets",
            "params": {"MaxResults": 1},
            "test_type": "boto3",
        },
        {
            "permission": "ec2:DescribeSecurityGroups",
            "service": "ec2",
            "action": "describe_security_groups",
            "params": {"MaxResults": 1},
            "test_type": "boto3",
        },
        {
            "permission": "s3:ListAllMyBuckets",
            "service": "s3",
            "action": "list_buckets",
            "test_type": "boto3",
        },
        {
            "permission": "iam:ListUsers",
            "service": "iam",
            "action": "list_users",
            "params": {"MaxItems": 1},
            "test_type": "boto3",
        },
        {
            "permission": "iam:ListRoles",
            "service": "iam",
            "action": "list_roles",
            "params": {"MaxItems": 1},
            "test_type": "boto3",
        },
        {
            "permission": "iam:GetUser",
            "service": "iam",
            "action": "get_user",
            "test_type": "boto3",
        },
        {
            "permission": "secretsmanager:ListSecrets",
            "service": "secretsmanager",
            "action": "list_secrets",
            "params": {"MaxResults": 1},
            "test_type": "boto3",
        },
        {
            "permission": "ssm:DescribeParameters",
            "service": "ssm",
            "action": "describe_parameters",
            "params": {"MaxResults": 1},
            "test_type": "boto3",
        },
        {
            "permission": "lambda:ListFunctions",
            "service": "lambda",
            "action": "list_functions",
            "params": {"MaxItems": 1},
            "test_type": "boto3",
        },
    ]

    @classmethod
    def update_region(cls, region):
        """Update the default AWS region at runtime"""
        cls.AWS_DEFAULT_REGION = region

    @classmethod
    def update_ssrf_param(cls, param_name):
        """Update the SSRF parameter name"""
        cls.SSRF_PARAM_NAME = param_name


# Singleton instances
COLORS = Colors()
CONFIG = Config()
