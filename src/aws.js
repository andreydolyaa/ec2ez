import { exec } from "child_process";
import util from "util";
import os from "os";
import path from "path";
import fs from "fs";
import { CONFIG } from "./config.js";
import { logError, logSuccess, logInfo, logSeparator, log, logWarning } from "./utils.js";

const execPromise = util.promisify(exec);

export async function executeAWSCommand(command) {
  try {
    const { stdout } = await execPromise(command);
    return stdout.trim();
  } catch (error) {
    logError("AWS CLI command failed");
    log(error.message, null, "red");
    throw error;
  }
}

export async function validateCredentials(tryMultipleRegions = true) {
  const regions = ["il-central-1", "us-east-1", "us-west-2", "eu-west-1", "ap-southeast-1"];

  logInfo("Validating AWS credentials...");

  try {
    const output = await executeAWSCommand("aws sts get-caller-identity --output json");
    const identity = JSON.parse(output);

    logSuccess("Credentials are valid!");
    log(`  Account: ${identity.Account}`, null, "green");
    log(`  User/Role: ${identity.Arn}`, null, "green");
    log(`  UserId: ${identity.UserId}`, null, "green");
    logSeparator();

    return {
      valid: true,
      region: "il-central-1",
      accountId: identity.Account,
      arn: identity.Arn,
      userId: identity.UserId,
    };
  } catch (error) {
    if (!tryMultipleRegions) {
      return handleValidationError(error);
    }

    logWarning("Validation failed with il-central-1, trying other regions...");

    for (const region of regions.slice(1)) {
      try {
        log(`Trying region: ${region}...`, null, "dim");
        const output = await executeAWSCommand(`aws sts get-caller-identity --region ${region} --output json`);
        const identity = JSON.parse(output);

        logSuccess(`Credentials are valid for region: ${region}!`);
        log(`  Account: ${identity.Account}`, null, "green");
        log(`  User/Role: ${identity.Arn}`, null, "green");
        log(`  UserId: ${identity.UserId}`, null, "green");
        logInfo(`Updating default region to: ${region}`);

        updateRegionInConfig(region);

        logSeparator();
        return {
          valid: true,
          region,
          accountId: identity.Account,
          arn: identity.Arn,
          userId: identity.UserId,
        };
      } catch (regionError) {
      }
    }

    return handleValidationError(error);
  }
}

function handleValidationError(error) {
  logError("Credentials validation failed in all regions!");

  if (error.message.includes("InvalidClientTokenId") ||
      error.message.includes("SignatureDoesNotMatch") ||
      error.message.includes("security token")) {
    logWarning("The credentials appear to be invalid or expired.");
    logWarning("Possible reasons:");
    logWarning("  1. IMDS credentials may have been revoked");
    logWarning("  2. The EC2 instance profile may have been changed");
    logWarning("  3. The session may have expired (rare for fresh credentials)");
  } else if (error.message.includes("AuthFailure")) {
    logWarning("Authentication failure - credentials may be malformed.");
  }

  logSeparator();
  return { valid: false, region: null };
}

function updateRegionInConfig(region) {
  const configPath = path.join(os.homedir(), ".aws", "config");
  const configContent = `[default]
region = ${region}
output = json
`;

  fs.writeFileSync(configPath, configContent, { encoding: "utf8", flag: "w" });

  if (CONFIG && CONFIG.aws) {
    CONFIG.aws.defaultRegion = region;
  }
}

export async function getFirstKeyPair() {
  return await executeAWSCommand(
    'aws ec2 describe-key-pairs --query "KeyPairs[0].KeyName" --output text'
  );
}

export async function getFirstVPC() {
  return await executeAWSCommand(
    'aws ec2 describe-vpcs --query "Vpcs[0].VpcId" --output text'
  );
}

export async function getFirstSubnet(vpcId) {
  return await executeAWSCommand(
    `aws ec2 describe-subnets --filters "Name=vpc-id,Values=${vpcId}" --query "Subnets[0].SubnetId" --output text`
  );
}

export async function getFirstSecurityGroup(vpcId) {
  return await executeAWSCommand(
    `aws ec2 describe-security-groups --filters "Name=vpc-id,Values=${vpcId}" --query "SecurityGroups[0].GroupId" --output text`
  );
}

