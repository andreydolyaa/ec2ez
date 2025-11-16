import { COLORS } from "./config.js";
import { logSeparator, logSuccess, logWarning, logInfo, log } from "./utils.js";

export class SessionSummary {
  constructor() {
    this.findings = {
      roles: [], // Array of role objects with credentials
      credentials: {
        extracted: false,
        valid: false,
        region: null,
        accountId: null,
        roleName: null,
        expiresIn: null,
      },
      imds: {
        totalMetadata: 0,
        interestingPaths: [],
        token: null,
      },
      s3: {
        presignedUrls: [],
        accessibleBuckets: [],
        downloadedObjects: [],
      },
      permissions: {
        total: 0,
        discovered: [],
        dangerous: [],
      },
      userData: {
        found: false,
        hasSecrets: false,
        secretCount: 0,
        criticalSecretCount: 0,
        wasDecoded: false,
        isCloudInit: false,
      },
      recommendations: [],
      timestamp: new Date().toISOString(),
    };
  }

  addRole(roleData) {
    this.findings.roles.push(roleData);
  }

  setCredentials(data) {
    this.findings.credentials = { ...this.findings.credentials, ...data };
  }

  setIMDS(data) {
    this.findings.imds = { ...this.findings.imds, ...data };
  }

  addS3Finding(type, data) {
    if (type === "presignedUrl") {
      this.findings.s3.presignedUrls.push(data);
    } else if (type === "bucket") {
      this.findings.s3.accessibleBuckets.push(data);
    } else if (type === "object") {
      this.findings.s3.downloadedObjects.push(data);
    }
  }

  setPermissions(data) {
    this.findings.permissions = { ...this.findings.permissions, ...data };
  }

  setUserData(data) {
    this.findings.userData = { ...this.findings.userData, ...data };
  }

  addRecommendation(recommendation) {
    this.findings.recommendations.push(recommendation);
  }

  generateRecommendations() {
    const recs = [];

    if (this.findings.credentials.extracted && !this.findings.credentials.valid) {
      recs.push({
        level: "warning",
        category: "Credentials",
        message: "Extracted credentials are invalid - they may be expired or restricted",
      });
    }

    if (this.findings.credentials.expiresIn && this.findings.credentials.expiresIn < 1) {
      recs.push({
        level: "warning",
        category: "Credentials",
        message: `Credentials expire in ${this.findings.credentials.expiresIn.toFixed(2)} hours - extract fresh credentials soon`,
      });
    }

    if (this.findings.s3.accessibleBuckets.length > 0) {
      recs.push({
        level: "info",
        category: "S3",
        message: `Found ${this.findings.s3.accessibleBuckets.length} accessible S3 bucket(s) - review contents for sensitive data`,
      });
    }

    if (this.findings.s3.presignedUrls.length > 0) {
      recs.push({
        level: "success",
        category: "S3",
        message: `Found ${this.findings.s3.presignedUrls.length} pre-signed URL(s) - these bypass credential requirements`,
      });
    }

    if (this.findings.permissions.dangerous.length > 0) {
      recs.push({
        level: "critical",
        category: "Permissions",
        message: `Found ${this.findings.permissions.dangerous.length} dangerous permission(s) - potential for privilege escalation`,
      });
    }

    if (this.findings.permissions.total === 1 && this.findings.permissions.discovered.includes("sts:GetCallerIdentity")) {
      recs.push({
        level: "info",
        category: "Permissions",
        message: "Role has minimal permissions - likely read-only or restricted access",
      });
    }

    if (this.findings.imds.totalMetadata > 20) {
      recs.push({
        level: "info",
        category: "IMDS",
        message: "Large amount of IMDS metadata discovered - review for sensitive information",
      });
    }

    if (this.findings.userData.found && this.findings.userData.criticalSecretCount > 0) {
      recs.push({
        level: "critical",
        category: "User Data",
        message: `Found ${this.findings.userData.criticalSecretCount} critical secret(s) in user data - IMMEDIATE ACTION REQUIRED`,
      });
    }

    if (this.findings.userData.found && this.findings.userData.secretCount > 0) {
      recs.push({
        level: "warning",
        category: "User Data",
        message: `Found ${this.findings.userData.secretCount} potential secret(s) in user data - review and rotate credentials`,
      });
    }

    if (this.findings.userData.found && this.findings.userData.isCloudInit) {
      recs.push({
        level: "info",
        category: "User Data",
        message: "Cloud-init configuration detected - review startup scripts for sensitive operations",
      });
    }

    this.findings.recommendations = recs;
  }

