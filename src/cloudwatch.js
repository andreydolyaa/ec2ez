import { executeAWSCommand } from "./aws.js";
import { scanForSecrets } from "./userdata.js";
import fs from "fs";
import {
  logInfo,
  logSuccess,
  logError,
  logWarning,
  logSeparator,
  log,
} from "./utils.js";

/**
 * Lists all CloudWatch log groups accessible with current credentials
 * @returns {Promise<Array>} Array of log group objects
 */
export async function listLogGroups() {
  try {
    logInfo("Listing CloudWatch log groups...");

    const output = await executeAWSCommand(
      "aws logs describe-log-groups --output json"
    );
    const data = JSON.parse(output);

    if (data.logGroups && data.logGroups.length > 0) {
      logSuccess(`✓ Found ${data.logGroups.length} log group(s)`);
      data.logGroups.forEach((group) => {
        log(`  - ${group.logGroupName}`, null, "cyan");
      });
      return data.logGroups;
    } else {
      logWarning("No log groups found");
      return [];
    }
  } catch (error) {
    logError("Failed to list log groups");
    log(error.message, null, "red");
    return [];
  }
}

/**
 * Lists log streams for a specific log group
 * @param {string} logGroupName - Name of the log group
 * @param {number} limit - Maximum number of streams to return
 * @returns {Promise<Array>} Array of log stream objects
 */
export async function listLogStreams(logGroupName, limit = 5) {
  try {
    const output = await executeAWSCommand(
      `aws logs describe-log-streams --log-group-name "${logGroupName}" --order-by LastEventTime --descending --max-items ${limit} --output json`
    );
    const data = JSON.parse(output);

    if (data.logStreams && data.logStreams.length > 0) {
      return data.logStreams;
    }
    return [];
  } catch (error) {
    logError(`Failed to list log streams for ${logGroupName}`);
    return [];
  }
}

/**
 * Fetches log events from a specific log stream
 * @param {string} logGroupName - Name of the log group
 * @param {string} logStreamName - Name of the log stream
 * @param {number} limit - Maximum number of events to fetch
 * @returns {Promise<Array>} Array of log event objects
 */
export async function getLogEvents(logGroupName, logStreamName, limit = 100) {
  try {
    const output = await executeAWSCommand(
      `aws logs get-log-events --log-group-name "${logGroupName}" --log-stream-name "${logStreamName}" --limit ${limit} --output json`
    );
    const data = JSON.parse(output);

    if (data.events && data.events.length > 0) {
      return data.events;
    }
    return [];
  } catch (error) {
    logError(`Failed to fetch log events from ${logStreamName}`);
    return [];
  }
}

/**
 * Scans CloudWatch logs for secrets and sensitive information
 * @param {string} logGroupName - Optional specific log group to scan (scans all if not provided)
 * @param {number} maxStreamsPerGroup - Maximum log streams to check per group
 * @param {number} maxEventsPerStream - Maximum events to fetch per stream
 * @returns {Promise<Object>} Analysis results with found secrets
 */
export async function scanCloudWatchLogs(
  logGroupName = null,
  maxStreamsPerGroup = 3,
  maxEventsPerStream = 100
) {
  logSeparator();
  log("CLOUDWATCH LOGS EXTRACTION & ANALYSIS", null, "bright");
  logSeparator();
  console.log();

  const results = {
    scannedGroups: 0,
    scannedStreams: 0,
    scannedEvents: 0,
    secretsFound: [],
    logGroupsWithSecrets: [],
  };

  try {
    // Get log groups to scan
    let logGroups = [];
    if (logGroupName) {
      logGroups = [{ logGroupName }];
      logInfo(`Scanning specific log group: ${logGroupName}`);
    } else {
      logGroups = await listLogGroups();
      if (logGroups.length === 0) {
        logWarning("No log groups to scan");
        return results;
      }
    }

    console.log();
    logInfo(
      `Scanning ${logGroups.length} log group(s) for sensitive information...`
    );
    console.log();

    // Scan each log group
    for (const group of logGroups) {
      const groupName = group.logGroupName;
      results.scannedGroups++;

      log(`Scanning: ${groupName}`, null, "cyan");

      // Get recent log streams
      const streams = await listLogStreams(groupName, maxStreamsPerGroup);

      if (streams.length === 0) {
        log(`  No log streams found`, null, "dim");
        continue;
      }

      log(`  Found ${streams.length} recent log stream(s)`, null, "dim");

      // Scan each stream
      for (const stream of streams) {
        const streamName = stream.logStreamName;
        results.scannedStreams++;

        // Fetch log events
        const events = await getLogEvents(
          groupName,
          streamName,
          maxEventsPerStream
        );

        if (events.length === 0) {
          continue;
        }

        results.scannedEvents += events.length;

        // Combine all log messages for scanning
        const logContent = events.map((e) => e.message).join("\n");

        // Scan for secrets
        const secrets = scanForSecrets(logContent);

        if (secrets.length > 0) {
          // Add context to each secret
          secrets.forEach((secret) => {
            secret.logGroup = groupName;
            secret.logStream = streamName;
          });

          results.secretsFound.push(...secrets);

          if (!results.logGroupsWithSecrets.includes(groupName)) {
            results.logGroupsWithSecrets.push(groupName);
          }
        }
      }
    }

    // Display summary
    console.log();
    logSeparator();
    log("SCAN SUMMARY", null, "bright");
    logSeparator();

    log(`Log groups scanned: ${results.scannedGroups}`, null, "cyan");
    log(`Log streams scanned: ${results.scannedStreams}`, null, "cyan");
    log(`Log events analyzed: ${results.scannedEvents}`, null, "cyan");
    console.log();

    if (results.secretsFound.length > 0) {
      // Count by severity
      const critical = results.secretsFound.filter(
        (s) => s.severity === "CRITICAL"
      );
      const high = results.secretsFound.filter((s) => s.severity === "HIGH");
      const medium = results.secretsFound.filter(
        (s) => s.severity === "MEDIUM"
      );

      log(
        `⚠ FOUND ${results.secretsFound.length} POTENTIAL SECRET(S)`,
        null,
        "red"
      );
      console.log();

      if (critical.length > 0) {
        log(`[CRITICAL] ${critical.length} secret(s):`, null, "red");
        critical.forEach((secret) => {
          log(
            `  • ${secret.type} in ${secret.logGroup}/${secret.logStream}`,
            null,
            "red"
          );
          log(`    Value: ${secret.value.substring(0, 50)}...`, null, "dim");
        });
        console.log();
      }

      if (high.length > 0) {
        log(`[HIGH] ${high.length} secret(s):`, null, "yellow");
        high.forEach((secret) => {
          log(
            `  • ${secret.type} in ${secret.logGroup}/${secret.logStream}`,
            null,
            "yellow"
          );
        });
        console.log();
      }

      if (medium.length > 0) {
        log(`[MEDIUM] ${medium.length} secret(s):`, null, "cyan");
        medium.forEach((secret) => {
          log(
            `  • ${secret.type} in ${secret.logGroup}/${secret.logStream}`,
            null,
            "cyan"
          );
        });
        console.log();
      }

      log(
        `Secrets found in ${results.logGroupsWithSecrets.length} log group(s)`,
        null,
        "yellow"
      );
    } else {
      logSuccess("✓ No secrets detected in logs");
    }

    return results;
  } catch (error) {
    logError("CloudWatch logs scan failed");
    log(error.message, null, "red");
    return results;
  }
}

