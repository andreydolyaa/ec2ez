# EC2EZ

AWS IMDSv2 Exploitation Tool - Automated credential extraction and privilege analysis through SSRF vulnerabilities.

```
  ███████╗ ██████╗██████╗ ███████╗███████╗
  ██╔════╝██╔════╝╚════██╗██╔════╝╚══███╔╝
  █████╗  ██║      █████╔╝█████╗    ███╔╝
  ██╔══╝  ██║     ██╔═══╝ ██╔══╝   ███╔╝
  ███████╗╚██████╗███████╗███████╗███████╗
  ╚══════╝ ╚═════╝╚══════╝╚══════╝╚══════╝
```

## Disclaimer

**THIS TOOL IS INTENDED FOR EDUCATIONAL AND AUTHORIZED SECURITY TESTING PURPOSES ONLY**

By using this tool, you agree to:
- Only use it on systems you own or have explicit written permission to test
- Comply with all applicable laws and regulations
- Not use it for malicious purposes or unauthorized access
- Take full responsibility for any actions performed with this tool

Unauthorized access to computer systems is illegal. The authors assume no liability for misuse or damage caused by this tool.

## Features

- SSRF Vulnerability Testing: Automatically detects if a proxy endpoint is vulnerable to SSRF
- IMDSv2 Token Extraction: Bypasses IMDSv2 protections through SSRF vulnerabilities
- Multi-Role Enumeration: Discovers and extracts credentials for all IAM roles on the instance
- Comprehensive Permission Discovery: Enumerates IAM policies and identifies dangerous permissions
- S3 Bucket Discovery: Extracts bucket names from IMDS metadata and tests access with each role
- Pre-signed URL Generation: Automatically generates pre-signed URLs when direct access fails
- Interactive Menu: Permission-based action menu for post-exploitation
- Session Summary: Detailed report of all findings, credentials, and recommendations

## Requirements

- Node.js 18+
- AWS CLI installed and accessible in PATH
- Network access to the target SSRF endpoint

## Installation

```bash
git clone https://github.com/yourusername/ec2ez.git
cd ec2ez
npm install
```

## Usage

### Basic Usage

```bash
node ec2ez.js <ssrf-endpoint-url>
```

### Help

```bash
node ec2ez.js --help
node ec2ez.js -h
```

### Examples

```bash
# Example 1: Endpoint with 'url' parameter
node ec2ez.js http://vulnerable-site.com/proxy?url=

# Example 2: Endpoint with 'target' parameter
node ec2ez.js http://api.example.com/fetch?target=

# Example 3: Endpoint with 'endpoint' parameter
node ec2ez.js https://target.com/download?endpoint=

# Example 4: No parameter specified (defaults to 'url')
node ec2ez.js http://site.com/proxy
```

The URL should point to any endpoint vulnerable to SSRF that can forward requests to AWS IMDS (169.254.169.254).

### Parameter Auto-Detection

**The tool automatically detects the SSRF parameter name from your URL!**

Simply include the query parameter in the URL you provide:
- `http://site.com/proxy?url=` → Tool uses `url`
- `http://site.com/fetch?target=` → Tool uses `target`
- `http://site.com/download?endpoint=` → Tool uses `endpoint`
- `http://site.com/proxy` → Tool defaults to `url`

No configuration needed - just pass the URL with the parameter and the tool figures it out automatically.

### Expected Endpoint Behavior

The tool expects an SSRF-vulnerable endpoint that accepts a URL parameter:

```
# Common patterns:
http://site.com/proxy?url=<target>
http://site.com/fetch?target=<target>
http://site.com/download?endpoint=<target>
```

The vulnerable endpoint should:
- Forward the request to the URL specified in the parameter
- Support both GET and PUT requests (for IMDSv2 token generation)
- Return the response from the target URL
- Be able to reach 169.254.169.254 (AWS IMDS)

## Execution Flow

1. SSRF Vulnerability Test: Verifies the proxy can reach IMDS
2. IMDSv2 Token Extraction: Obtains session token for metadata access
3. IAM Role Enumeration: Discovers all available IAM roles
4. Credential Extraction: Retrieves AWS credentials for each role
5. IMDS Metadata Enumeration: Recursively explores all metadata paths
6. Credential Validation: Tests credentials across multiple AWS regions
7. Permission Discovery: Enumerates IAM policies and dangerous permissions
8. PassRole Detection: Identifies privilege escalation vectors
9. S3 Access Testing: Tests S3 access with each role
10. Bucket Discovery: Tests bucket names found in IMDS metadata
11. Interactive Menu: Provides permission-based actions
12. Summary Report: Displays comprehensive findings

