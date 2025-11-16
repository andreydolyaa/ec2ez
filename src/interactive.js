import readline from "readline";
import { exec } from "child_process";
import { promisify } from "util";
import { COLORS } from "./config.js";
import {
  logInfo,
  logSuccess,
  logSeparator,
  logWarning,
  log,
  logError,
} from "./utils.js";
import { matchesPermission } from "./permissions.js";
import {
  launchEC2Instance,
  listS3Buckets,
  listSecrets,
  listSSMParameters,
  listIAMUsers,
  listIAMRoles,
  listEC2Instances,
  listLambdaFunctions,
  getSSMParameter,
  getSecretValue,
  downloadS3Object,
  uploadS3Object,
  listS3Objects,
  invokeLambda,
  createSSMParameter,
  extractAllSecrets,
  executeAWSCommand,
} from "./aws.js";
import {
  scanCloudWatchLogs,
  exportCloudWatchFindings,
} from "./cloudwatch.js";

const execAsync = promisify(exec);

function createInterface() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

function askQuestion(rl, question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

export async function buildAvailableActions(permissionResults) {
  const actions = [];
  const permissions = permissionResults.allPermissions;

  if (
    permissions.some((p) => matchesPermission(p, "ec2:RunInstances"))
  ) {
    actions.push({
      id: "1",
      name: "Launch EC2 Instance",
      description: "Create a new EC2 instance to test credentials",
      service: "EC2",
      dangerous: false,
      handler: launchEC2Instance,
    });
  }

  if (
    permissions.some((p) => matchesPermission(p, "ec2:DescribeInstances"))
  ) {
    actions.push({
      id: "2",
      name: "List EC2 Instances",
      description: "Enumerate all EC2 instances in the account",
      service: "EC2",
      dangerous: false,
      handler: listEC2Instances,
    });
  }

  // S3 - check if buckets exist
  if (
    permissions.some(
      (p) =>
        matchesPermission(p, "s3:ListAllMyBuckets") ||
        matchesPermission(p, "s3:ListBucket")
    )
  ) {
    try {
      const s3Output = await executeAWSCommand("aws s3 ls --output text");
      if (s3Output && s3Output.trim().length > 0) {
        actions.push({
          id: "3",
          name: "List S3 Buckets",
          description: "Enumerate all S3 buckets in the account",
          service: "S3",
          dangerous: false,
          handler: listS3Buckets,
        });
      }
    } catch (error) {
      // No buckets or error - don't add to menu
    }
  }

  // Secrets Manager - check if secrets exist
  if (
    permissions.some((p) => matchesPermission(p, "secretsmanager:ListSecrets"))
  ) {
    try {
      const secretsOutput = await executeAWSCommand("aws secretsmanager list-secrets --max-results 1 --output json");
      const secretsData = JSON.parse(secretsOutput);
      if (secretsData.SecretList && secretsData.SecretList.length > 0) {
        actions.push({
          id: "4",
          name: "List Secrets Manager Secrets",
          description: "Enumerate secrets stored in AWS Secrets Manager",
          service: "Secrets Manager",
          dangerous: true,
          handler: listSecrets,
        });
      }
    } catch (error) {
      // No secrets or error - don't add to menu
    }
  }

  // SSM Parameters - check if parameters exist
  if (
    permissions.some((p) => matchesPermission(p, "ssm:DescribeParameters"))
  ) {
    try {
      const ssmOutput = await executeAWSCommand("aws ssm describe-parameters --max-results 1 --output json");
      const ssmData = JSON.parse(ssmOutput);
      if (ssmData.Parameters && ssmData.Parameters.length > 0) {
        actions.push({
          id: "5",
          name: "List SSM Parameters",
          description: "Enumerate parameters in Systems Manager Parameter Store",
          service: "SSM",
          dangerous: true,
          handler: listSSMParameters,
        });
      }
    } catch (error) {
      // No parameters or error - don't add to menu
    }
  }

  // IAM Users - check if users exist
  if (
    permissions.some((p) => matchesPermission(p, "iam:ListUsers"))
  ) {
    try {
      const iamOutput = await executeAWSCommand("aws iam list-users --max-items 1 --output json");
      const iamData = JSON.parse(iamOutput);
      if (iamData.Users && iamData.Users.length > 0) {
        actions.push({
          id: "6",
          name: "List IAM Users",
          description: "Enumerate all IAM users in the account",
          service: "IAM",
          dangerous: true,
          handler: listIAMUsers,
        });
      }
    } catch (error) {
      // No users or error - don't add to menu
    }
  }

  // IAM Roles - check if roles exist
  if (
    permissions.some((p) => matchesPermission(p, "iam:ListRoles"))
  ) {
    try {
      const rolesOutput = await executeAWSCommand("aws iam list-roles --max-items 1 --output json");
      const rolesData = JSON.parse(rolesOutput);
      if (rolesData.Roles && rolesData.Roles.length > 0) {
        actions.push({
          id: "7",
          name: "List IAM Roles",
          description: "Enumerate all IAM roles in the account",
          service: "IAM",
          dangerous: true,
          handler: listIAMRoles,
        });
      }
    } catch (error) {
      // No roles or error - don't add to menu
    }
  }

  // Lambda Functions - check if functions exist
  if (
    permissions.some((p) => matchesPermission(p, "lambda:ListFunctions"))
  ) {
    try {
      const lambdaOutput = await executeAWSCommand("aws lambda list-functions --max-items 1 --output json");
      const lambdaData = JSON.parse(lambdaOutput);
      if (lambdaData.Functions && lambdaData.Functions.length > 0) {
        actions.push({
          id: "8",
          name: "List Lambda Functions",
          description: "Enumerate all Lambda functions in the account",
          service: "Lambda",
          dangerous: false,
          handler: listLambdaFunctions,
        });
      }
    } catch (error) {
      // No functions or error - don't add to menu
    }
  }

  // Read SSM Parameter - only show if parameters exist
  if (
    permissions.some((p) => matchesPermission(p, "ssm:GetParameter"))
  ) {
    try {
      const ssmOutput = await executeAWSCommand("aws ssm describe-parameters --max-results 1 --output json");
      const ssmData = JSON.parse(ssmOutput);
      if (ssmData.Parameters && ssmData.Parameters.length > 0) {
        actions.push({
          id: "9",
          name: "Read SSM Parameter Value",
          description: "Get the actual value of an SSM parameter",
          service: "SSM",
          dangerous: true,
          handler: async (rl) => {
            // First list available parameters
            try {
              await listSSMParameters();
            } catch (error) {
              logWarning("Could not list parameters, but you can still try entering a name");
            }
            logSeparator();
            const paramName = await askQuestion(rl, `${COLORS.cyan}Enter parameter name: ${COLORS.reset}`);
            if (paramName) {
              await getSSMParameter(paramName);
            }
          },
        });
      }
    } catch (error) {
      // No parameters or error - don't add to menu
    }
  }

  // Read Secret Value - only show if secrets exist
  if (
    permissions.some((p) => matchesPermission(p, "secretsmanager:GetSecretValue"))
  ) {
    try {
      const secretsOutput = await executeAWSCommand("aws secretsmanager list-secrets --max-results 1 --output json");
      const secretsData = JSON.parse(secretsOutput);
      if (secretsData.SecretList && secretsData.SecretList.length > 0) {
        actions.push({
          id: "10",
          name: "Read Secret Value",
          description: "Get the actual value of a secret from Secrets Manager",
          service: "Secrets Manager",
          dangerous: true,
          handler: async (rl) => {
            // First list available secrets
            try {
              await listSecrets();
            } catch (error) {
              logWarning("Could not list secrets, but you can still try entering a name");
            }
            logSeparator();
            const secretName = await askQuestion(rl, `${COLORS.cyan}Enter secret name/ARN: ${COLORS.reset}`);
            if (secretName) {
              await getSecretValue(secretName);
            }
          },
        });
      }
    } catch (error) {
      // No secrets or error - don't add to menu
    }
  }

  // Bulk extraction - only show if secrets OR parameters exist
  const hasSecretsPermission = permissions.some((p) => matchesPermission(p, "secretsmanager:GetSecretValue"));
  const hasSSMPermission = permissions.some((p) => matchesPermission(p, "ssm:GetParameter"));

  if (hasSecretsPermission || hasSSMPermission) {
    let hasData = false;

    // Check if secrets exist
    if (hasSecretsPermission) {
      try {
        const secretsOutput = await executeAWSCommand("aws secretsmanager list-secrets --max-results 1 --output json");
        const secretsData = JSON.parse(secretsOutput);
        if (secretsData.SecretList && secretsData.SecretList.length > 0) {
          hasData = true;
        }
      } catch (error) {}
    }

    // Check if SSM parameters exist
    if (!hasData && hasSSMPermission) {
      try {
        const ssmOutput = await executeAWSCommand("aws ssm describe-parameters --max-results 1 --output json");
        const ssmData = JSON.parse(ssmOutput);
        if (ssmData.Parameters && ssmData.Parameters.length > 0) {
          hasData = true;
        }
      } catch (error) {}
    }

    if (hasData) {
      actions.push({
        id: "15",
        name: "Extract All Secrets & Parameters",
        description: "Bulk download all secrets and SSM parameters, scan for credentials",
        service: "Multi-Service",
        dangerous: true,
        handler: async (rl) => {
          await extractAllSecrets();
        },
      });
    }
  }

  // Download S3 Object - only show if buckets exist
  if (
    permissions.some((p) => matchesPermission(p, "s3:GetObject"))
  ) {
    try {
      const s3Output = await executeAWSCommand("aws s3 ls --output text");
      if (s3Output && s3Output.trim().length > 0) {
        actions.push({
          id: "11",
          name: "Download S3 Object",
          description: "Download a file from an S3 bucket",
          service: "S3",
          dangerous: false,
          handler: async (rl) => {
            // First list available buckets
            try {
              await listS3Buckets();
            } catch (error) {
              logWarning("Could not list buckets, but you can still try entering a bucket name");
            }
            logSeparator();
            const bucket = await askQuestion(rl, `${COLORS.cyan}Enter bucket name: ${COLORS.reset}`);
        if (!bucket) return;

        // Try to list objects in the bucket
        try {
          await listS3Objects(bucket, "");
          logSeparator();
        } catch (error) {
          logWarning("Could not list objects in bucket");
          logSeparator();
        }

        const key = await askQuestion(rl, `${COLORS.cyan}Enter object key (path): ${COLORS.reset}`);
        const outputPath = await askQuestion(rl, `${COLORS.cyan}Enter local save path: ${COLORS.reset}`);
        if (bucket && key && outputPath) {
          await downloadS3Object(bucket, key, outputPath);
        }
      },
    });
  }

  // Upload S3 Object - check if buckets exist
  if (
    permissions.some((p) => matchesPermission(p, "s3:PutObject"))
  ) {
    try {
      const s3Output = await executeAWSCommand("aws s3 ls --output text");
      if (s3Output && s3Output.trim().length > 0) {
        actions.push({
          id: "12",
          name: "Upload S3 Object",
          description: "Upload a file to an S3 bucket",
          service: "S3",
          dangerous: true,
          handler: async (rl) => {
            // First list available buckets
            try {
              await listS3Buckets();
            } catch (error) {
              logWarning("Could not list buckets, but you can still try entering a bucket name");
            }
            logSeparator();
            const localPath = await askQuestion(rl, `${COLORS.cyan}Enter local file path: ${COLORS.reset}`);
            const bucket = await askQuestion(rl, `${COLORS.cyan}Enter bucket name: ${COLORS.reset}`);
            const key = await askQuestion(rl, `${COLORS.cyan}Enter object key (path in S3): ${COLORS.reset}`);
            if (localPath && bucket && key) {
              await uploadS3Object(localPath, bucket, key);
            }
          },
        });
      }
    } catch (error) {
      // No buckets or error - don't add to menu
    }
  }

  // List S3 Bucket Objects - check if buckets exist
  if (
    permissions.some((p) => matchesPermission(p, "s3:ListBucket"))
  ) {
    try {
      const s3Output = await executeAWSCommand("aws s3 ls --output text");
      if (s3Output && s3Output.trim().length > 0) {
        actions.push({
          id: "13",
          name: "List S3 Bucket Objects",
          description: "List all objects in a specific S3 bucket",
          service: "S3",
          dangerous: false,
          handler: async (rl) => {
            // First list available buckets
            try {
              await listS3Buckets();
            } catch (error) {
              logWarning("Could not list buckets, but you can still try entering a bucket name");
            }
            logSeparator();
            const bucket = await askQuestion(rl, `${COLORS.cyan}Enter bucket name: ${COLORS.reset}`);
            const prefix = await askQuestion(rl, `${COLORS.cyan}Enter prefix (optional, press Enter to skip): ${COLORS.reset}`);
            if (bucket) {
              await listS3Objects(bucket, prefix);
            }
          },
        });
      }
    } catch (error) {
      // No buckets or error - don't add to menu
    }
  }

  // Invoke Lambda Function - check if functions exist
  if (
    permissions.some((p) => matchesPermission(p, "lambda:InvokeFunction"))
  ) {
    try {
      const lambdaOutput = await executeAWSCommand("aws lambda list-functions --max-items 1 --output json");
      const lambdaData = JSON.parse(lambdaOutput);
      if (lambdaData.Functions && lambdaData.Functions.length > 0) {
        actions.push({
          id: "14",
          name: "Invoke Lambda Function",
          description: "Execute a Lambda function with custom payload",
          service: "Lambda",
          dangerous: true,
          handler: async (rl) => {
            // First list available Lambda functions
            try {
              await listLambdaFunctions();
            } catch (error) {
              logWarning("Could not list Lambda functions, but you can still try entering a function name");
            }
            logSeparator();
            const functionName = await askQuestion(rl, `${COLORS.cyan}Enter function name: ${COLORS.reset}`);
            const payload = await askQuestion(rl, `${COLORS.cyan}Enter JSON payload (or press Enter for {}): ${COLORS.reset}`);
            if (functionName) {
              await invokeLambda(functionName, payload || "{}");
            }
          },
        });
      }
    } catch (error) {
      // No Lambda functions or error - don't add to menu
    }
  }

  if (
    permissions.some((p) => matchesPermission(p, "ssm:PutParameter"))
  ) {
    actions.push({
      id: "15",
      name: "Create/Update SSM Parameter",
      description: "Create or update an SSM parameter value",
      service: "SSM",
      dangerous: true,
      handler: async (rl) => {
        // First list existing parameters
        try {
          await listSSMParameters();
        } catch (error) {
          logWarning("Could not list parameters, but you can still create a new one");
        }
        logSeparator();
        const paramName = await askQuestion(rl, `${COLORS.cyan}Enter parameter name: ${COLORS.reset}`);
        const value = await askQuestion(rl, `${COLORS.cyan}Enter parameter value: ${COLORS.reset}`);
        const paramType = await askQuestion(rl, `${COLORS.cyan}Enter type (String/SecureString/StringList) [default: String]: ${COLORS.reset}`);
        if (paramName && value) {
          await createSSMParameter(paramName, value, paramType || "String");
        }
      },
    });
  }

  // CloudWatch Logs extraction - requires permission AND actual log groups
  if (
    permissions.some((p) => matchesPermission(p, "logs:DescribeLogGroups"))
  ) {
    // Check if there are actually log groups before showing this option
    try {
      const { listLogGroups } = await import("./cloudwatch.js");
      const logGroups = await listLogGroups();

      if (logGroups && logGroups.length > 0) {
        actions.push({
          id: "17",
          name: "Extract CloudWatch Logs & Search for Secrets",
          description: "Download CloudWatch logs and scan for credentials/secrets",
          service: "CloudWatch Logs",
          dangerous: true,
          handler: async (rl) => {
            logInfo("This will scan CloudWatch logs for sensitive information...");
            logSeparator();
            const scanAll = await askQuestion(
              rl,
              `${COLORS.cyan}Scan all log groups? (y/n) [default: y]: ${COLORS.reset}`
            );

            let results;
            if (scanAll.toLowerCase() === "n" || scanAll.toLowerCase() === "no") {
              const logGroupName = await askQuestion(
                rl,
                `${COLORS.cyan}Enter log group name to scan: ${COLORS.reset}`
              );
              if (logGroupName) {
                results = await scanCloudWatchLogs(logGroupName, 3, 100);
              }
            } else {
              results = await scanCloudWatchLogs(null, 3, 100);
            }

            if (results && results.secretsFound.length > 0) {
              logSeparator();
              const exportChoice = await askQuestion(
                rl,
                `${COLORS.cyan}Export findings to file? (y/n) [default: y]: ${COLORS.reset}`
              );
              if (exportChoice.toLowerCase() !== "n" && exportChoice.toLowerCase() !== "no") {
                exportCloudWatchFindings(results);
              }
            }
          },
        });
      }
    } catch (error) {
      // No log groups available or error checking - don't add to menu
    }
  }

  // Always available: Shell command execution
  actions.push({
    id: "16",
    name: "Run Shell Command",
    description: "Execute shell commands on the host (ls, pwd, find, etc.)",
    service: "System",
    dangerous: false,
    handler: async (rl) => {
      logInfo("Examples: ls, pwd, ls -la /tmp, find . -name '*.txt', cat /etc/hosts");
      logSeparator();
      const command = await askQuestion(rl, `${COLORS.cyan}Enter shell command: ${COLORS.reset}`);
      if (!command) {
        logWarning("No command entered");
        return;
      }

      try {
        logInfo(`Executing: ${command}`);
        const { stdout, stderr } = await execAsync(command);

        if (stdout) {
          console.log(stdout);
        }
        if (stderr) {
          logWarning("stderr:");
          console.log(stderr);
        }

        logSuccess("Command executed successfully");
      } catch (error) {
        logError("Command execution failed");
        if (error.stdout) {
          console.log(error.stdout);
        }
        if (error.stderr) {
          log("Error output:", null, "red");
          console.log(error.stderr);
        }
      }
    },
  });

  return actions;
}

export function displayMenu(actions) {
  logSeparator();
  log(
    `${COLORS.bright}INTERACTIVE MENU - Select Next Action${COLORS.reset}`,
    null,
    "cyan"
  );
  logSeparator();

  if (actions.length === 0) {
    logWarning(
      "No available actions based on discovered permissions. Limited access detected."
    );
    logSeparator();
    return;
  }

  logInfo("Available actions based on your permissions:");
  console.log();

  actions.forEach((action, index) => {
    const displayNumber = index + 1;
    const dangerousTag = action.dangerous
      ? `${COLORS.red}[SENSITIVE]${COLORS.reset}`
      : `${COLORS.green}[SAFE]${COLORS.reset}`;
    const serviceTag = `${COLORS.cyan}[${action.service}]${COLORS.reset}`;

    console.log(
      `  ${COLORS.bright}${displayNumber}.${COLORS.reset} ${action.name} ${serviceTag} ${dangerousTag}`
    );
    console.log(`     ${COLORS.dim}${action.description}${COLORS.reset}`);
    console.log();
  });

  console.log(`  ${COLORS.bright}0.${COLORS.reset} Exit`);
  logSeparator();
}

export async function runInteractiveMenu(permissionResults) {
  const actions = await buildAvailableActions(permissionResults);

  if (actions.length === 0) {
    displayMenu(actions);
    return;
  }

  const rl = createInterface();

  let running = true;
  while (running) {
    displayMenu(actions);

    const choice = await askQuestion(
      rl,
      `${COLORS.yellow}Enter your choice (0-${actions.length}): ${COLORS.reset}`
    );

    if (choice === "0") {
      logSuccess("Exiting interactive menu. Goodbye!");
      running = false;
      break;
    }

    const choiceNum = parseInt(choice);
    const selectedAction = actions[choiceNum - 1];

    if (!selectedAction || choiceNum < 1 || choiceNum > actions.length) {
      logWarning(
        `Invalid choice. Please enter a number between 0 and ${actions.length}`
      );
      await new Promise((resolve) => setTimeout(resolve, 1000));
      continue;
    }

    try {
      logSeparator();
      logInfo(`Executing: ${selectedAction.name}`);
      logSeparator();

      await selectedAction.handler(rl);

      logSeparator();
      logSuccess(`${selectedAction.name} completed successfully!`);
      logSeparator();

      await askQuestion(
        rl,
        `${COLORS.yellow}Press Enter to continue...${COLORS.reset}`
      );
    } catch (error) {
      logSeparator();
      logWarning(
        `Failed to execute ${selectedAction.name}. You may not have sufficient permissions.`
      );
      logSeparator();

      await askQuestion(
        rl,
        `${COLORS.yellow}Press Enter to continue...${COLORS.reset}`
      );
    }
  }

  rl.close();
}