export async function launchEC2Instance() {
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

    return {
      instanceId,
      state,
      instanceType,
      az,
      name: CONFIG.ec2.instanceName,
    };
  } catch (error) {
    logError("Failed to launch EC2 instance");
    log(error.message, null, "red");
    throw error;
  }
}

export async function listS3Buckets() {
  try {
    logInfo("Listing S3 buckets...");
    const output = await executeAWSCommand("aws s3 ls");
    if (output) {
      console.log(output);
      logSuccess("S3 buckets listed successfully");
    } else {
      logInfo("No S3 buckets found");
    }
    return output;
  } catch (error) {
    logError("Failed to list S3 buckets");
    throw error;
  }
}

export async function listSecrets() {
  try {
    logInfo("Listing Secrets Manager secrets...");
    const output = await executeAWSCommand(
      "aws secretsmanager list-secrets --output json"
    );
    const secrets = JSON.parse(output);
    if (secrets.SecretList && secrets.SecretList.length > 0) {
      secrets.SecretList.forEach((secret) => {
        log(`  - ${secret.Name}`, null, "cyan");
      });
      logSuccess(`Found ${secrets.SecretList.length} secrets`);
    } else {
      logInfo("No secrets found");
    }
    return secrets;
  } catch (error) {
    logError("Failed to list secrets");
    throw error;
  }
}

export async function listSSMParameters() {
  try {
    logInfo("Listing SSM parameters...");
    const output = await executeAWSCommand(
      "aws ssm describe-parameters --output json"
    );
    const params = JSON.parse(output);
    if (params.Parameters && params.Parameters.length > 0) {
      params.Parameters.forEach((param) => {
        log(`  - ${param.Name}`, null, "cyan");
      });
      logSuccess(`Found ${params.Parameters.length} parameters`);
    } else {
      logInfo("No SSM parameters found");
    }
    return params;
  } catch (error) {
    logError("Failed to list SSM parameters");
    throw error;
  }
}

export async function listIAMUsers() {
  try {
    logInfo("Listing IAM users...");
    const output = await executeAWSCommand("aws iam list-users --output json");
    const users = JSON.parse(output);
    if (users.Users && users.Users.length > 0) {
      users.Users.forEach((user) => {
        log(`  - ${user.UserName} (ARN: ${user.Arn})`, null, "cyan");
      });
      logSuccess(`Found ${users.Users.length} users`);
    } else {
      logInfo("No IAM users found");
    }
    return users;
  } catch (error) {
    logError("Failed to list IAM users");
    throw error;
  }
}

export async function listIAMRoles() {
  try {
    logInfo("Listing IAM roles...");
    const output = await executeAWSCommand("aws iam list-roles --output json");
    const roles = JSON.parse(output);
    if (roles.Roles && roles.Roles.length > 0) {
      roles.Roles.forEach((role) => {
        log(`  - ${role.RoleName}`, null, "cyan");
      });
      logSuccess(`Found ${roles.Roles.length} roles`);
    } else {
      logInfo("No IAM roles found");
    }
    return roles;
  } catch (error) {
    logError("Failed to list IAM roles");
    throw error;
  }
}

export async function listEC2Instances() {
  try {
    logInfo("Listing EC2 instances...");
    const output = await executeAWSCommand(
      'aws ec2 describe-instances --query "Reservations[*].Instances[*].[InstanceId,State.Name,InstanceType,Tags[?Key==\'Name\'].Value|[0]]" --output text'
    );
    if (output) {
      console.log(output);
      logSuccess("EC2 instances listed successfully");
    } else {
      logInfo("No EC2 instances found");
    }
    return output;
  } catch (error) {
    logError("Failed to list EC2 instances");
    throw error;
  }
}

export async function listLambdaFunctions() {
  try {
    logInfo("Listing Lambda functions...");
    const output = await executeAWSCommand(
      "aws lambda list-functions --output json"
    );
    const functions = JSON.parse(output);
    if (functions.Functions && functions.Functions.length > 0) {
      functions.Functions.forEach((func) => {
        log(`  - ${func.FunctionName} (Runtime: ${func.Runtime})`, null, "cyan");
      });
      logSuccess(`Found ${functions.Functions.length} Lambda functions`);
    } else {
      logInfo("No Lambda functions found");
    }
    return functions;
  } catch (error) {
    logError("Failed to list Lambda functions");
    throw error;
  }
}