## What Gets Extracted

### Credentials
- Access Key ID
- Secret Access Key
- Session Token
- Expiration time

### IMDS Metadata
- IAM role information
- Instance identity document
- User data
- Instance tags
- Network interfaces
- Security groups

### S3 Information
- Bucket names from metadata
- Accessible buckets per role
- Object listings
- Pre-signed URL generation commands

### Permissions
- Attached managed policies
- Inline policies
- Dangerous permission patterns
- Privilege escalation vectors

## Interactive Menu

After credential extraction, the tool provides an interactive menu with actions based on discovered permissions:

- EC2 Operations: Launch/List instances
- S3 Operations: List buckets
- IAM Operations: Enumerate users/roles
- Secrets Manager: List secrets
- SSM Parameter Store: List parameters
- Lambda: List functions

Actions are automatically available based on the IAM permissions of the extracted credentials.

## Project Structure

```
ec2ez/
├── ec2ez.js               # Main entry point
├── package.json           # Dependencies
├── README.md              # This file
└── src/
    ├── config.js          # Configuration and constants
    ├── utils.js           # Logging utilities
    ├── imds.js            # IMDSv2 interaction functions
    ├── aws.js             # AWS CLI wrappers
    ├── permissions.js     # Permission enumeration
    ├── interactive.js     # Interactive menu system
    ├── presigned.js       # Pre-signed URL discovery
    ├── s3discovery.js     # S3 bucket discovery and testing
    └── summary.js         # Session summary and reporting
```

## Configuration

Default configuration in `src/config.js`:

```javascript
export const CONFIG = {
  imdsv2: {
    baseUrl: "http://169.254.169.254",
  },
  aws: {
    defaultRegion: "il-central-1",  // Change if needed
  },
  ec2: {
    ami: "ami-006183c868a62af95",   // Region-specific AMI
    instanceType: "t3.micro",
  },
};
```

**Note:** The SSRF parameter name is automatically detected from the URL you provide - no manual configuration needed!

## Output

### Credentials File
Credentials are automatically written to `~/.aws/credentials`:
```ini
[default]
aws_access_key_id = ASIA...
aws_secret_access_key = abc123...
aws_session_token = IQoJ...
```

### Session Summary
At the end of execution, a comprehensive summary is displayed with:
- IMDSv2 token
- All discovered roles with credentials
- S3 access results per role
- IMDS metadata findings
- Permission enumeration results
- Recommendations

## CTF Usage

This tool is particularly useful for AWS-focused CTF challenges:

1. Find SSRF: Discover an SSRF vulnerability in the web application
2. Run EC2EZ: Extract credentials from IMDS
3. Enumerate Roles: Tool discovers all available IAM roles
4. Test S3 Access: Automatically tests which role has S3 permissions
5. Discover Buckets: Extracts bucket names from IMDS metadata
6. Access Objects: Get pre-signed URLs or download commands

### Example CTF Workflow

```bash
# 1. Find SSRF endpoint (could be any path)
curl http://ctf-challenge.com/api/fetch?url=http://169.254.169.254/

# 2. Run ec2ez with the vulnerable endpoint
node ec2ez.js http://ctf-challenge.com/api/fetch

# 3. Tool automatically:
#    - Extracts all role credentials
#    - Tests S3 access with each role
#    - Finds bucket names in metadata
#    - Shows which role can access which bucket
#    - Provides commands to access objects
```

## Troubleshooting

### Connection Refused
```
✗ SSRF vulnerability test failed
  Connection refused - proxy server is not reachable
```
**Solution**: Verify the proxy URL is correct and accessible

### 401 Unauthorized
```
✓ SSRF vulnerability confirmed!
✓ Proxy can reach IMDS endpoint (401 = IMDSv2 token required)
```
**This is expected** - means SSRF works and IMDSv2 is enabled

### Invalid Credentials
```
Credentials are invalid in all tested regions
```
**Possible causes**:
- Credentials expired
- Role has very limited permissions
- Region mismatch

### No S3 Access
```
✗ Role has no S3 access
```
**This is normal** - try other discovered roles or check the summary for bucket names
