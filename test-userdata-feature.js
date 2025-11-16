#!/usr/bin/env node

/**
 * Test user data extraction feature with sample data
 * This simulates what happens when an EC2 instance has user data
 */

import {
  decodeUserData,
  scanForSecrets,
  parseCloudInit,
} from "./src/userdata.js";
import { logInfo, logSuccess, logSeparator, log, logDanger, logWarning } from "./src/utils.js";

console.log("\n");
logSeparator();
log("USER DATA FEATURE TEST", null, "bright");
logSeparator();
console.log("\n");

// Test 1: Plain text user data with secrets
logInfo("Test 1: Shell script with hardcoded secrets");
logSeparator();

const testData1 = `#!/bin/bash
# EC2 startup script
export DB_PASSWORD=SuperSecret123!
export AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
export AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
export DATABASE_URL=postgres://admin:password123@db.example.com:5432/mydb

echo "Starting application..."
npm start
`;

console.log(testData1);
logSeparator();

const secrets1 = scanForSecrets(testData1);
logSuccess(`Found ${secrets1.length} secrets!`);
secrets1.forEach((secret) => {
  log(`  [${secret.severity}] ${secret.type}`, null, secret.severity === "CRITICAL" ? "red" : "yellow");
});

console.log("\n");

// Test 2: Base64 encoded user data
logInfo("Test 2: Base64-encoded user data");
logSeparator();

const plainText = `#!/bin/bash
password=MySecretPassword123
api_key=sk_test_1234567890abcdefghijklmnop
`;

const encoded = Buffer.from(plainText).toString("base64");
log(`Encoded: ${encoded.substring(0, 50)}...`, null, "dim");

const decoded = decodeUserData(encoded);
logSuccess("Decoded successfully!");
console.log(decoded);

const secrets2 = scanForSecrets(decoded);
logSuccess(`Found ${secrets2.length} secrets in decoded data!`);

console.log("\n");

// Test 3: Cloud-init configuration
logInfo("Test 3: Cloud-init configuration");
logSeparator();

const cloudInitData = `#cloud-config
packages:
  - docker
  - nginx
  - postgresql

runcmd:
  - export DB_PASS=secret123
  - systemctl start docker
  - docker run -e API_KEY=ghp_1234567890abcdefghijklmnopqrstuv1234 myapp

write_files:
  - path: /etc/app/config.json
    content: |
      {
        "database": "postgres://user:pass@localhost/db"
      }
`;

console.log(cloudInitData);
logSeparator();

const cloudInit = parseCloudInit(cloudInitData);
logSuccess(`Cloud-init detected: ${cloudInit.format}`);
log(`  Packages: ${cloudInit.packages.length}`, null, "cyan");
log(`  Commands: ${cloudInit.runcmd.length}`, null, "cyan");

const secrets3 = scanForSecrets(cloudInitData);
logDanger(`Found ${secrets3.length} secrets in cloud-init!`);
secrets3.forEach((secret) => {
  log(`  • ${secret.type}`, null, "yellow");
});

console.log("\n");

// Test 4: Private key detection
logInfo("Test 4: Private SSH key detection");
logSeparator();

const keyData = `#!/bin/bash
cat > /root/.ssh/id_rsa << 'EOF'
-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEA1234567890abcdefghijklmnop
qrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ
-----END RSA PRIVATE KEY-----
EOF
chmod 600 /root/.ssh/id_rsa
`;

const secrets4 = scanForSecrets(keyData);
logDanger(`Found ${secrets4.length} critical secret(s)!`);
secrets4.forEach((secret) => {
  log(`  [${secret.severity}] ${secret.type}`, null, "red");
});

console.log("\n");

// Summary
logSeparator();
logSuccess("USER DATA EXTRACTION FEATURE TEST COMPLETE");
logSeparator();

const totalSecrets = secrets1.length + secrets2.length + secrets3.length + secrets4.length;
logWarning(`Total secrets found across all tests: ${totalSecrets}`);
log("\nThis is what the feature detects when EC2 instances have user data!", null, "cyan");
log("Many instances DON'T have user data, which is why you might see:", null, "dim");
log('  "No user data configured for this instance"', null, "yellow");

console.log("\n");
