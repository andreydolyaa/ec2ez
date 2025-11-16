# CLAUDE.md - EC2EZ Codebase Guide for AI Assistants

**Last Updated:** 2025-11-16
**Project:** EC2EZ - AWS IMDSv2 Exploitation Tool
**Version:** 1.0.0

## Table of Contents

1. [Project Overview](#project-overview)
2. [Architecture & Structure](#architecture--structure)
3. [Development Setup](#development-setup)
4. [Code Conventions](#code-conventions)
5. [Key Workflows](#key-workflows)
6. [Module Reference](#module-reference)
7. [Security Considerations](#security-considerations)
8. [Testing & Debugging](#testing--debugging)
9. [Common Tasks](#common-tasks)
10. [Important Notes for AI Assistants](#important-notes-for-ai-assistants)

---

## Project Overview

### Purpose
EC2EZ is an AWS IMDSv2 (Instance Metadata Service v2) exploitation tool designed for **authorized security testing and educational purposes only**. It automates the extraction of AWS credentials through SSRF (Server-Side Request Forgery) vulnerabilities and performs comprehensive privilege analysis.

### Core Functionality
- Tests SSRF vulnerability endpoints
- Extracts IMDSv2 tokens through SSRF
- Enumerates all IAM roles on EC2 instances
- Extracts AWS credentials for each role
- Discovers IMDS metadata (tags, user-data, etc.)
- Tests S3 access across all discovered roles
- Enumerates IAM permissions
- Provides interactive post-exploitation menu
- Generates comprehensive session summary

### Complete Feature Map

```
EC2EZ - Feature Tree
│
├─ 🔍 RECONNAISSANCE & DISCOVERY
│  ├─ SSRF Vulnerability Testing
│  │  └─ Auto-detect SSRF parameter name (url, target, etc.)
│  │
│  ├─ IMDSv2 Token Extraction
│  │  └─ 6-hour TTL token via PUT request
│  │
│  ├─ IAM Role Enumeration
│  │  ├─ List all roles on EC2 instance
│  │  └─ Extract credentials for each role
│  │
│  ├─ IMDS Metadata Discovery
│  │  ├─ Recursive metadata tree exploration
│  │  ├─ Tree-structured display (files/folders)
│  │  ├─ Pre-signed URL detection
│  │  └─ S3 bucket reference extraction
│  │
│  └─ IAM Permission Analysis
│     ├─ Parse managed policies (parallel fetching)
│     ├─ Parse inline policies
│     ├─ Identify dangerous permissions
│     ├─ Check for PassRole capability
│     └─ Group permissions by service
│
├─ 🔐 CREDENTIAL MANAGEMENT
│  ├─ Multi-role credential extraction
│  ├─ Auto-write to ~/.aws/credentials
│  ├─ Multi-region validation
│  └─ Expiration time tracking
│
├─ ☁️ AWS SERVICE OPERATIONS (Interactive Menu)
│  │
│  ├─ EC2 Operations
│  │  ├─ Launch EC2 Instance (requires: ec2:RunInstances)
│  │  │  ├─ Auto-detect first key pair
│  │  │  ├─ Auto-detect first VPC
│  │  │  ├─ Auto-detect first subnet
│  │  │  └─ Auto-detect first security group
│  │  │
│  │  └─ List EC2 Instances (requires: ec2:DescribeInstances)
│  │     └─ Show instance ID, state, type, and name
│  │
│  ├─ S3 Operations
│  │  ├─ List S3 Buckets (requires: s3:ListAllMyBuckets)
│  │  │  └─ Display all buckets in account
│  │  │
│  │  ├─ List S3 Bucket Objects (requires: s3:ListBucket)
│  │  │  ├─ Prompt for bucket name
│  │  │  ├─ Optional prefix filtering
│  │  │  └─ Show object keys and sizes
│  │  │
│  │  ├─ Download S3 Object (requires: s3:GetObject)
│  │  │  ├─ Prompt for bucket, key, local path
│  │  │  └─ Download to local filesystem
│  │  │
│  │  └─ Upload S3 Object (requires: s3:PutObject)
│  │     ├─ Prompt for local path, bucket, key
│  │     └─ Upload from local filesystem
│  │
│  ├─ IAM Operations
│  │  ├─ List IAM Users (requires: iam:ListUsers)
│  │  │  └─ Display all IAM users in account
│  │  │
│  │  └─ List IAM Roles (requires: iam:ListRoles)
│  │     └─ Display all IAM roles in account
│  │
│  ├─ SSM (Systems Manager) Operations
│  │  ├─ List SSM Parameters (requires: ssm:DescribeParameters)
│  │  │  └─ Display all parameter names
│  │  │
│  │  ├─ Read SSM Parameter Value (requires: ssm:GetParameter)
│  │  │  ├─ Auto-list available parameters first
│  │  │  ├─ Prompt for parameter name
│  │  │  └─ Display decrypted value
│  │  │
│  │  └─ Create/Update SSM Parameter (requires: ssm:PutParameter)
│  │     ├─ Prompt for name, value, type
│  │     └─ Support String/SecureString/StringList
│  │
│  ├─ Secrets Manager Operations
│  │  ├─ List Secrets (requires: secretsmanager:ListSecrets)
│  │  │  └─ Display all secret names
│  │  │
│  │  └─ Read Secret Value (requires: secretsmanager:GetSecretValue)
│  │     ├─ Auto-list available secrets first
│  │     ├─ Prompt for secret name
│  │     └─ Display decrypted secret
│  │
│  ├─ Lambda Operations
│  │  ├─ List Lambda Functions (requires: lambda:ListFunctions)
│  │  │  └─ Display all function names
│  │  │
│  │  └─ Invoke Lambda (requires: lambda:InvokeFunction)
│  │     ├─ Prompt for function name and payload
│  │     └─ Display function response
│  │
│  ├─ Multi-Service Operations
│  │  └─ Extract All Secrets & Parameters (requires: secretsmanager:GetSecretValue OR ssm:GetParameter)
│  │     ├─ Bulk download ALL Secrets Manager secrets (if permission available)
│  │     ├─ Bulk download ALL SSM parameters (if permission available)
│  │     ├─ Automatic credential pattern detection:
│  │     │  ├─ AWS Access Keys (AKIA...)
│  │     │  ├─ AWS Secret Keys (40-char base64)
│  │     │  ├─ Private Keys (-----BEGIN...PRIVATE KEY-----)
│  │     │  ├─ Password fields (password=, passwd:, etc.)
│  │     │  ├─ API tokens (api_key=, token:, bearer:, etc.)
│  │     │  └─ URLs with credentials (http://user:pass@host)
│  │     ├─ Save to timestamped file (secrets_extracted_YYYY-MM-DD_HH-MM-SS.txt)
│  │     └─ Display findings summary with counts
│  │
│  └─ System Operations
│     └─ Run Shell Command (always available)
│        ├─ Execute arbitrary shell commands
│        ├─ Display stdout and stderr
│        └─ Examples: ls, pwd, find, cat, etc.
│
├─ 🎯 AUTOMATED S3 TESTING
│  ├─ Test S3 access for all discovered roles
│  ├─ List buckets with each role's credentials
│  ├─ List objects in each accessible bucket
│  ├─ Test bucket names discovered from IMDS metadata
│  └─ Display presign command examples
│
├─ 📊 REPORTING & ANALYSIS
│  ├─ Session Summary
│  │  ├─ IMDS findings (token, metadata count)
│  │  ├─ All discovered roles with credentials
│  │  ├─ Credential validation results
│  │  ├─ Permission analysis
│  │  ├─ Dangerous permissions highlighted
│  │  └─ S3 access summary
│  │
│  └─ Real-time Logging
│     ├─ Color-coded output (success/error/warning/info)
│     ├─ Timestamp on all operations
│     └─ Detailed operation progress
│
└─ 🔧 UTILITIES
   ├─ Multi-region AWS credential validation
   ├─ Parallel IAM policy fetching (4-6x faster)
   ├─ Dynamic menu based on discovered permissions
   ├─ Readline interface sharing (no double input bug)
   └─ Auto-detect SSRF parameter from URL
```

### Permission-Based Menu System

The interactive menu dynamically constructs available actions based on **actual discovered permissions**:

| Menu Option | Required Permission(s) | Risk Level |
|------------|----------------------|-----------|
| Launch EC2 Instance | `ec2:RunInstances` | SAFE |
| List EC2 Instances | `ec2:DescribeInstances` | SAFE |
| List S3 Buckets | `s3:ListAllMyBuckets` | SAFE |
| Download S3 Object | `s3:GetObject` | SAFE |
| Upload S3 Object | `s3:PutObject` | SENSITIVE |
| List S3 Bucket Objects | `s3:ListBucket` | SAFE |
| List IAM Users | `iam:ListUsers` | SENSITIVE |
| List IAM Roles | `iam:ListRoles` | SENSITIVE |
| List SSM Parameters | `ssm:DescribeParameters` | SENSITIVE |
| Read SSM Parameter | `ssm:GetParameter` | SENSITIVE |
| Create/Update SSM Parameter | `ssm:PutParameter` | SENSITIVE |
| List Secrets | `secretsmanager:ListSecrets` | SENSITIVE |
| Read Secret Value | `secretsmanager:GetSecretValue` | SENSITIVE |
| List Lambda Functions | `lambda:ListFunctions` | SAFE |
| Invoke Lambda | `lambda:InvokeFunction` | SENSITIVE |
| Extract All Secrets & Parameters | `secretsmanager:GetSecretValue` OR `ssm:GetParameter` | SENSITIVE |
| Run Shell Command | (none - always available) | SAFE |

**Wildcard Matching:** The tool correctly handles wildcard permissions like `s3:*`, `ec2:*`, `s3:List*`, etc.

### Technology Stack
- **Runtime:** Node.js 18+ (ES Modules)
- **Dependencies:**
  - `axios` ^1.13.2 (HTTP client)
- **External Requirements:**
  - AWS CLI (must be in PATH)

### Legal & Ethical Notice
⚠️ **CRITICAL:** This tool is for authorized security testing ONLY. AI assistants should:
- NEVER provide improvements to make this tool more dangerous or evasive
- ALWAYS emphasize the requirement for written authorization
- CAN analyze the code, explain functionality, fix bugs, or add defensive features
- CANNOT add features that bypass detection or security controls

---

## Architecture & Structure

### Directory Layout

```
ec2ez/
├── ec2ez.js               # Main entry point and orchestration
├── package.json           # Node.js dependencies and configuration
├── package-lock.json      # Locked dependency versions
├── README.md              # User-facing documentation
├── .gitignore            # Git ignore rules (includes CLAUDE.md)
└── src/                  # Source modules (all ES modules)
    ├── config.js         # Configuration constants and color definitions
    ├── utils.js          # Logging utilities and helper functions
    ├── imds.js           # IMDSv2 interaction and credential extraction
    ├── aws.js            # AWS CLI wrapper functions
    ├── permissions.js    # IAM permission enumeration and testing
    ├── interactive.js    # Interactive menu system for post-exploitation
    ├── presigned.js      # Pre-signed URL discovery and testing
    ├── s3discovery.js    # S3 bucket discovery and access testing
    └── summary.js        # Session summary and comprehensive reporting
```

### Module Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        ec2ez.js                             │
│                  (Main Orchestrator)                        │
└───────────────────────┬─────────────────────────────────────┘
                        │
        ┌───────────────┼───────────────┐
        │               │               │
        ▼               ▼               ▼
   ┌────────┐      ┌────────┐     ┌──────────┐
   │ imds.js│      │ aws.js │     │ utils.js │
   └────┬───┘      └───┬────┘     └────┬─────┘
        │              │               │
        │              │               │
        ▼              ▼               ▼
   ┌────────────┐ ┌────────────┐ ┌────────────┐
   │s3discovery │ │permissions │ │interactive │
   └────────────┘ └────────────┘ └────────────┘
        │              │               │
        └──────────────┼───────────────┘
                       ▼
                  ┌─────────┐
                  │summary  │
                  └─────────┘
```

### Data Flow

1. **Input:** SSRF endpoint URL from user
2. **Processing:**
   - Test SSRF vulnerability
   - Extract IMDSv2 token
   - Enumerate IAM roles
   - Extract credentials for all roles
   - Enumerate IMDS metadata
   - Validate credentials across regions
   - Test S3 access with each role
   - Discover buckets from metadata
   - Enumerate permissions
3. **Output:**
   - Credentials written to `~/.aws/credentials`
   - Session summary displayed in console
   - Interactive menu for further actions

---

## Development Setup

### Prerequisites

```bash
# Required
node --version  # Must be >= 18.x
aws --version   # AWS CLI must be installed

# Installation
git clone <repository-url>
cd ec2ez
npm install
```

### Running the Tool

```bash
# Basic usage
node ec2ez.js http://vulnerable-site.com/proxy?url=

# With different parameter names
node ec2ez.js http://api.example.com/fetch?target=

# Help
node ec2ez.js --help
```

### Development Environment

- **Module System:** ES Modules (ESM)
  - All files use `import/export` syntax
  - `package.json` has `"type": "module"`
- **No TypeScript:** Pure JavaScript
- **No Build Step:** Direct execution with Node.js
- **No Tests:** Currently no test suite (opportunity for contribution)

---

## Code Conventions

### JavaScript Style

1. **ES Modules:**
   ```javascript
   // Correct: Named exports
   export function myFunction() { }
   export const CONFIG = { };

   // Correct: Import with extensions
   import { myFunction } from "./module.js";
   ```

2. **File Extensions:**
   - Always include `.js` extension in imports
   - Example: `import { log } from "./utils.js"`

3. **Naming Conventions:**
   - Functions: `camelCase` (e.g., `fetchIMDSv2Token`)
   - Constants: `UPPER_SNAKE_CASE` (e.g., `CONFIG`, `COLORS`)
   - Variables: `camelCase` (e.g., `proxyUrl`, `iamRole`)
   - Classes: `PascalCase` (e.g., `SessionSummary`)

4. **Async/Await:**
   - Preferred over Promise chains
   - Always use try/catch for error handling
   - Example:
     ```javascript
     try {
       const result = await someAsyncFunction();
       logSuccess("Operation completed");
     } catch (error) {
       logError("Operation failed");
       throw error;
     }
     ```

### Logging Convention

**Always use utility functions from `utils.js`:**

```javascript
import { log, logInfo, logSuccess, logError, logWarning, logSeparator } from "./utils.js";

// Information
logInfo("Starting process...");

// Success
logSuccess("✓ Operation completed");

// Errors
logError("✗ Operation failed");

// Warnings
logWarning("⚠ This is a warning");

// Custom colored output
log("Custom message", null, "cyan");

// Separators for readability
logSeparator();  // Prints 80 dashes
```

**Color Reference (from COLORS in config.js):**
- `red`: Errors and critical information
- `green`: Success messages
- `yellow`: Warnings
- `cyan`: Informational messages
- `magenta`: Dangerous permissions/actions
- `dim`: Less important details
- `bright`: Headers and important text

### Error Handling Pattern

```javascript
// Standard pattern used throughout codebase
try {
  // Attempt operation
  const result = await riskyOperation();
  logSuccess("Operation succeeded");
  return result;
} catch (error) {
  logError("Operation failed");
  log(error.message, null, "red");

  // Either throw or return gracefully depending on criticality
  throw error;  // For critical operations
  // OR
  return null;  // For non-critical operations
}
```

### Configuration Pattern

All configuration lives in `src/config.js`:

```javascript
export const CONFIG = {
  ssrf: {
    paramName: "url",  // Auto-detected from user input
  },
  imdsv2: {
    baseUrl: "http://169.254.169.254",
    endpoints: { /* ... */ },
    headers: { /* ... */ },
  },
  aws: {
    defaultRegion: "il-central-1",  // Can be updated at runtime
    credentialsPath: "~/.aws/credentials",
  },
  ec2: {
    ami: "ami-006183c868a62af95",
    instanceType: "t3.micro",
    // ...
  },
};
```

**When modifying CONFIG:**
- Region can be updated at runtime via `updateRegionInConfig()` in `aws.js`
- SSRF param name is auto-detected in `ec2ez.js` via `extractSSRFParam()`

---

## Key Workflows

### 1. SSRF Vulnerability Testing

**File:** `src/imds.js`
**Function:** `testSSRFVulnerability(proxyUrl)`

```javascript
// Tests if proxy can reach IMDS
// Returns: true if vulnerable (200 or 401), false otherwise
// 401 is expected for IMDSv2 (token required)
```

### 2. IMDSv2 Token Extraction

**File:** `src/imds.js`
**Function:** `fetchIMDSv2Token(proxyUrl)`

```javascript
// Uses PUT request to get token
// Token TTL: 21600 seconds (6 hours)
// Returns: token string
```

### 3. IAM Role Enumeration

**File:** `src/imds.js`
**Function:** `fetchAllIAMRoles(proxyUrl, token)`

```javascript
// Fetches all IAM roles from IMDS
// Endpoint: /latest/meta-data/iam/security-credentials
// Returns: array of role names
```

### 4. Credential Extraction

**File:** `src/imds.js`
**Function:** `fetchCredentials(proxyUrl, token, role)`

```javascript
// Extracts credentials for specific role
// Returns object with:
// - AccessKeyId
// - SecretAccessKey
// - Token (session token)
// - Expiration
```

### 5. Credential Validation

**File:** `src/aws.js`
**Function:** `validateCredentials(tryMultipleRegions = true)`

```javascript
// Validates using: aws sts get-caller-identity
// Tries multiple regions if first fails
// Updates CONFIG.aws.defaultRegion if different region works
// Returns: { valid, region, accountId, arn, userId }
```

### 6. Permission Enumeration

**File:** `src/permissions.js`
**Function:** `discoverPermissionsByTesting()`

```javascript
// Tests common AWS permissions by attempting operations
// Tracks which operations succeed (permission granted)
// Returns: {
//   totalPermissions,
//   allPermissions: [],
//   permissionsByService: {},
//   dangerousPermissionsList: [],
// }
```

### 7. S3 Access Testing

**File:** `src/s3discovery.js`
**Function:** `testS3AccessWithCredentials(roleName, accessKeyId, secretKey, token)`

```javascript
// Tests S3 access for specific role
// Lists buckets and objects
// Returns: { listBuckets, buckets: [] }
```

### 8. Interactive Menu

**File:** `src/interactive.js`
**Function:** `runInteractiveMenu(permissionResults)`

```javascript
// Provides menu based on discovered permissions
// Actions: Launch EC2, List S3, List IAM, etc.
// Loops until user exits
```

### 9. Session Summary

**File:** `src/summary.js`
**Class:** `SessionSummary`

```javascript
// Tracks all findings throughout session
// Methods:
// - addRole(roleData)
// - setCredentials(data)
// - setIMDS(data)
// - setPermissions(data)
// - addS3Finding(type, data)
// - display() // Shows comprehensive report
```

---

## Module Reference

### config.js

**Purpose:** Central configuration and constants

**Exports:**
- `CONFIG`: Main configuration object
- `COLORS`: ANSI color codes for terminal output

**Key Constants:**
```javascript
CONFIG.imdsv2.baseUrl           // "http://169.254.169.254"
CONFIG.imdsv2.endpoints.token   // "/latest/api/token"
CONFIG.aws.defaultRegion        // "il-central-1" (mutable)
CONFIG.ssrf.paramName           // Auto-detected from URL
```

---

### utils.js

**Purpose:** Logging utilities and helper functions

**Key Exports:**
- `log(message, data, color)`: Base logging function
- `logSuccess(message)`: Green success messages
- `logError(message)`: Red error messages
- `logWarning(message)`: Yellow warnings
- `logInfo(message)`: Cyan informational messages
- `logDanger(message)`: Magenta for dangerous actions
- `logSeparator()`: Prints 80-dash line
- `displayBanner()`: ASCII art banner
- `extractSSRFParam(url)`: Auto-detects SSRF parameter name
- `sleep(ms)`: Promise-based delay

**Usage:**
```javascript
import { logInfo, logSuccess, logSeparator } from "./utils.js";

logInfo("Starting operation...");
// ... do work ...
logSuccess("✓ Operation complete");
logSeparator();
```

---

### imds.js

**Purpose:** All IMDSv2 interactions

**Key Functions:**

1. `testSSRFVulnerability(proxyUrl)`
   - Tests if endpoint can reach IMDS
   - Returns: boolean

2. `fetchIMDSv2Token(proxyUrl)`
   - Extracts IMDSv2 token via PUT request
   - Returns: token string

3. `fetchAllIAMRoles(proxyUrl, token)`
   - Lists all IAM roles from IMDS
   - Returns: array of role names

4. `fetchCredentials(proxyUrl, token, role)`
   - Extracts credentials for specific role
   - Returns: credential object

5. `writeAWSCredentials(accessKeyId, secretKey, token, region)`
   - Writes credentials to `~/.aws/credentials`
   - Also writes config to `~/.aws/config`

**IMDS Endpoints Used:**
- `/latest/api/token` - Token generation (PUT)
- `/latest/meta-data/iam/security-credentials` - List roles
- `/latest/meta-data/iam/security-credentials/{role}` - Get credentials
- `/latest/meta-data/iam/info` - IAM info

---

### aws.js

**Purpose:** AWS CLI wrapper functions

**Key Functions:**

1. `executeAWSCommand(command)`
   - Executes arbitrary AWS CLI command
   - Returns: stdout string

2. `validateCredentials(tryMultipleRegions = true)`
   - Validates credentials using `aws sts get-caller-identity`
   - Tries multiple regions on failure
   - Updates CONFIG.aws.defaultRegion if needed
   - Returns: validation object

3. Resource Discovery:
   - `getFirstKeyPair()` - Gets first EC2 key pair
   - `getFirstVPC()` - Gets first VPC
   - `getFirstSubnet(vpcId)` - Gets first subnet in VPC
   - `getFirstSecurityGroup(vpcId)` - Gets first security group

4. Resource Operations:
   - `launchEC2Instance()` - Launches EC2 instance
   - `listS3Buckets()` - Lists S3 buckets
   - `listSecrets()` - Lists Secrets Manager secrets
   - `listSSMParameters()` - Lists SSM parameters
   - `listIAMUsers()` - Lists IAM users
   - `listIAMRoles()` - Lists IAM roles
   - `listEC2Instances()` - Lists EC2 instances
   - `listLambdaFunctions()` - Lists Lambda functions

**Important:** All functions depend on AWS CLI being in PATH and credentials in `~/.aws/credentials`

---

### permissions.js

**Purpose:** IAM permission enumeration

**Key Functions:**

1. `discoverPermissionsByTesting()`
   - Tests common AWS permissions
   - Returns: permission summary object

2. `enumerateRolePermissions(roleName)`
   - Comprehensive permission enumeration
   - Identifies dangerous permissions
   - Returns: detailed permission object

3. `checkPassRolePolicy(roleName)`
   - Checks for PassRole permission (privilege escalation)
   - Logs findings

**Permission Test List:**
- sts:GetCallerIdentity
- ec2:DescribeInstances, DescribeKeyPairs, DescribeVpcs, etc.
- s3:ListAllMyBuckets
- iam:ListUsers, ListRoles, GetUser
- secretsmanager:ListSecrets
- ssm:DescribeParameters
- lambda:ListFunctions

---

### s3discovery.js

**Purpose:** S3 bucket discovery and access testing

**Key Functions:**

1. `enumerateIMDSRecursive(proxyUrl, token, basePath)`
   - Recursively crawls IMDS metadata
   - Returns: metadata object (path -> value)

2. `extractS3References(metadata)`
   - Extracts S3 bucket names and URLs from metadata
   - Returns: { bucketNames: [], urls: [] }

3. `testS3Access()`
   - Tests S3 access with current credentials
   - Returns: S3 test results

4. `testS3AccessWithCredentials(roleName, accessKeyId, secretKey, token)`
   - Tests S3 with specific role credentials
   - Lists buckets and objects
   - Returns: { listBuckets, buckets: [] }

5. `discoverBuckets(metadata)`
   - Discovers bucket names from metadata
   - Returns: array of bucket names

---

### interactive.js

**Purpose:** Post-exploitation interactive menu

**Key Functions:**

1. `runInteractiveMenu(permissionResults)`
   - Displays menu based on permissions
   - Loops until user exits
   - Executes selected actions

**Menu Options (permission-dependent):**
- Launch EC2 instance
- List EC2 instances
- List S3 buckets
- List IAM users
- List IAM roles
- List Secrets Manager secrets
- List SSM parameters
- List Lambda functions
- Exit

---

### presigned.js

**Purpose:** Pre-signed URL discovery and testing

**Key Functions:**

1. `discoverPresignedURLs(proxyUrl, token)`
   - Searches IMDS metadata for pre-signed URLs
   - Returns: { urls: [], metadata: {} }

2. `testPresignedURLs(urls)`
   - Tests discovered pre-signed URLs
   - Returns: array of working URLs

3. `displayMetadata(metadata)`
   - Pretty-prints metadata findings

---

### summary.js

**Purpose:** Comprehensive session reporting

**Class:** `SessionSummary`

**Properties:**
```javascript
this.findings = {
  imds: {
    token: null,
    totalMetadata: 0,
    interestingPaths: [],
  },
  credentials: {
    extracted: false,
    valid: false,
    roleName: null,
    region: null,
    accountId: null,
    expiresIn: null,
  },
  roles: [],  // Array of all discovered roles with credentials
  permissions: {
    total: 0,
    discovered: [],
    dangerous: [],
  },
  s3: {
    accessibleBuckets: [],
    objects: [],
    presignedUrls: [],
  },
};
```

**Methods:**
- `addRole(roleData)`: Add discovered role
- `setCredentials(data)`: Update credential info
- `setIMDS(data)`: Update IMDS findings
- `setPermissions(data)`: Update permission findings
- `addS3Finding(type, data)`: Add S3 bucket/object/URL
- `display()`: Show comprehensive formatted report

---

### ec2ez.js (Main Entry Point)

**Purpose:** Orchestrates entire attack flow

**Execution Flow:**

1. Parse command line arguments
2. Display banner
3. Auto-detect SSRF parameter name
4. Test SSRF vulnerability
5. Extract IMDSv2 token
6. Enumerate all IAM roles
7. Extract credentials for each role
8. Enumerate IMDS metadata recursively
9. Discover pre-signed URLs
10. Extract S3 references from metadata
11. Write credentials to `~/.aws/credentials`
12. Validate credentials across regions
13. Enumerate permissions
14. Check for PassRole permission
15. Test S3 access for all roles
16. Test discovered bucket names
17. Launch interactive menu
18. Display session summary

**Command Line Interface:**
```bash
node ec2ez.js --help           # Show help
node ec2ez.js <ssrf-url>       # Run exploitation
```

---

## Security Considerations

### For AI Assistants

**DO:**
- Analyze and explain how the code works
- Fix bugs or improve code quality
- Add logging or debugging features
- Improve error handling
- Add input validation
- Optimize performance
- Update documentation

**DO NOT:**
- Add features to bypass security controls
- Add features to evade detection
- Make the tool more stealthy or covert
- Add persistence mechanisms
- Add data exfiltration features
- Remove security warnings or disclaimers
- Help users use this tool without authorization

### Current Security Features

1. **Disclaimer Required:**
   - Banner displays security warning
   - Help text emphasizes authorized testing only

2. **No Obfuscation:**
   - Code is intentionally clear and readable
   - No anti-analysis techniques

3. **Logging:**
   - All actions logged to console
   - Timestamps on all operations
   - Clear audit trail

### Credential Handling

**Credentials are written to:**
- `~/.aws/credentials` (access keys and session token)
- `~/.aws/config` (region and output format)

**Important:** These files contain sensitive credentials and should be:
- Protected with appropriate file permissions
- Cleared after testing
- Never committed to version control

---

## Testing & Debugging

### Automated Testing

The project includes a comprehensive test suite using Jest with excellent coverage for core modules.

**Running Tests:**

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage report
npm run test:coverage
```

**Test Coverage:**

- **config.js**: 100% coverage - Configuration and constants
- **imds.js**: 96.77% coverage - IMDS interactions and credential extraction
- **utils.js**: 84.84% coverage - Logging and helper functions
- **summary.js**: 80.32% coverage - Session summary and reporting
- **aws.js**: Integration tests for AWS CLI wrapper functions

**Test Files:**

```
tests/
├── config.test.js     # Configuration tests
├── utils.test.js      # Utility function tests (logging, helpers)
├── imds.test.js       # IMDS interaction tests with axios mocks
├── summary.test.js    # Session summary class tests
└── aws.test.js        # AWS CLI wrapper integration tests
```

**Testing Approach:**

- **Unit Tests**: Core modules tested with mocked dependencies (axios, fs)
- **Integration Tests**: AWS CLI wrapper tested with real command execution
- **Mock Strategy**: Uses Jest spies for axios, fs operations
- **Console Suppression**: All console output mocked during tests for clean output

### Manual Testing

For end-to-end testing with real AWS infrastructure:

1. **Set up test environment:**
   - Deploy vulnerable SSRF endpoint
   - Launch EC2 instance with IAM role
   - Configure IMDSv2

2. **Test basic flow:**
   ```bash
   node ec2ez.js http://localhost:8080/proxy?url=
   ```

3. **Verify outputs:**
   - Check console logs for errors
   - Verify `~/.aws/credentials` was created
   - Check session summary for completeness

### Debugging Tips

1. **Enable verbose AWS CLI output:**
   ```javascript
   // In aws.js, modify executeAWSCommand:
   const command = originalCommand + " --debug";
   ```

2. **Add debug logging:**
   ```javascript
   import { log } from "./utils.js";
   log(`Debug: variable = ${JSON.stringify(variable)}`, null, "yellow");
   ```

3. **Test IMDS locally:**
   ```bash
   # Test direct IMDS access (if on EC2)
   curl -X PUT "http://169.254.169.254/latest/api/token" \
     -H "X-aws-ec2-metadata-token-ttl-seconds: 21600"
   ```

4. **Common Issues:**
   - **"Connection refused"**: Proxy URL incorrect or proxy not running
   - **"InvalidClientTokenId"**: Credentials expired or region mismatch
   - **"401 Unauthorized"**: Expected for IMDSv2 - token required
   - **No roles found**: EC2 instance has no IAM instance profile

### Logging Levels

Current implementation uses color-coded severity:
- **Red (logError)**: Fatal errors, credential failures
- **Yellow (logWarning)**: Warnings, non-fatal issues
- **Green (logSuccess)**: Successful operations
- **Cyan (logInfo)**: Informational messages
- **Magenta (logDanger)**: Dangerous permissions, privilege escalation
- **Dim**: Less important details

---

## Common Tasks

### Adding a New AWS Service Check

**Example: Adding DynamoDB table listing**

1. **Add to `aws.js`:**
   ```javascript
   export async function listDynamoDBTables() {
     try {
       logInfo("Listing DynamoDB tables...");
       const output = await executeAWSCommand(
         "aws dynamodb list-tables --output json"
       );
       const tables = JSON.parse(output);
       if (tables.TableNames && tables.TableNames.length > 0) {
         tables.TableNames.forEach((table) => {
           log(`  - ${table}`, null, "cyan");
         });
         logSuccess(`Found ${tables.TableNames.length} tables`);
       } else {
         logInfo("No DynamoDB tables found");
       }
       return tables;
     } catch (error) {
       logError("Failed to list DynamoDB tables");
       throw error;
     }
   }
   ```

2. **Add permission test to `permissions.js`:**
   ```javascript
   {
     permission: "dynamodb:ListTables",
     command: "aws dynamodb list-tables --max-items 1 --output json"
   }
   ```

3. **Add to interactive menu in `interactive.js`:**
   ```javascript
   if (hasPermission("dynamodb:ListTables", discoveredPermissions)) {
     console.log("  7. List DynamoDB tables");
     menuOptions.push({
       key: "7",
       action: async () => {
         await listDynamoDBTables();
         logSeparator();
       },
     });
   }
   ```

### Adding a New IMDS Metadata Path

**Example: Extracting instance tags**

1. **Create function in `imds.js`:**
   ```javascript
   export async function fetchInstanceTags(proxyUrl, token) {
     const tagsUrl = `${CONFIG.imdsv2.baseUrl}/latest/meta-data/tags/instance`;
     const fullUrl = `${proxyUrl}?${CONFIG.ssrf.paramName}=${tagsUrl}`;

     try {
       const response = await axios.get(fullUrl, {
         headers: {
           [CONFIG.imdsv2.headers.tokenRequest]: token,
         },
       });
       return response.data;
     } catch (error) {
       logError("Failed to fetch instance tags");
       return null;
     }
   }
   ```

2. **Call from `ec2ez.js`:**
   ```javascript
   const tags = await fetchInstanceTags(proxyUrl, token);
   if (tags) {
     logInfo("Instance tags:");
     console.log(tags);
   }
   ```

### Modifying Credential Output Format

**Current location:** `src/imds.js` - `writeAWSCredentials()`

To change format:
```javascript
const credentialsContent = `[profile-name]
aws_access_key_id = ${accessKeyId}
aws_secret_access_key = ${secretKey}
aws_session_token = ${token}
region = ${region}
`;
```

### Adding New Summary Sections

**Location:** `src/summary.js` - `SessionSummary.display()`

```javascript
// Add new section to display()
if (this.findings.newSection && this.findings.newSection.length > 0) {
  logInfo("New Section Findings:");
  this.findings.newSection.forEach((item) => {
    log(`  - ${item}`, null, "cyan");
  });
  logSeparator();
}
```

---

## Important Notes for AI Assistants

### When Helping with This Codebase

1. **Always Verify Authorization Context:**
   - If user asks for improvements, ensure they're for authorized testing
   - Remind users this is for educational/authorized testing only
   - Don't add features that make detection harder

2. **Code Analysis is OK:**
   - Explaining how the code works: ✅
   - Documenting the attack flow: ✅
   - Fixing bugs: ✅
   - Adding defensive logging: ✅
   - Improving error handling: ✅

3. **Enhancement Guidelines:**
   - Adding new AWS service checks: ✅
   - Improving output formatting: ✅
   - Better error messages: ✅
   - Performance optimization: ✅
   - Adding evasion techniques: ❌
   - Removing warnings/disclaimers: ❌
   - Anti-forensics features: ❌

4. **Understand the Dual-Use Nature:**
   - This is a legitimate security testing tool
   - It requires clear authorization context
   - It's also used in CTF competitions and training
   - AI assistants should support defensive/authorized use cases

### Common User Questions

**Q: "How do I make this tool faster?"**
- ✅ Suggest: Parallel credential testing, caching, better error handling
- ❌ Suggest: Removing logging, disabling output, stealth mode

**Q: "How do I avoid detection?"**
- ❌ This violates authorization context
- ✅ Response: "This tool is for authorized testing where detection evasion is not appropriate. If you're doing authorized testing, coordinate with the blue team."

**Q: "Can you add feature X?"**
- ✅ Analyze if it's defensive or improves usability
- ❌ If it aids unauthorized access or evasion

**Q: "How does the IMDS exploitation work?"**
- ✅ Explain the technical details
- ✅ Reference IMDS documentation
- ✅ Explain the security implications

**Q: "Why am I getting errors?"**
- ✅ Debug the issue
- ✅ Check logs and provide solutions
- ✅ Explain AWS CLI errors

### Code Maintenance Guidelines

1. **Preserve ES Module Structure:**
   - Always use `.js` extensions in imports
   - Maintain `"type": "module"` in package.json

2. **Keep Logging Consistent:**
   - Use utility functions from `utils.js`
   - Follow color conventions
   - Include separators for readability

3. **Error Handling:**
   - Always use try/catch for async operations
   - Log errors before throwing
   - Provide helpful error messages

4. **Configuration:**
   - Keep all constants in `config.js`
   - Document new configuration options
   - Ensure CONFIG can be modified at runtime if needed

5. **Documentation:**
   - Update this CLAUDE.md when making structural changes
   - Update README.md for user-facing features
   - Add inline comments for complex logic

### Technical Limitations to Remember

1. **AWS CLI Dependency:**
   - All AWS operations go through AWS CLI
   - Requires AWS CLI to be in PATH
   - Credentials must be in `~/.aws/credentials`

2. **IMDSv2 Specifics:**
   - Token required for all requests
   - Token TTL: 6 hours (21600 seconds)
   - Tokens obtained via PUT request

3. **SSRF Requirements:**
   - Endpoint must support both GET and PUT
   - Must be able to reach 169.254.169.254
   - Must forward custom headers (for token)

4. **Region Handling:**
   - Some services are region-specific
   - Tool tests multiple regions on credential failure
   - Updates CONFIG at runtime when finding working region

### Project Evolution

**Current Version:** 1.0.0

**Potential Improvements (authorized contexts):**
- Add automated tests
- Add configuration file support
- Improve error messages
- Add output formats (JSON, CSV)
- Better credential expiration handling
- Support for assume-role chains
- More comprehensive IMDS enumeration
- Better S3 object discovery

**Not Appropriate:**
- Evasion techniques
- Anti-forensics
- Encrypted communication
- Covert channels
- Detection bypass

---

## Quick Reference

### Most Common Functions by Module

**utils.js:**
```javascript
logInfo("Message")           // Cyan informational
logSuccess("Message")        // Green success
logError("Message")          // Red error
logWarning("Message")        // Yellow warning
logSeparator()               // 80 dashes
```

**imds.js:**
```javascript
await testSSRFVulnerability(proxyUrl)
await fetchIMDSv2Token(proxyUrl)
await fetchAllIAMRoles(proxyUrl, token)
await fetchCredentials(proxyUrl, token, role)
writeAWSCredentials(accessKeyId, secretKey, token, region)
```

**aws.js:**
```javascript
await executeAWSCommand(command)
await validateCredentials()
await listS3Buckets()
await launchEC2Instance()
```

**summary.js:**
```javascript
const summary = new SessionSummary()
summary.addRole(roleData)
summary.setCredentials(data)
summary.display()
```

### File Paths to Remember

- Credentials: `~/.aws/credentials`
- Config: `~/.aws/config`
- Main entry: `/ec2ez.js`
- All modules: `/src/*.js`

### Key Configuration Values

```javascript
CONFIG.imdsv2.baseUrl = "http://169.254.169.254"
CONFIG.aws.defaultRegion = "il-central-1"  // Mutable
CONFIG.ssrf.paramName = "url"  // Auto-detected
```

---

## Version History

**1.0.0** (Initial Release)
- Core IMDS exploitation functionality
- Multi-role enumeration
- S3 discovery and testing
- Permission enumeration
- Interactive menu
- Session summary

---

## Additional Resources

### AWS Documentation
- [IMDSv2 Documentation](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/configuring-instance-metadata-service.html)
- [IAM Roles for EC2](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/iam-roles-for-amazon-ec2.html)
- [AWS CLI Reference](https://docs.aws.amazon.com/cli/latest/reference/)

### Security References
- OWASP SSRF: https://owasp.org/www-community/attacks/Server_Side_Request_Forgery
- AWS Security Best Practices
- IMDSv2 Security Improvements

---

**End of CLAUDE.md**

This document should be updated when significant architectural or functional changes are made to the codebase. AI assistants should reference this document for context when working with the EC2EZ project.
