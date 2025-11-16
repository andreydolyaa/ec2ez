import { jest, describe, test, beforeEach, afterEach, expect } from "@jest/globals";
import { SessionSummary } from "../src/summary.js";

// Suppress console output during tests
let consoleSpy;

beforeEach(() => {
  consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  consoleSpy.mockRestore();
});

describe("summary.js - SessionSummary", () => {
  let summary;

  beforeEach(() => {
    summary = new SessionSummary();
  });

  describe("constructor", () => {
    test("should initialize with default empty findings", () => {
      expect(summary.findings).toBeDefined();
      expect(summary.findings.roles).toEqual([]);
      expect(summary.findings.credentials.extracted).toBe(false);
      expect(summary.findings.permissions.total).toBe(0);
      expect(summary.findings.s3.presignedUrls).toEqual([]);
      expect(summary.findings.timestamp).toBeDefined();
    });

    test("should set timestamp to ISO format", () => {
      const timestamp = summary.findings.timestamp;
      expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });
  });

  describe("addRole", () => {
    test("should add a role to the roles array", () => {
      const roleData = {
        name: "test-role",
        credentials: {
          AccessKeyId: "AKIA123",
          SecretAccessKey: "secret",
        },
      };

      summary.addRole(roleData);

      expect(summary.findings.roles).toHaveLength(1);
      expect(summary.findings.roles[0]).toEqual(roleData);
    });

    test("should add multiple roles", () => {
      summary.addRole({ name: "role1" });
      summary.addRole({ name: "role2" });
      summary.addRole({ name: "role3" });

      expect(summary.findings.roles).toHaveLength(3);
      expect(summary.findings.roles.map((r) => r.name)).toEqual([
        "role1",
        "role2",
        "role3",
      ]);
    });
  });

  describe("setCredentials", () => {
    test("should update credentials data", () => {
      const credData = {
        extracted: true,
        valid: true,
        region: "us-east-1",
        accountId: "123456789012",
      };

      summary.setCredentials(credData);

      expect(summary.findings.credentials.extracted).toBe(true);
      expect(summary.findings.credentials.valid).toBe(true);
      expect(summary.findings.credentials.region).toBe("us-east-1");
      expect(summary.findings.credentials.accountId).toBe("123456789012");
    });

    test("should merge with existing credentials data", () => {
      summary.setCredentials({ extracted: true });
      summary.setCredentials({ valid: true, region: "us-west-2" });

      expect(summary.findings.credentials.extracted).toBe(true);
      expect(summary.findings.credentials.valid).toBe(true);
      expect(summary.findings.credentials.region).toBe("us-west-2");
    });
  });

  describe("setIMDS", () => {
    test("should update IMDS data", () => {
      const imdsData = {
        token: "test-token-123",
        totalMetadata: 50,
        interestingPaths: ["/path1", "/path2"],
      };

      summary.setIMDS(imdsData);

      expect(summary.findings.imds.token).toBe("test-token-123");
      expect(summary.findings.imds.totalMetadata).toBe(50);
      expect(summary.findings.imds.interestingPaths).toHaveLength(2);
    });
  });

  describe("addS3Finding", () => {
    test("should add presigned URL", () => {
      const url = { url: "https://s3.amazonaws.com/bucket/object?signed=..." };

      summary.addS3Finding("presignedUrl", url);

      expect(summary.findings.s3.presignedUrls).toHaveLength(1);
      expect(summary.findings.s3.presignedUrls[0]).toEqual(url);
    });

    test("should add bucket", () => {
      summary.addS3Finding("bucket", "my-bucket");

      expect(summary.findings.s3.accessibleBuckets).toHaveLength(1);
      expect(summary.findings.s3.accessibleBuckets[0]).toBe("my-bucket");
    });

    test("should add object", () => {
      const obj = { bucket: "my-bucket", key: "file.txt" };

      summary.addS3Finding("object", obj);

      expect(summary.findings.s3.downloadedObjects).toHaveLength(1);
      expect(summary.findings.s3.downloadedObjects[0]).toEqual(obj);
    });

    test("should handle multiple S3 findings", () => {
      summary.addS3Finding("bucket", "bucket1");
      summary.addS3Finding("bucket", "bucket2");
      summary.addS3Finding("presignedUrl", { url: "url1" });
      summary.addS3Finding("object", { bucket: "b1", key: "k1" });

      expect(summary.findings.s3.accessibleBuckets).toHaveLength(2);
      expect(summary.findings.s3.presignedUrls).toHaveLength(1);
      expect(summary.findings.s3.downloadedObjects).toHaveLength(1);
    });
  });

  describe("setPermissions", () => {
    test("should update permissions data", () => {
      const permData = {
        total: 15,
        discovered: ["s3:ListBucket", "ec2:DescribeInstances"],
        dangerous: [
          { permission: "iam:PassRole", description: "Can escalate privileges" },
        ],
      };

      summary.setPermissions(permData);

      expect(summary.findings.permissions.total).toBe(15);
      expect(summary.findings.permissions.discovered).toHaveLength(2);
      expect(summary.findings.permissions.dangerous).toHaveLength(1);
    });
  });

  describe("addRecommendation", () => {
    test("should add a recommendation", () => {
      const rec = {
        level: "warning",
        category: "Security",
        message: "Review credentials",
      };

      summary.addRecommendation(rec);

      expect(summary.findings.recommendations).toHaveLength(1);
      expect(summary.findings.recommendations[0]).toEqual(rec);
    });
  });

  describe("generateRecommendations", () => {
    test("should recommend warning for invalid credentials", () => {
      summary.setCredentials({ extracted: true, valid: false });

      summary.generateRecommendations();

      const warnings = summary.findings.recommendations.filter(
        (r) => r.level === "warning"
      );
      expect(warnings.length).toBeGreaterThan(0);
      expect(warnings[0].category).toBe("Credentials");
    });

    test("should recommend warning for expiring credentials", () => {
      summary.setCredentials({ expiresIn: 0.5 });

      summary.generateRecommendations();

      const warnings = summary.findings.recommendations.filter(
        (r) => r.category === "Credentials"
      );
      expect(warnings.length).toBeGreaterThan(0);
    });

    test("should recommend review for accessible S3 buckets", () => {
      summary.addS3Finding("bucket", "bucket1");
      summary.addS3Finding("bucket", "bucket2");

      summary.generateRecommendations();

      const s3Recs = summary.findings.recommendations.filter(
        (r) => r.category === "S3"
      );
      expect(s3Recs.length).toBeGreaterThan(0);
      expect(s3Recs[0].message).toContain("2 accessible S3 bucket(s)");
    });

    test("should recommend critical warning for dangerous permissions", () => {
      summary.setPermissions({
        dangerous: [
          { permission: "iam:PassRole", description: "Escalation" },
          { permission: "iam:CreateUser", description: "Create users" },
        ],
      });

      summary.generateRecommendations();

      const critical = summary.findings.recommendations.filter(
        (r) => r.level === "critical"
      );
      expect(critical.length).toBeGreaterThan(0);
      expect(critical[0].message).toContain("2 dangerous permission(s)");
    });

    test("should recommend info for minimal permissions", () => {
      summary.setPermissions({
        total: 1,
        discovered: ["sts:GetCallerIdentity"],
      });

      summary.generateRecommendations();

      const info = summary.findings.recommendations.filter(
        (r) => r.level === "info" && r.category === "Permissions"
      );
      expect(info.length).toBeGreaterThan(0);
      expect(info[0].message).toContain("minimal permissions");
    });

    test("should recommend info for large metadata", () => {
      summary.setIMDS({ totalMetadata: 50 });

      summary.generateRecommendations();

      const info = summary.findings.recommendations.filter(
        (r) => r.category === "IMDS"
      );
      expect(info.length).toBeGreaterThan(0);
    });
  });

  describe("export", () => {
    test("should export findings as JSON string", () => {
      summary.setCredentials({ extracted: true });
      summary.addRole({ name: "test-role" });

      const exported = summary.export();
      const parsed = JSON.parse(exported);

      expect(parsed.credentials.extracted).toBe(true);
      expect(parsed.roles).toHaveLength(1);
      expect(parsed.roles[0].name).toBe("test-role");
    });

    test("should export formatted JSON with indentation", () => {
      const exported = summary.export();

      // Should be formatted (contains newlines and spaces)
      expect(exported).toContain("\n");
      expect(exported).toContain("  ");
    });
  });

  describe("display", () => {
    test("should display summary without errors", () => {
      summary.setIMDS({ token: "test-token", totalMetadata: 10 });
      summary.addRole({
        name: "test-role",
        credentials: {
          AccessKeyId: "AKIA123",
          SecretAccessKey: "secret",
        },
      });

      summary.display();

      expect(consoleSpy).toHaveBeenCalled();
    });

    test("should display dangerous permissions in summary", () => {
      summary.setPermissions({
        total: 5,
        discovered: ["s3:*"],
        dangerous: [
          { permission: "iam:PassRole", description: "Privilege escalation" },
        ],
      });

      summary.display();

      expect(consoleSpy).toHaveBeenCalled();
      const calls = consoleSpy.mock.calls
        .map((c) => c.join(" "))
        .join(" ");
      expect(calls).toContain("Dangerous permissions");
    });

    test("should display recommendations in summary", () => {
      summary.setCredentials({ extracted: true, valid: false });
      summary.setPermissions({
        dangerous: [{ permission: "iam:*", description: "Full IAM access" }],
      });

      summary.display();

      expect(consoleSpy).toHaveBeenCalled();
      const calls = consoleSpy.mock.calls
        .map((c) => c.join(" "))
        .join(" ");
      expect(calls).toContain("Recommendations");
    });
  });
});