  display() {
    console.log();
    logSeparator();
    log(`${COLORS.bright}${COLORS.cyan}SESSION SUMMARY${COLORS.reset}`, null, "cyan");
    logSeparator();

    if (this.findings.imds.token) {
      log(`${COLORS.bright}IMDSv2 Token:${COLORS.reset}`, null, "cyan");
      logSuccess(`  ✓ Token extracted: ${this.findings.imds.token}`);
      console.log();
    }

    if (this.findings.roles.length > 0) {
      log(`${COLORS.bright}Discovered IAM Roles (${this.findings.roles.length}):${COLORS.reset}`, null, "cyan");

      this.findings.roles.forEach((role, index) => {
        const roleNum = index + 1;
        logInfo(`Role #${roleNum}: ${role.name}`);
        log(`  Access Key ID: ${role.credentials?.AccessKeyId || "N/A"}`, null, "green");
        log(`  Secret Access Key: ${role.credentials?.SecretAccessKey || "N/A"}`, null, "green");
        log(`  Session Token: ${role.credentials?.Token || "N/A"}`, null, "green");
        log(`  Expiration: ${role.credentials?.Expiration || "N/A"}`, null, "yellow");

        if (role.s3Access) {
          logSuccess(`  S3 Access: ✓ YES (${role.bucketsFound} bucket(s) found)`);
        } else {
          log(`  S3 Access: ✗ NO`, null, "dim");
        }
        console.log();
      });
    }

    if (this.findings.credentials.extracted && this.findings.roles.length === 0) {
      log(`${COLORS.bright}Credentials:${COLORS.reset}`, null, "cyan");
      logSuccess("  ✓ Credentials extracted from IMDS");
      if (this.findings.credentials.valid) {
        logSuccess(`  ✓ Credentials validated in region: ${this.findings.credentials.region}`);
        log(`    Account ID: ${this.findings.credentials.accountId}`, null, "green");
        log(`    Role: ${this.findings.credentials.roleName}`, null, "green");
        if (this.findings.credentials.expiresIn) {
          log(`    Expires in: ${this.findings.credentials.expiresIn.toFixed(2)} hours`, null, "yellow");
        }
      } else {
        logWarning("  ✗ Credentials are invalid or restricted");
      }
      console.log();
    }

    log(`${COLORS.bright}IMDS Metadata:${COLORS.reset}`, null, "cyan");
    log(`  Total metadata entries: ${this.findings.imds.totalMetadata}`, null, "dim");
    if (this.findings.imds.interestingPaths.length > 0) {
      logInfo(`  Interesting paths found: ${this.findings.imds.interestingPaths.length}`);
      this.findings.imds.interestingPaths.slice(0, 5).forEach(path => {
        log(`    - ${path}`, null, "cyan");
      });
      if (this.findings.imds.interestingPaths.length > 5) {
        log(`    ... and ${this.findings.imds.interestingPaths.length - 5} more`, null, "dim");
      }
    }
    console.log();

    if (this.findings.userData.found) {
      log(`${COLORS.bright}User Data:${COLORS.reset}`, null, "cyan");
      logSuccess("  ✓ User data extracted from IMDS");

      if (this.findings.userData.wasDecoded) {
        logInfo("  ✓ Base64-encoded data decoded");
      }

      if (this.findings.userData.isCloudInit) {
        logInfo("  ✓ Cloud-init configuration detected");
      }

      if (this.findings.userData.hasSecrets) {
        if (this.findings.userData.criticalSecretCount > 0) {
          log(
            `  ⚠ CRITICAL: ${this.findings.userData.criticalSecretCount} critical secret(s) found`,
            null,
            "red"
          );
        }
        logWarning(`  Total secrets found: ${this.findings.userData.secretCount}`);
      } else {
        log("  No secrets detected", null, "dim");
      }
      console.log();
    }

    log(`${COLORS.bright}S3 Access:${COLORS.reset}`, null, "cyan");
    if (this.findings.s3.presignedUrls.length > 0) {
      logSuccess(`  ✓ Pre-signed URLs: ${this.findings.s3.presignedUrls.length}`);
      this.findings.s3.presignedUrls.forEach(url => {
        log(`    - ${url.url}`, null, "green");
      });
    }

    if (this.findings.s3.accessibleBuckets.length > 0) {
      logSuccess(`  ✓ Accessible buckets: ${this.findings.s3.accessibleBuckets.length}`);
      this.findings.s3.accessibleBuckets.forEach(bucket => {
        log(`    - ${bucket}`, null, "green");
      });
    }

    if (this.findings.s3.downloadedObjects.length > 0) {
      logSuccess(`  ✓ Objects found: ${this.findings.s3.downloadedObjects.length}`);
      this.findings.s3.downloadedObjects.forEach(obj => {
        log(`    - ${obj.bucket}/${obj.key}`, null, "green");
      });
    }

    if (this.findings.s3.presignedUrls.length === 0 &&
        this.findings.s3.accessibleBuckets.length === 0 &&
        this.findings.s3.downloadedObjects.length === 0) {
      log("  No S3 access discovered", null, "dim");
    }
    console.log();

    log(`${COLORS.bright}Permissions:${COLORS.reset}`, null, "cyan");
    log(`  Total permissions: ${this.findings.permissions.total}`, null, "dim");

    if (this.findings.permissions.discovered.length > 0) {
      logInfo(`  Discovered permissions: ${this.findings.permissions.discovered.length}`);
      this.findings.permissions.discovered.slice(0, 10).forEach(perm => {
        log(`    - ${perm}`, null, "cyan");
      });
      if (this.findings.permissions.discovered.length > 10) {
        log(`    ... and ${this.findings.permissions.discovered.length - 10} more`, null, "dim");
      }
    }

    if (this.findings.permissions.dangerous.length > 0) {
      console.log();
      logWarning(`  ⚠ Dangerous permissions: ${this.findings.permissions.dangerous.length}`);
      this.findings.permissions.dangerous.forEach(perm => {
        log(`    [!] ${perm.permission} - ${perm.description}`, null, "yellow");
      });
    }
    console.log();

    this.generateRecommendations();

    if (this.findings.recommendations.length > 0) {
      log(`${COLORS.bright}Recommendations:${COLORS.reset}`, null, "cyan");

      const critical = this.findings.recommendations.filter(r => r.level === "critical");
      const warnings = this.findings.recommendations.filter(r => r.level === "warning");
      const info = this.findings.recommendations.filter(r => r.level === "info" || r.level === "success");

      if (critical.length > 0) {
        critical.forEach(rec => {
          log(`  ${COLORS.red}[CRITICAL]${COLORS.reset} ${rec.category}: ${rec.message}`, null, "red");
        });
      }

      if (warnings.length > 0) {
        warnings.forEach(rec => {
          log(`  ${COLORS.yellow}[WARNING]${COLORS.reset} ${rec.category}: ${rec.message}`, null, "yellow");
        });
      }

      if (info.length > 0) {
        info.forEach(rec => {
          log(`  ${COLORS.cyan}[INFO]${COLORS.reset} ${rec.category}: ${rec.message}`, null, "cyan");
        });
      }

      console.log();
    }

    logSeparator();
    log(`Session completed: ${this.findings.timestamp}`, null, "dim");
    logSeparator();
  }

  export() {
    return JSON.stringify(this.findings, null, 2);
  }
}
