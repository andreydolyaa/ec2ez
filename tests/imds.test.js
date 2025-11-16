import {
  jest,
  describe,
  test,
  beforeEach,
  afterEach,
  expect,
} from "@jest/globals";
import axios from "axios";
import fs from "fs";
import {
  testSSRFVulnerability,
  fetchIMDSv2Token,
  fetchIAMRole,
  fetchAllIAMRoles,
  fetchCredentials,
  fetchIAMInfo,
  writeAWSCredentials,
} from "../src/imds.js";
import { CONFIG } from "../src/config.js";

// Suppress console output during tests
let consoleSpy;
let axiosGetSpy;
let axiosPutSpy;
let fsExistsSpy;
let fsMkdirSpy;
let fsWriteSpy;

beforeEach(() => {
  consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {});
  axiosGetSpy = jest.spyOn(axios, "get").mockImplementation(() => {});
  axiosPutSpy = jest.spyOn(axios, "put").mockImplementation(() => {});
  fsExistsSpy = jest.spyOn(fs, "existsSync").mockImplementation(() => false);
  fsMkdirSpy = jest.spyOn(fs, "mkdirSync").mockImplementation(() => {});
  fsWriteSpy = jest.spyOn(fs, "writeFileSync").mockImplementation(() => {});
});

afterEach(() => {
  consoleSpy.mockRestore();
  axiosGetSpy.mockRestore();
  axiosPutSpy.mockRestore();
  fsExistsSpy.mockRestore();
  fsMkdirSpy.mockRestore();
  fsWriteSpy.mockRestore();
});

