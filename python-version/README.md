# EC2EZ - Python Edition

**AWS IMDSv2 Exploitation Tool for Authorized Security Testing**

[![Python](https://img.shields.io/badge/Python-3.8+-blue.svg)](https://www.python.org)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

## ⚠️ Legal Notice

**AUTHORIZED TESTING ONLY**

This tool is designed for **authorized security testing and educational purposes only**. Unauthorized access to computer systems is illegal. Only use this tool on systems you have explicit written permission to test.

## 🚀 Features

- **IMDSv2 Token Extraction** via SSRF vulnerabilities
- **IAM Role Enumeration** and credential extraction
- **Metadata Discovery** with recursive enumeration
- **Permission Testing** using boto3 SDK
- **S3 Access Testing** across discovered roles
- **Credential Detection** in metadata
- **Interactive Menu** for post-exploitation
- **Session Summary** with comprehensive reporting

## 🔧 Installation

### Prerequisites

- Python 3.8 or higher
- pip package manager

### Install Dependencies

```bash
# Clone the repository
git clone <repository-url>
cd ec2ez-python

# Install dependencies
pip install -r requirements.txt

# Or install with setup.py
pip install -e .
```

### Dependencies

- **boto3** - AWS SDK for Python
- **requests** - HTTP library for SSRF exploitation

## 📖 Usage

### Basic Usage

```bash
python3 ec2ez.py http://vulnerable-site.com/proxy?url=
```

### With Different Parameter Names

```bash
python3 ec2ez.py http://api.example.com/fetch?target=
```

### Skip Interactive Menu

```bash
python3 ec2ez.py http://vulnerable.com/ssrf?url= --no-interactive
```

### Help

```bash
python3 ec2ez.py --help
```

## 📂 Project Structure

```
ec2ez-python/
├── ec2ez.py              # Main entry point
├── requirements.txt      # Python dependencies
├── setup.py             # Package configuration
├── README.md            # This file
└── src/                 # Core modules
    ├── __init__.py
    ├── config.py        # Configuration constants
    ├── utils.py         # Logging and helpers
    ├── imds.py          # IMDSv2 interactions
    ├── aws.py           # boto3 SDK wrapper
    ├── permissions.py   # Permission enumeration
    ├── s3discovery.py   # S3 discovery
    ├── interactive.py   # Interactive menu
    └── summary.py       # Session reporting
```

## 🎯 Key Advantages Over Node.js Version

### 1. **Native AWS SDK (boto3)**
- No dependency on AWS CLI installation
- Direct programmatic control
- Better error handling
- Faster execution (no subprocess overhead)

### 2. **Python Ecosystem**
- More common in security/pentesting tools
- Better integration with other security tools
- Rich security libraries available

### 3. **Clean, Modular Design**
- Short, focused files (~100-200 lines each)
- Clear separation of concerns
- Easy to maintain and extend

## 🔍 How It Works

1. **SSRF Test** - Validates endpoint can reach IMDS
2. **Token Extraction** - Obtains 6-hour IMDSv2 token via PUT request
3. **Role Enumeration** - Lists all IAM roles on EC2 instance
4. **Credential Extraction** - Extracts AWS credentials for each role
5. **Metadata Discovery** - Recursively enumerates IMDS metadata tree
6. **Credential Scanning** - Detects secrets in metadata
7. **AWS Validation** - Validates credentials across multiple regions
8. **Permission Testing** - Discovers available IAM permissions
9. **S3 Access Test** - Tests S3 access with discovered credentials
10. **Interactive Menu** - Provides post-exploitation actions
11. **Summary Report** - Displays comprehensive findings

## 🛡️ Security Features

- Clear warnings and disclaimers
- No code obfuscation
- Detailed logging for audit trails
- Educational focus

## 🧪 Testing

The tool automatically tests the following permissions:

- ✅ `sts:GetCallerIdentity`
- ✅ `ec2:DescribeInstances`
- ✅ `s3:ListAllMyBuckets`
- ✅ `iam:ListUsers` / `iam:ListRoles`
- ✅ `secretsmanager:ListSecrets`
- ✅ `ssm:DescribeParameters`
- ✅ `lambda:ListFunctions`

## 📊 Example Output

```
    ███████╗ ██████╗██████╗ ███████╗███████╗
    ██╔════╝██╔════╝╚════██╗██╔════╝╚══███╔╝
    █████╗  ██║      █████╔╝█████╗    ███╔╝
    ██╔══╝  ██║     ██╔═══╝ ██╔══╝   ███╔╝
    ███████╗╚██████╗███████╗███████╗███████╗
    ╚══════╝ ╚═════╝╚══════╝╚══════╝╚══════╝

    AWS IMDSv2 Exploitation Tool
    Version: 1.1.0 (Python Edition)

    ⚠️  AUTHORIZED TESTING ONLY ⚠️

ℹ Testing SSRF vulnerability...
✓ SSRF vulnerability confirmed (status: 401)
✓ IMDSv2 token obtained (length: 56)
✓ Found 1 IAM role(s)
  - MyEC2Role
✓ Credentials extracted successfully
✓ Credentials written to ~/.aws/credentials
✓ Credentials are valid
  Account ID: 123456789012
  Region: us-east-1
```

## 🤝 Contributing

Contributions are welcome for:
- Bug fixes
- Performance improvements
- Documentation improvements
- Additional AWS service support

**NOT accepted:**
- Evasion techniques
- Anti-forensics features
- Detection bypass methods

## 📝 License

MIT License - See LICENSE file for details

## 🔗 Related Projects

- [EC2EZ Node.js](../ec2ez) - Original Node.js version
- [Pacu](https://github.com/RhinoSecurityLabs/pacu) - AWS exploitation framework
- [CloudMapper](https://github.com/duo-labs/cloudmapper) - AWS visualization

## ⚡ Performance Notes

Python version is generally faster than Node.js version due to:
- Native boto3 SDK (no CLI subprocess overhead)
- Efficient HTTP request handling
- Better memory management for large metadata sets

## 📧 Support

For issues and questions:
- Open an issue on GitHub
- Ensure you're using Python 3.8+
- Provide full error messages and context

---

**Remember: Only use this tool for authorized security testing!**