/**
 * Exports CloudWatch log analysis results to a file
 * @param {Object} results - Analysis results from scanCloudWatchLogs
 * @returns {boolean} True if export succeeded
 */
export function exportCloudWatchFindings(results) {
  if (!results || results.secretsFound.length === 0) {
    logWarning("No secrets to export");
    return false;
  }

  const timestamp = new Date()
    .toISOString()
    .replace(/[:.]/g, "-")
    .substring(0, 19);
  const filename = `cloudwatch_secrets_${timestamp}.txt`;

  let content = "";
  content += "=" .repeat(80) + "\n";
  content += "CLOUDWATCH LOGS - SECRETS EXTRACTION REPORT\n";
  content += "=" .repeat(80) + "\n";
  content += `Generated: ${new Date().toISOString()}\n`;
  content += `Log groups scanned: ${results.scannedGroups}\n`;
  content += `Log streams scanned: ${results.scannedStreams}\n`;
  content += `Log events analyzed: ${results.scannedEvents}\n`;
  content += `Total secrets found: ${results.secretsFound.length}\n`;
  content += "=" .repeat(80) + "\n\n";

  // Group by severity
  const critical = results.secretsFound.filter(
    (s) => s.severity === "CRITICAL"
  );
  const high = results.secretsFound.filter((s) => s.severity === "HIGH");
  const medium = results.secretsFound.filter((s) => s.severity === "MEDIUM");

  if (critical.length > 0) {
    content += "CRITICAL SEVERITY SECRETS\n";
    content += "-".repeat(80) + "\n";
    critical.forEach((secret, idx) => {
      content += `${idx + 1}. ${secret.type}\n`;
      content += `   Log Group: ${secret.logGroup}\n`;
      content += `   Log Stream: ${secret.logStream}\n`;
      content += `   Value: ${secret.value}\n\n`;
    });
    content += "\n";
  }

  if (high.length > 0) {
    content += "HIGH SEVERITY SECRETS\n";
    content += "-".repeat(80) + "\n";
    high.forEach((secret, idx) => {
      content += `${idx + 1}. ${secret.type}\n`;
      content += `   Log Group: ${secret.logGroup}\n`;
      content += `   Log Stream: ${secret.logStream}\n`;
      content += `   Value: ${secret.value}\n\n`;
    });
    content += "\n";
  }

  if (medium.length > 0) {
    content += "MEDIUM SEVERITY SECRETS\n";
    content += "-".repeat(80) + "\n";
    medium.forEach((secret, idx) => {
      content += `${idx + 1}. ${secret.type}\n`;
      content += `   Log Group: ${secret.logGroup}\n`;
      content += `   Log Stream: ${secret.logStream}\n`;
      content += `   Value: ${secret.value}\n\n`;
    });
  }

  // Add log groups with secrets
  content += "\n";
  content += "LOG GROUPS WITH SECRETS\n";
  content += "-".repeat(80) + "\n";
  results.logGroupsWithSecrets.forEach((group, idx) => {
    const count = results.secretsFound.filter(
      (s) => s.logGroup === group
    ).length;
    content += `${idx + 1}. ${group} (${count} secret(s))\n`;
  });

  try {
    fs.writeFileSync(filename, content, "utf-8");
    console.log();
    logSuccess(`✓ Findings exported to: ${filename}`);
    return true;
  } catch (error) {
    logError(`Failed to export findings: ${error.message}`);
    return false;
  }
}