describe("imds.js", () => {
  const testProxyUrl = "http://example.com/proxy";
  const testToken = "test-imdsv2-token-12345";

  describe("testSSRFVulnerability", () => {
    test("should return true for successful response (200)", async () => {
      axiosGetSpy.mockResolvedValueOnce({
        status: 200,
        data: "ami-id\ninstance-type\n",
      });

      const result = await testSSRFVulnerability(testProxyUrl);

      expect(result).toBe(true);
      expect(axiosGetSpy).toHaveBeenCalledWith(
        expect.stringContaining(testProxyUrl),
        expect.objectContaining({
          timeout: 10000,
          validateStatus: expect.any(Function),
        })
      );
    });

    test("should return true for 401 response (IMDSv2 token required)", async () => {
      axiosGetSpy.mockResolvedValueOnce({
        status: 401,
        data: "Unauthorized",
      });

      const result = await testSSRFVulnerability(testProxyUrl);

      expect(result).toBe(true);
    });

    test("should return false for unexpected status code", async () => {
      axiosGetSpy.mockResolvedValueOnce({
        status: 403,
        data: "Forbidden",
      });

      const result = await testSSRFVulnerability(testProxyUrl);

      expect(result).toBe(false);
    });

    test("should return false and handle ECONNREFUSED error", async () => {
      const error = new Error("Connection refused");
      error.code = "ECONNREFUSED";
      axiosGetSpy.mockRejectedValueOnce(error);

      const result = await testSSRFVulnerability(testProxyUrl);

      expect(result).toBe(false);
    });

    test("should return false and handle ETIMEDOUT error", async () => {
      const error = new Error("Connection timed out");
      error.code = "ETIMEDOUT";
      axiosGetSpy.mockRejectedValueOnce(error);

      const result = await testSSRFVulnerability(testProxyUrl);

      expect(result).toBe(false);
    });

    test("should return false and handle HTTP error response", async () => {
      const error = new Error("Server error");
      error.response = {
        status: 500,
        statusText: "Internal Server Error",
      };
      axiosGetSpy.mockRejectedValueOnce(error);

      const result = await testSSRFVulnerability(testProxyUrl);

      expect(result).toBe(false);
    });
  });

  describe("fetchIMDSv2Token", () => {
    test("should fetch IMDSv2 token successfully", async () => {
      axiosPutSpy.mockResolvedValueOnce({
        data: testToken,
      });

      const token = await fetchIMDSv2Token(testProxyUrl);

      expect(token).toBe(testToken);
      expect(axiosPutSpy).toHaveBeenCalledWith(
        expect.stringContaining(testProxyUrl),
        null,
        expect.objectContaining({
          headers: {
            [CONFIG.imdsv2.headers.tokenTTL]: 21600,
          },
        })
      );
    });

    test("should throw error on failure", async () => {
      const error = new Error("Token fetch failed");
      axiosPutSpy.mockRejectedValueOnce(error);

      await expect(fetchIMDSv2Token(testProxyUrl)).rejects.toThrow(
        "Token fetch failed"
      );
    });
  });

  describe("fetchIAMRole", () => {
    test("should fetch IAM role successfully", async () => {
      const roleData = "test-role";
      axiosGetSpy.mockResolvedValueOnce({
        data: roleData,
      });

      const result = await fetchIAMRole(testProxyUrl, testToken);

      expect(result).toBe(roleData);
      expect(axiosGetSpy).toHaveBeenCalledWith(
        expect.stringContaining(testProxyUrl),
        expect.objectContaining({
          headers: {
            [CONFIG.imdsv2.headers.tokenRequest]: testToken,
          },
        })
      );
    });

    test("should throw error on failure", async () => {
      const error = new Error("Role fetch failed");
      axiosGetSpy.mockRejectedValueOnce(error);

      await expect(fetchIAMRole(testProxyUrl, testToken)).rejects.toThrow(
        "Role fetch failed"
      );
    });
  });

  describe("fetchAllIAMRoles", () => {
    test("should parse multiple roles from string", async () => {
      const rolesString = "role1\nrole2\nrole3\n";
      axiosGetSpy.mockResolvedValueOnce({
        data: rolesString,
      });

      const result = await fetchAllIAMRoles(testProxyUrl, testToken);

      expect(result).toEqual(["role1", "role2", "role3"]);
      expect(axiosGetSpy).toHaveBeenCalledWith(
        expect.stringContaining(testProxyUrl),
        expect.objectContaining({
          headers: {
            [CONFIG.imdsv2.headers.tokenRequest]: testToken,
          },
        })
      );
    });

    test("should handle single role", async () => {
      const singleRole = "single-role";
      axiosGetSpy.mockResolvedValueOnce({
        data: singleRole,
      });

      const result = await fetchAllIAMRoles(testProxyUrl, testToken);

      expect(result).toEqual(["single-role"]);
    });

    test("should filter out empty lines", async () => {
      const rolesString = "role1\n\nrole2\n\n";
      axiosGetSpy.mockResolvedValueOnce({
        data: rolesString,
      });

      const result = await fetchAllIAMRoles(testProxyUrl, testToken);

      expect(result).toEqual(["role1", "role2"]);
    });

    test("should throw error on failure", async () => {
      const error = new Error("Roles fetch failed");
      axiosGetSpy.mockRejectedValueOnce(error);

      await expect(
        fetchAllIAMRoles(testProxyUrl, testToken)
      ).rejects.toThrow("Roles fetch failed");
    });
  });

  describe("fetchCredentials", () => {
    test("should fetch and parse JSON credentials", async () => {
      const credentials = {
        AccessKeyId: "AKIA1234567890",
        SecretAccessKey: "secret123",
        Token: "session-token",
        Expiration: "2024-12-31T23:59:59Z",
      };

      axiosGetSpy.mockResolvedValueOnce({
        data: JSON.stringify(credentials),
      });

      const result = await fetchCredentials(
        testProxyUrl,
        testToken,
        "test-role"
      );

      expect(result).toEqual(credentials);
      expect(axiosGetSpy).toHaveBeenCalledWith(
        expect.stringContaining("test-role"),
        expect.objectContaining({
          headers: {
            [CONFIG.imdsv2.headers.tokenRequest]: testToken,
          },
        })
      );
    });

    test("should handle already parsed JSON credentials", async () => {
      const credentials = {
        AccessKeyId: "AKIA1234567890",
        SecretAccessKey: "secret123",
        Token: "session-token",
      };

      axiosGetSpy.mockResolvedValueOnce({
        data: credentials,
      });

      const result = await fetchCredentials(
        testProxyUrl,
        testToken,
        "test-role"
      );

      expect(result).toEqual(credentials);
    });

    test("should handle invalid JSON gracefully", async () => {
      const invalidJson = "not-valid-json{";

      axiosGetSpy.mockResolvedValueOnce({
        data: invalidJson,
      });

      const result = await fetchCredentials(
        testProxyUrl,
        testToken,
        "test-role"
      );

      expect(result).toBe(invalidJson);
    });

    test("should throw error on failure", async () => {
      const error = new Error("Credentials fetch failed");
      axiosGetSpy.mockRejectedValueOnce(error);

      await expect(
        fetchCredentials(testProxyUrl, testToken, "test-role")
      ).rejects.toThrow("Credentials fetch failed");
    });
  });

  describe("fetchIAMInfo", () => {
    test("should fetch IAM info successfully", async () => {
      const iamInfo = {
        Code: "Success",
        InstanceProfileArn: "arn:aws:iam::123456789012:instance-profile/test",
      };

      axiosGetSpy.mockResolvedValueOnce({
        data: iamInfo,
      });

      const result = await fetchIAMInfo(testProxyUrl, testToken);

      expect(result).toEqual(iamInfo);
      expect(axiosGetSpy).toHaveBeenCalledWith(
        expect.stringContaining(testProxyUrl),
        expect.objectContaining({
          headers: {
            [CONFIG.imdsv2.headers.tokenRequest]: testToken,
          },
        })
      );
    });

    test("should return null on failure", async () => {
      const error = new Error("IAM info fetch failed");
      axiosGetSpy.mockRejectedValueOnce(error);

      const result = await fetchIAMInfo(testProxyUrl, testToken);

      expect(result).toBeNull();
    });
  });

  describe("writeAWSCredentials", () => {
    test("should write credentials and config files", () => {
      const accessKeyId = "AKIA1234567890";
      const secretKey = "secret123";
      const token = "session-token";
      const region = "us-east-1";

      writeAWSCredentials(accessKeyId, secretKey, token, region);

      // Should create directory if it doesn't exist
      expect(fsMkdirSpy).toHaveBeenCalled();

      // Should write credentials file
      expect(fsWriteSpy).toHaveBeenCalledWith(
        expect.stringContaining("credentials"),
        expect.stringContaining(accessKeyId),
        expect.any(Object)
      );

      // Should write config file
      expect(fsWriteSpy).toHaveBeenCalledWith(
        expect.stringContaining("config"),
        expect.stringContaining(region),
        expect.any(Object)
      );

      expect(fsWriteSpy).toHaveBeenCalledTimes(2);
    });

    test("should not create directory if it already exists", () => {
      fsExistsSpy.mockReturnValue(true);

      writeAWSCredentials("AKIA123", "secret", "token", "us-east-1");

      expect(fsMkdirSpy).not.toHaveBeenCalled();
    });

    test("should format credentials correctly", () => {
      const accessKeyId = "AKIA1234567890";
      const secretKey = "secret123";
      const token = "session-token";
      const region = "us-east-1";

      writeAWSCredentials(accessKeyId, secretKey, token, region);

      const credentialsCall = fsWriteSpy.mock.calls.find((call) =>
        call[0].includes("credentials")
      );

      expect(credentialsCall[1]).toContain("[default]");
      expect(credentialsCall[1]).toContain(
        `aws_access_key_id = ${accessKeyId}`
      );
      expect(credentialsCall[1]).toContain(
        `aws_secret_access_key = ${secretKey}`
      );
      expect(credentialsCall[1]).toContain(`aws_session_token = ${token}`);
    });

    test("should format config correctly", () => {
      const region = "eu-west-1";

      writeAWSCredentials("AKIA123", "secret", "token", region);

      const configCall = fsWriteSpy.mock.calls.find((call) =>
        call[0].includes("config")
      );

      expect(configCall[1]).toContain("[default]");
      expect(configCall[1]).toContain(`region = ${region}`);
      expect(configCall[1]).toContain("output = json");
    });
  });
});
