import { executeAWSCommand } from "./aws.js";
import {
  logInfo,
  logSuccess,
  logWarning,
  logDanger,
  logSeparator,
  log,
  logError,
} from "./utils.js";

export async function discoverPermissionsByTesting() {
  logInfo("Discovering permissions through active testing...");
  logSeparator();

  const discoveredPermissions = new Set();
  let credentialError = false;

  const permissionTests = [
    { permission: "sts:GetCallerIdentity", command: "aws sts get-caller-identity --output json" },
    { permission: "ec2:DescribeInstances", command: "aws ec2 describe-instances --max-results 1 --output json" },
    { permission: "ec2:DescribeKeyPairs", command: "aws ec2 describe-key-pairs --max-results 1 --output json" },
    { permission: "ec2:DescribeVpcs", command: "aws ec2 describe-vpcs --max-results 1 --output json" },
    { permission: "ec2:DescribeSubnets", command: "aws ec2 describe-subnets --max-results 1 --output json" },
    { permission: "ec2:DescribeSecurityGroups", command: "aws ec2 describe-security-groups --max-results 1 --output json" },
    { permission: "s3:ListAllMyBuckets", command: "aws s3 ls --output text" },
    { permission: "iam:ListUsers", command: "aws iam list-users --max-items 1 --output json" },
    { permission: "iam:ListRoles", command: "aws iam list-roles --max-items 1 --output json" },
    { permission: "iam:GetUser", command: "aws iam get-user --output json" },
    { permission: "secretsmanager:ListSecrets", command: "aws secretsmanager list-secrets --max-results 1 --output json" },
    { permission: "ssm:DescribeParameters", command: "aws ssm describe-parameters --max-results 1 --output json" },
    { permission: "lambda:ListFunctions", command: "aws lambda list-functions --max-items 1 --output json" },
    { permission: "ec2:RunInstances", command: "aws ec2 run-instances --dry-run --image-id ami-12345678 --instance-type t2.micro 2>&1 || true" },
  ];

  for (const test of permissionTests) {
    try {
      await executeAWSCommand(test.command);
      discoveredPermissions.add(test.permission);
      logSuccess(`✓ ${test.permission}`);
    } catch (error) {
      if (error.message.includes("InvalidClientTokenId") ||
          error.message.includes("SignatureDoesNotMatch") ||
          error.message.includes("AuthFailure") ||
          error.message.includes("security token")) {
        credentialError = true;
        logError(`⚠ Credential error detected during ${test.permission} test`);
        break; // Stop testing if credentials are invalid
      } else if (error.message.includes("AccessDenied") ||
                 error.message.includes("UnauthorizedOperation") ||
                 error.message.includes("not authorized")) {
        log(`✗ ${test.permission}`, null, "dim");
      } else {
        log(`? ${test.permission} (unknown error)`, null, "yellow");
      }
    }
  }

  logSeparator();

  if (credentialError) {
    logError("Permission discovery aborted due to credential errors");
    logWarning("The credentials may have expired or are invalid");
    logSeparator();
    return {
      totalPermissions: 0,
      dangerousPermissions: 0,
      hasDangerousPerms: false,
      allPermissions: [],
      permissionsByService: {},
      dangerousPermissionsList: [],
      credentialError: true,
    };
  }

  logInfo(`Discovered ${discoveredPermissions.size} permissions through testing`);
  logSeparator();

  return {
    totalPermissions: discoveredPermissions.size,
    dangerousPermissions: 0,
    hasDangerousPerms: false,
    allPermissions: Array.from(discoveredPermissions),
    permissionsByService: groupPermissionsByService(Array.from(discoveredPermissions)),
    dangerousPermissionsList: [],
    credentialError: false,
  };
}

function groupPermissionsByService(permissions) {
  const grouped = {};
  for (const perm of permissions) {
    const service = perm.split(":")[0];
    if (!grouped[service]) {
      grouped[service] = [];
    }
    grouped[service].push(perm);
  }
  return grouped;
}

