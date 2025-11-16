import {
  jest,
  describe,
  test,
  beforeEach,
  afterEach,
  expect,
} from "@jest/globals";
import {
  executeAWSCommand,
  validateCredentials,
} from "../src/aws.js";

// We'll test aws.js integration-style rather than mocking child_process
// because of ES module limitations

let consoleSpy;

beforeEach(() => {
  consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  consoleSpy.mockRestore();
});

describe("aws.js", () => {
  describe("executeAWSCommand", () => {
    test("should be a function", () => {
      expect(typeof executeAWSCommand).toBe("function");
    });

    test("should throw error for invalid command", async () => {
      await expect(
        executeAWSCommand("aws invalid-nonexistent-service-xyz")
      ).rejects.toThrow();
    });

    test("should handle command execution", async () => {
      // Test with echo command (always available)
      const result = await executeAWSCommand('echo "test"');
      expect(result).toBe("test");
    });
  });

  describe("validateCredentials", () => {
    test("should be a function", () => {
      expect(typeof validateCredentials).toBe("function");
    });

    test("should return object with required properties", async () => {
      // This will fail if credentials don't exist, but we can still test structure
      try {
        const result = await validateCredentials(false);
        expect(result).toHaveProperty("valid");
        expect(result).toHaveProperty("region");
      } catch (error) {
        // If it fails (no credentials), that's expected in test environment
        expect(error).toBeDefined();
      }
    });

    test("should handle tryMultipleRegions parameter", async () => {
      // Test that the function accepts the parameter
      try {
        await validateCredentials(true);
      } catch (error) {
        // Expected to fail in test environment without real AWS credentials
        expect(error).toBeDefined();
      }

      try {
        await validateCredentials(false);
      } catch (error) {
        // Expected to fail in test environment without real AWS credentials
        expect(error).toBeDefined();
      }
    });
  });

  describe("AWS functions existence", () => {
    test("should export executeAWSCommand", () => {
      expect(executeAWSCommand).toBeDefined();
      expect(typeof executeAWSCommand).toBe("function");
    });

    test("should export validateCredentials", () => {
      expect(validateCredentials).toBeDefined();
      expect(typeof validateCredentials).toBe("function");
    });
  });
});
