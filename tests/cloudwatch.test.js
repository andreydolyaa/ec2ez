import {
  jest,
  describe,
  test,
  beforeEach,
  afterEach,
  expect,
} from "@jest/globals";
import fs from "fs";
import { exportCloudWatchFindings } from "../src/cloudwatch.js";

// Suppress console output during tests
let consoleSpy;
let fsWriteSpy;

beforeEach(() => {
  consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {});
  fsWriteSpy = jest.spyOn(fs, "writeFileSync").mockImplementation(() => {});
});

afterEach(() => {
  consoleSpy.mockRestore();
  fsWriteSpy.mockRestore();
});

describe("cloudwatch.js", () => {
  describe("exportCloudWatchFindings", () => {
    test("should export findings to file", () => {
      const results = {
        scannedGroups: 2,
        scannedStreams: 5,
        scannedEvents: 100,
        secretsFound: [
          {
            type: "AWS Access Key",
            value: "AKIAIOSFODNN7EXAMPLE",
            severity: "CRITICAL",
            logGroup: "/aws/lambda/test",
            logStream: "2025/11/16/stream1",
          },
          {
            type: "Password",
            value: "password123",
            severity: "HIGH",
            logGroup: "/aws/lambda/test",
            logStream: "2025/11/16/stream1",
          },
        ],
        logGroupsWithSecrets: ["/aws/lambda/test"],
      };

      const result = exportCloudWatchFindings(results);

      expect(result).toBe(true);
      expect(fsWriteSpy).toHaveBeenCalledTimes(1);

      const writeCall = fsWriteSpy.mock.calls[0];
      const filename = writeCall[0];
      const content = writeCall[1];

      expect(filename).toContain("cloudwatch_secrets_");
      expect(filename).toContain(".txt");
      expect(content).toContain("CLOUDWATCH LOGS - SECRETS EXTRACTION REPORT");
      expect(content).toContain("AWS Access Key");
      expect(content).toContain("AKIAIOSFODNN7EXAMPLE");
      expect(content).toContain("/aws/lambda/test");
      expect(content).toContain("CRITICAL SEVERITY SECRETS");
      expect(content).toContain("HIGH SEVERITY SECRETS");
    });

    test("should return false when no secrets to export", () => {
      const results = {
        secretsFound: [],
      };

      const result = exportCloudWatchFindings(results);

      expect(result).toBe(false);
      expect(fsWriteSpy).not.toHaveBeenCalled();
    });

    test("should return false for null results", () => {
      const result = exportCloudWatchFindings(null);

      expect(result).toBe(false);
      expect(fsWriteSpy).not.toHaveBeenCalled();
    });

    test("should handle file write errors", () => {
      fsWriteSpy.mockImplementation(() => {
        throw new Error("Permission denied");
      });

      const results = {
        scannedGroups: 1,
        scannedStreams: 1,
        scannedEvents: 10,
        secretsFound: [
          {
            type: "Password",
            value: "test123",
            severity: "MEDIUM",
            logGroup: "/test",
            logStream: "stream",
          },
        ],
        logGroupsWithSecrets: ["/test"],
      };

      const result = exportCloudWatchFindings(results);

      expect(result).toBe(false);
    });

    test("should group secrets by severity correctly", () => {
      const results = {
        scannedGroups: 1,
        scannedStreams: 1,
        scannedEvents: 50,
        secretsFound: [
          {
            type: "AWS Access Key",
            value: "AKIA123",
            severity: "CRITICAL",
            logGroup: "/test",
            logStream: "stream1",
          },
          {
            type: "Database URL",
            value: "postgres://user:pass@host/db",
            severity: "HIGH",
            logGroup: "/test",
            logStream: "stream1",
          },
          {
            type: "API Token",
            value: "token123",
            severity: "MEDIUM",
            logGroup: "/test",
            logStream: "stream2",
          },
        ],
        logGroupsWithSecrets: ["/test"],
      };

      exportCloudWatchFindings(results);

      const content = fsWriteSpy.mock.calls[0][1];

      expect(content).toContain("CRITICAL SEVERITY SECRETS");
      expect(content).toContain("HIGH SEVERITY SECRETS");
      expect(content).toContain("MEDIUM SEVERITY SECRETS");
      expect(content).toContain("LOG GROUPS WITH SECRETS");
      expect(content).toContain("/test (3 secret(s))");
    });

    test("should include metadata in export", () => {
      const results = {
        scannedGroups: 10,
        scannedStreams: 25,
        scannedEvents: 500,
        secretsFound: [
          {
            type: "AWS Access Key",
            value: "AKIA123",
            severity: "CRITICAL",
            logGroup: "/test",
            logStream: "stream1",
          },
        ],
        logGroupsWithSecrets: ["/test"],
      };

      exportCloudWatchFindings(results);

      const content = fsWriteSpy.mock.calls[0][1];

      expect(content).toContain("Log groups scanned: 10");
      expect(content).toContain("Log streams scanned: 25");
      expect(content).toContain("Log events analyzed: 500");
      expect(content).toContain("Total secrets found: 1");
    });

    test("should show log stream context for each secret", () => {
      const results = {
        scannedGroups: 1,
        scannedStreams: 2,
        scannedEvents: 10,
        secretsFound: [
          {
            type: "Password",
            value: "pass123",
            severity: "MEDIUM",
            logGroup: "/aws/lambda/func",
            logStream: "2025/11/16/[$LATEST]abc123",
          },
        ],
        logGroupsWithSecrets: ["/aws/lambda/func"],
      };

      exportCloudWatchFindings(results);

      const content = fsWriteSpy.mock.calls[0][1];

      expect(content).toContain("Log Group: /aws/lambda/func");
      expect(content).toContain("Log Stream: 2025/11/16/[$LATEST]abc123");
    });
  });
});