export const DANGEROUS_PATTERNS = [
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

export function matchesPermission(permission, pattern) {
  if (permission === "*" || permission === pattern) {
    return true;
  }

  const [permService, permAction] = permission.split(":");
  const [patternService, patternAction] = pattern.split(":");

  // Check if services match
  if (permService !== patternService) {
    return false;
  }

  // If permission action is wildcard, it matches everything in that service
  if (permAction === "*") {
    return true;
  }

  // Create regex from the permission (which may have wildcards) and test against pattern
  const permRegex = new RegExp("^" + permission.replace(/\*/g, ".*") + "$");
  return permRegex.test(pattern);
}

export function extractPermissions(
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

export async function enumerateRolePermissions(roleName) {
  try {
    logInfo(`Attempting to enumerate permissions for role: ${roleName}`);
    logSeparator();

    const allPermissions = new Set();
    const permissionsByService = {};
    const permissionSources = {};
    const dangerousPermissions = [];

    log("Checking attached managed policies...");
    try {
      const policiesCommand = `aws iam list-attached-role-policies --role-name ${roleName} --output json`;
      const policiesOutput = await executeAWSCommand(policiesCommand);
      const attachedPolicies = JSON.parse(policiesOutput);

      // Fetch all managed policies in parallel
      if (attachedPolicies.AttachedPolicies.length > 0) {
        log(`  Fetching ${attachedPolicies.AttachedPolicies.length} managed policies in parallel...`);

        const policyPromises = attachedPolicies.AttachedPolicies.map(async (policy) => {
          const versionCommand = `aws iam get-policy --policy-arn ${policy.PolicyArn} --query "Policy.DefaultVersionId" --output text`;
          const versionId = await executeAWSCommand(versionCommand);

          const policyCommand = `aws iam get-policy-version --policy-arn ${policy.PolicyArn} --version-id ${versionId} --output json`;
          const policyOutput = await executeAWSCommand(policyCommand);
          const policyDocument = JSON.parse(policyOutput);

          return {
            name: policy.PolicyName,
            document: policyDocument.PolicyVersion.Document,
          };
        });

        const policyResults = await Promise.all(policyPromises);

        policyResults.forEach((result) => {
          log(`  ✓ ${result.name}`, null, "green");
          extractPermissions(
            result.document,
            allPermissions,
            permissionsByService,
            permissionSources,
            `Managed Policy: ${result.name}`
          );
        });
      }

      log("Checking inline policies...");
      const inlinePoliciesCommand = `aws iam list-role-policies --role-name ${roleName} --output json`;
      const inlinePoliciesOutput = await executeAWSCommand(inlinePoliciesCommand);
      const inlinePolicies = JSON.parse(inlinePoliciesOutput);

      // Fetch all inline policies in parallel
      if (inlinePolicies.PolicyNames.length > 0) {
        log(`  Fetching ${inlinePolicies.PolicyNames.length} inline policies in parallel...`);

        const inlinePolicyPromises = inlinePolicies.PolicyNames.map(async (policyName) => {
          const inlineCommand = `aws iam get-role-policy --role-name ${roleName} --policy-name ${policyName} --output json`;
          const inlineOutput = await executeAWSCommand(inlineCommand);
          const inlinePolicy = JSON.parse(inlineOutput);

          return {
            name: policyName,
            document: inlinePolicy.PolicyDocument,
          };
        });

        const inlinePolicyResults = await Promise.all(inlinePolicyPromises);

        inlinePolicyResults.forEach((result) => {
          log(`  ✓ ${result.name}`, null, "green");
          extractPermissions(
            result.document,
            allPermissions,
            permissionsByService,
            permissionSources,
            `Inline Policy: ${result.name}`
          );
        });
      }

      for (const permission of allPermissions) {
        for (const dangerous of DANGEROUS_PATTERNS) {
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

      // Debug: Show all individual permissions
      logInfo(`DEBUG - All ${allPermissions.size} permissions found:`);
      const sortedPerms = Array.from(allPermissions).sort();
      sortedPerms.forEach((perm) => {
        log(`  - ${perm}`, null, "dim");
      });
      logSeparator();

      return {
        totalPermissions: allPermissions.size,
        dangerousPermissions: dangerousPermissions.length,
        hasDangerousPerms: dangerousPermissions.length > 0,
        allPermissions: Array.from(allPermissions),
        permissionsByService,
        dangerousPermissionsList: dangerousPermissions,
      };
    } catch (iamError) {
      logWarning("IAM enumeration failed (insufficient IAM permissions)");
      logInfo("Falling back to permission discovery through testing...");
      logSeparator();

      return await discoverPermissionsByTesting();
    }
  } catch (error) {
    logError("Failed to enumerate role permissions");
    log(error.message, null, "red");
    return {
      totalPermissions: 0,
      dangerousPermissions: 0,
      hasDangerousPerms: false,
      allPermissions: [],
      permissionsByService: {},
      dangerousPermissionsList: [],
    };
  }
}

export async function checkPassRolePolicy(roleName) {
  try {
    logInfo(`Checking if role ${roleName} has PassRole policy...`);

    const policiesCommand = `aws iam list-attached-role-policies --role-name ${roleName} --output json`;
    try {
      const policiesOutput = await executeAWSCommand(policiesCommand);
      const attachedPolicies = JSON.parse(policiesOutput);

      let hasPassRole = false;

      // Fetch all managed policies in parallel
      if (attachedPolicies.AttachedPolicies.length > 0) {
        log(`Checking ${attachedPolicies.AttachedPolicies.length} managed policies in parallel...`);

        const policyPromises = attachedPolicies.AttachedPolicies.map(async (policy) => {
          const versionCommand = `aws iam get-policy --policy-arn ${policy.PolicyArn} --query "Policy.DefaultVersionId" --output text`;
          const versionId = await executeAWSCommand(versionCommand);

          const policyCommand = `aws iam get-policy-version --policy-arn ${policy.PolicyArn} --version-id ${versionId} --output json`;
          const policyOutput = await executeAWSCommand(policyCommand);
          const policyDocument = JSON.parse(policyOutput);

          return {
            name: policy.PolicyName,
            statements: policyDocument.PolicyVersion.Document.Statement,
          };
        });

        const policyResults = await Promise.all(policyPromises);

        // Check for PassRole in fetched policies
        for (const result of policyResults) {
          for (const statement of result.statements) {
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
                  `Found PassRole permission in policy: ${result.name}`
                );
                break;
              }
            }
          }
          if (hasPassRole) break;
        }
      }

      const inlinePoliciesCommand = `aws iam list-role-policies --role-name ${roleName} --output json`;
      const inlinePoliciesOutput = await executeAWSCommand(inlinePoliciesCommand);
      const inlinePolicies = JSON.parse(inlinePoliciesOutput);

      // Fetch all inline policies in parallel
      if (!hasPassRole && inlinePolicies.PolicyNames.length > 0) {
        log(`Checking ${inlinePolicies.PolicyNames.length} inline policies in parallel...`);

        const inlinePolicyPromises = inlinePolicies.PolicyNames.map(async (policyName) => {
          const inlineCommand = `aws iam get-role-policy --role-name ${roleName} --policy-name ${policyName} --output json`;
          const inlineOutput = await executeAWSCommand(inlineCommand);
          const inlinePolicy = JSON.parse(inlineOutput);

          return {
            name: policyName,
            statements: inlinePolicy.PolicyDocument.Statement,
          };
        });

        const inlinePolicyResults = await Promise.all(inlinePolicyPromises);

        // Check for PassRole in fetched inline policies
        for (const result of inlinePolicyResults) {
          for (const statement of result.statements) {
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
                  `Found PassRole permission in inline policy: ${result.name}`
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
    } catch (iamError) {
      logWarning("Cannot check PassRole permission (insufficient IAM permissions)");
      logInfo("Skipping PassRole verification...");
      logSeparator();
      return false;
    }
  } catch (error) {
    logError("Failed to check PassRole policy");
    log(error.message, null, "red");
    return false;
  }
}