export async function getSSMParameter(parameterName) {
  try {
    logInfo(`Reading SSM parameter: ${parameterName}`);
    const output = await executeAWSCommand(
      `aws ssm get-parameter --name "${parameterName}" --with-decryption --output json`
    );
    const param = JSON.parse(output);
    logSuccess("Parameter value retrieved");
    log(`  Name: ${param.Parameter.Name}`, null, "cyan");
    log(`  Type: ${param.Parameter.Type}`, null, "dim");
    log(`  Value: ${param.Parameter.Value}`, null, "green");
    return param.Parameter;
  } catch (error) {
    logError("Failed to get SSM parameter");
    log(error.message, null, "red");
    throw error;
  }
}

export async function getSecretValue(secretName) {
  try {
    logInfo(`Reading secret: ${secretName}`);
    const output = await executeAWSCommand(
      `aws secretsmanager get-secret-value --secret-id "${secretName}" --output json`
    );
    const secret = JSON.parse(output);
    logSuccess("Secret retrieved");
    log(`  ARN: ${secret.ARN}`, null, "dim");
    log(`  Secret String: ${secret.SecretString}`, null, "green");
    return secret;
  } catch (error) {
    logError("Failed to get secret value");
    log(error.message, null, "red");
    throw error;
  }
}

export async function downloadS3Object(bucket, key, outputPath) {
  try {
    logInfo(`Downloading s3://${bucket}/${key} to ${outputPath}`);
    await executeAWSCommand(`aws s3 cp s3://${bucket}/${key} "${outputPath}"`);
    logSuccess(`Downloaded to: ${outputPath}`);
    return outputPath;
  } catch (error) {
    logError("Failed to download S3 object");
    log(error.message, null, "red");
    throw error;
  }
}

export async function uploadS3Object(localPath, bucket, key) {
  try {
    logInfo(`Uploading ${localPath} to s3://${bucket}/${key}`);
    await executeAWSCommand(`aws s3 cp "${localPath}" s3://${bucket}/${key}`);
    logSuccess("Upload successful");
    return `s3://${bucket}/${key}`;
  } catch (error) {
    logError("Failed to upload S3 object");
    log(error.message, null, "red");
    throw error;
  }
}

export async function listS3Objects(bucket, prefix = "") {
  try {
    logInfo(`Listing objects in s3://${bucket}/${prefix}`);
    const command = prefix
      ? `aws s3 ls s3://${bucket}/${prefix} --recursive`
      : `aws s3 ls s3://${bucket}/ --recursive`;
    const output = await executeAWSCommand(command);
    if (output) {
      console.log(output);
      logSuccess("Objects listed successfully");
    } else {
      logInfo("No objects found");
    }
    return output;
  } catch (error) {
    logError("Failed to list S3 objects");
    log(error.message, null, "red");
    throw error;
  }
}

export async function invokeLambda(functionName, payload = "{}") {
  try {
    logInfo(`Invoking Lambda function: ${functionName}`);
    const tmpFile = `/tmp/lambda-response-${Date.now()}.json`;
    await executeAWSCommand(
      `aws lambda invoke --function-name "${functionName}" --payload '${payload}' ${tmpFile}`
    );
    const response = fs.readFileSync(tmpFile, "utf8");
    fs.unlinkSync(tmpFile);
    logSuccess("Lambda invoked successfully");
    log("Response:", null, "green");
    console.log(response);
    return response;
  } catch (error) {
    logError("Failed to invoke Lambda function");
    log(error.message, null, "red");
    throw error;
  }
}

export async function createSSMParameter(parameterName, value, paramType = "String") {
  try {
    logInfo(`Creating SSM parameter: ${parameterName}`);
    await executeAWSCommand(
      `aws ssm put-parameter --name "${parameterName}" --value "${value}" --type ${paramType} --overwrite`
    );
    logSuccess("Parameter created/updated successfully");
    return parameterName;
  } catch (error) {
    logError("Failed to create SSM parameter");
    log(error.message, null, "red");
    throw error;
  }
}
