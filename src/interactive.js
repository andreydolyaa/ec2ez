import readline from "readline";
import { COLORS } from "./config.js";
import {
  logInfo,
  logSuccess,
  logSeparator,
  logWarning,
  log,
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
} from "./aws.js";

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

export function buildAvailableActions(permissionResults) {
  const actions = [];
  const permissions = permissionResults.allPermissions;

  if (
    permissions.some(
      (p) =>
        matchesPermission(p, "ec2:RunInstances") ||
        matchesPermission(p, "ec2:*")
    )
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
    permissions.some(
      (p) =>
        matchesPermission(p, "ec2:DescribeInstances") ||
        matchesPermission(p, "ec2:*")
    )
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

  if (
    permissions.some(
      (p) =>
        matchesPermission(p, "s3:ListAllMyBuckets") ||
        matchesPermission(p, "s3:ListBucket") ||
        matchesPermission(p, "s3:*")
    )
  ) {
    actions.push({
      id: "3",
      name: "List S3 Buckets",
      description: "Enumerate all S3 buckets in the account",
      service: "S3",
      dangerous: false,
      handler: listS3Buckets,
    });
  }

  if (
    permissions.some(
      (p) =>
        matchesPermission(p, "secretsmanager:ListSecrets") ||
        matchesPermission(p, "secretsmanager:*")
    )
  ) {
    actions.push({
      id: "4",
      name: "List Secrets Manager Secrets",
      description: "Enumerate secrets stored in AWS Secrets Manager",
      service: "Secrets Manager",
      dangerous: true,
      handler: listSecrets,
    });
  }

  if (
    permissions.some(
      (p) =>
        matchesPermission(p, "ssm:DescribeParameters") ||
        matchesPermission(p, "ssm:*")
    )
  ) {
    actions.push({
      id: "5",
      name: "List SSM Parameters",
      description: "Enumerate parameters in Systems Manager Parameter Store",
      service: "SSM",
      dangerous: true,
      handler: listSSMParameters,
    });
  }

  if (
    permissions.some(
      (p) =>
        matchesPermission(p, "iam:ListUsers") || matchesPermission(p, "iam:*")
    )
  ) {
    actions.push({
      id: "6",
      name: "List IAM Users",
      description: "Enumerate all IAM users in the account",
      service: "IAM",
      dangerous: true,
      handler: listIAMUsers,
    });
  }

  if (
    permissions.some(
      (p) =>
        matchesPermission(p, "iam:ListRoles") || matchesPermission(p, "iam:*")
    )
  ) {
    actions.push({
      id: "7",
      name: "List IAM Roles",
      description: "Enumerate all IAM roles in the account",
      service: "IAM",
      dangerous: true,
      handler: listIAMRoles,
    });
  }

  if (
    permissions.some(
      (p) =>
        matchesPermission(p, "lambda:ListFunctions") ||
        matchesPermission(p, "lambda:*")
    )
  ) {
    actions.push({
      id: "8",
      name: "List Lambda Functions",
      description: "Enumerate all Lambda functions in the account",
      service: "Lambda",
      dangerous: false,
      handler: listLambdaFunctions,
    });
  }

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
  const actions = buildAvailableActions(permissionResults);

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

      await selectedAction.handler();

      logSeparator();
      logSuccess(`${selectedAction.name} completed successfully!`);
      logSeparator();

      const continueChoice = await askQuestion(
        rl,
        `${COLORS.yellow}Press Enter to continue or type 'exit' to quit: ${COLORS.reset}`
      );

      if (continueChoice.toLowerCase() === "exit") {
        logSuccess("Exiting interactive menu. Goodbye!");
        running = false;
      }
    } catch (error) {
      logSeparator();
      logWarning(
        `Failed to execute ${selectedAction.name}. You may not have sufficient permissions.`
      );
      logSeparator();

      const continueChoice = await askQuestion(
        rl,
        `${COLORS.yellow}Press Enter to continue or type 'exit' to quit: ${COLORS.reset}`
      );

      if (continueChoice.toLowerCase() === "exit") {
        logSuccess("Exiting interactive menu. Goodbye!");
        running = false;
      }
    }
  }

  rl.close();
}
