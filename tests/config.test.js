import { describe, test, expect } from "@jest/globals";
import { CONFIG, COLORS } from "../src/config.js";
import os from "os";
import path from "path";

describe("config.js", () => {
  describe("CONFIG", () => {
    test("should have ssrf configuration", () => {
      expect(CONFIG.ssrf).toBeDefined();
      expect(CONFIG.ssrf.paramName).toBe("url");
    });

    test("should have imdsv2 configuration", () => {
      expect(CONFIG.imdsv2).toBeDefined();
      expect(CONFIG.imdsv2.baseUrl).toBe("http://169.254.169.254");
      expect(CONFIG.imdsv2.endpoints).toBeDefined();
      expect(CONFIG.imdsv2.endpoints.token).toBe("/latest/api/token");
      expect(CONFIG.imdsv2.endpoints.iamMetadata).toBe(
        "/latest/meta-data/iam/security-credentials"
      );
    });

    test("should have correct IMDSv2 headers", () => {
      expect(CONFIG.imdsv2.headers).toBeDefined();
      expect(CONFIG.imdsv2.headers.tokenTTL).toBe(
        "x-aws-ec2-metadata-token-ttl-seconds"
      );
      expect(CONFIG.imdsv2.headers.tokenRequest).toBe(
        "x-aws-ec2-metadata-token"
      );
    });

    test("should have aws configuration", () => {
      expect(CONFIG.aws).toBeDefined();
      expect(CONFIG.aws.defaultRegion).toBe("il-central-1");
      expect(CONFIG.aws.credentialsPath).toBe(
        path.join(os.homedir(), ".aws", "credentials")
      );
    });

    test("should have ec2 configuration", () => {
      expect(CONFIG.ec2).toBeDefined();
      expect(CONFIG.ec2.ami).toBe("ami-006183c868a62af95");
      expect(CONFIG.ec2.instanceType).toBe("t3.micro");
      expect(CONFIG.ec2.instanceCount).toBe(1);
      expect(CONFIG.ec2.instanceName).toBeDefined();
      expect(typeof CONFIG.ec2.instanceName).toBe("string");
      // Instance name should match pattern: Adjective + Noun + 4-digit number
      expect(CONFIG.ec2.instanceName).toMatch(/^[A-Z][a-z]+[A-Z][a-z]+\d{4}$/);
    });
  });

  describe("COLORS", () => {
    test("should have all color codes defined", () => {
      expect(COLORS.reset).toBe("\x1b[0m");
      expect(COLORS.bright).toBe("\x1b[1m");
      expect(COLORS.dim).toBe("\x1b[2m");
      expect(COLORS.red).toBe("\x1b[31m");
      expect(COLORS.green).toBe("\x1b[32m");
      expect(COLORS.yellow).toBe("\x1b[33m");
      expect(COLORS.blue).toBe("\x1b[34m");
      expect(COLORS.magenta).toBe("\x1b[35m");
      expect(COLORS.cyan).toBe("\x1b[36m");
      expect(COLORS.white).toBe("\x1b[37m");
    });

    test("should have exactly 10 color properties", () => {
      expect(Object.keys(COLORS)).toHaveLength(10);
    });
  });
});
