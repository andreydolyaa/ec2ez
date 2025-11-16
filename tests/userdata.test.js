import {
  jest,
  describe,
  test,
  beforeEach,
  afterEach,
  expect,
} from "@jest/globals";
import axios from "axios";
import {
  fetchUserData,
  decodeUserData,
  scanForSecrets,
  parseCloudInit,
} from "../src/userdata.js";
import { CONFIG } from "../src/config.js";

// Suppress console output during tests
let consoleSpy;
let axiosGetSpy;

beforeEach(() => {
  consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {});
  axiosGetSpy = jest.spyOn(axios, "get").mockImplementation(() => {});
});

afterEach(() => {
  consoleSpy.mockRestore();
  axiosGetSpy.mockRestore();
});

describe("userdata.js", () => {
  const testProxyUrl = "http://example.com/proxy";
  const testToken = "test-token-123";

  describe("fetchUserData", () => {
    test("should fetch user data successfully", async () => {
      const userData = "#!/bin/bash\necho 'Hello World'";
      axiosGetSpy.mockResolvedValueOnce({
        data: userData,
      });

      const result = await fetchUserData(testProxyUrl, testToken);

      expect(result).toBe(userData);
      expect(axiosGetSpy).toHaveBeenCalledWith(
        expect.stringContaining(testProxyUrl),
        expect.objectContaining({
          headers: {
            [CONFIG.imdsv2.headers.tokenRequest]: testToken,
          },
        })
      );
    });

    test("should return null when no user data is available", async () => {
      axiosGetSpy.mockResolvedValueOnce({
        data: null,
      });

      const result = await fetchUserData(testProxyUrl, testToken);

      expect(result).toBeNull();
    });

    test("should handle 404 error gracefully", async () => {
      const error = new Error("Not Found");
      error.response = { status: 404 };
      axiosGetSpy.mockRejectedValueOnce(error);

      const result = await fetchUserData(testProxyUrl, testToken);

      expect(result).toBeNull();
    });

    test("should return null on general error", async () => {
      axiosGetSpy.mockRejectedValueOnce(new Error("Network error"));

      const result = await fetchUserData(testProxyUrl, testToken);

      expect(result).toBeNull();
    });
  });

  describe("decodeUserData", () => {
    test("should decode base64-encoded data", () => {
      const plainText = "#!/bin/bash\necho 'test'";
      const encoded = Buffer.from(plainText).toString("base64");

      const result = decodeUserData(encoded);

      expect(result).toBe(plainText);
    });

    test("should return data unchanged if not base64", () => {
      const data = "#!/bin/bash\necho 'test'";

      const result = decodeUserData(data);

      expect(result).toBe(data);
    });

    test("should return null if input is null", () => {
      const result = decodeUserData(null);

      expect(result).toBeNull();
    });

    test("should handle non-string input", () => {
      const data = { key: "value" };

      const result = decodeUserData(data);

      expect(result).toEqual(data);
    });
  });

  describe("scanForSecrets", () => {
    test("should detect AWS access keys", () => {
      const userData = "AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE";

      const secrets = scanForSecrets(userData);

      expect(secrets.length).toBeGreaterThan(0);
      const awsKey = secrets.find((s) => s.type === "AWS Access Key");
      expect(awsKey).toBeDefined();
      expect(awsKey.severity).toBe("CRITICAL");
    });

    test("should detect AWS secret keys", () => {
      const userData =
        "aws_secret_access_key=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY";

      const secrets = scanForSecrets(userData);

      const secretKey = secrets.find((s) => s.type === "AWS Secret Access Key");
      expect(secretKey).toBeDefined();
      expect(secretKey.severity).toBe("CRITICAL");
    });

    test("should detect private keys", () => {
      const userData = `-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEA1234567890
-----END RSA PRIVATE KEY-----`;

      const secrets = scanForSecrets(userData);

      const privateKey = secrets.find((s) => s.type === "Private Key");
      expect(privateKey).toBeDefined();
      expect(privateKey.severity).toBe("CRITICAL");
    });

    test("should detect passwords", () => {
      const userData = "password=mysecretpassword123";

      const secrets = scanForSecrets(userData);

      const password = secrets.find((s) => s.type === "Password");
      expect(password).toBeDefined();
    });

    test("should detect database URLs", () => {
      const userData = "postgres://user:pass@localhost:5432/database";

      const secrets = scanForSecrets(userData);

      const dbUrl = secrets.find((s) => s.type === "Database URL");
      expect(dbUrl).toBeDefined();
      expect(dbUrl.severity).toBe("HIGH");
    });

    test("should detect URLs with credentials", () => {
      const userData = "http://admin:password123@example.com/api";

      const secrets = scanForSecrets(userData);

      const urlCreds = secrets.find((s) => s.type === "URL with Credentials");
      expect(urlCreds).toBeDefined();
    });

    test("should detect JWT tokens", () => {
      const userData =
        "token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U";

      const secrets = scanForSecrets(userData);

      const jwt = secrets.find((s) => s.type === "JWT Token");
      expect(jwt).toBeDefined();
    });

    test("should detect GitHub tokens", () => {
      const userData = "GITHUB_TOKEN=ghp_1234567890abcdefghijklmnopqrstuv1234";

      const secrets = scanForSecrets(userData);

      const githubToken = secrets.find(
        (s) => s.type === "GitHub Personal Access Token"
      );
      expect(githubToken).toBeDefined();
    });

    test("should return empty array for data without secrets", () => {
      const userData = "#!/bin/bash\necho 'Hello World'\napt-get update";

      const secrets = scanForSecrets(userData);

      expect(secrets).toEqual([]);
    });

    test("should deduplicate identical secrets", () => {
      const userData = `
        password=test123
        password=test123
        password=test123
      `;

      const secrets = scanForSecrets(userData);

      // Should find only unique occurrences
      const passwordSecrets = secrets.filter((s) => s.value.includes("test123"));
      expect(passwordSecrets.length).toBe(1);
    });
  });

  describe("parseCloudInit", () => {
    test("should detect cloud-config format", () => {
      const userData = `#cloud-config
packages:
  - nginx
  - git
runcmd:
  - systemctl start nginx
`;

      const result = parseCloudInit(userData);

      expect(result.isCloudInit).toBe(true);
      expect(result.format).toBe("cloud-config");
      expect(result.packages).toContain("nginx");
      expect(result.packages).toContain("git");
      expect(result.runcmd).toContain("systemctl start nginx");
    });

    test("should detect shell script format", () => {
      const userData = `#!/bin/bash
apt-get update
apt-get install -y nginx
`;

      const result = parseCloudInit(userData);

      expect(result.isCloudInit).toBe(true);
      expect(result.format).toBe("shell-script");
    });

    test("should extract environment variables", () => {
      const userData = `#!/bin/bash
export DATABASE_URL=postgres://localhost/db
export API_KEY=123456
echo "Setup complete"
`;

      const result = parseCloudInit(userData);

      expect(result.environmentVars.DATABASE_URL).toBe(
        "postgres://localhost/db"
      );
      expect(result.environmentVars.API_KEY).toBe("123456");
    });

    test("should parse packages list", () => {
      const userData = `#cloud-config
packages:
  - docker
  - nginx
  - postgresql
`;

      const result = parseCloudInit(userData);

      expect(result.packages).toHaveLength(3);
      expect(result.packages).toContain("docker");
      expect(result.packages).toContain("nginx");
      expect(result.packages).toContain("postgresql");
    });

    test("should parse runcmd list", () => {
      const userData = `#cloud-config
runcmd:
  - systemctl start docker
  - docker pull nginx:latest
  - echo "Done"
`;

      const result = parseCloudInit(userData);

      expect(result.runcmd).toHaveLength(3);
      expect(result.runcmd[0]).toBe("systemctl start docker");
    });

    test("should return null for null input", () => {
      const result = parseCloudInit(null);

      expect(result).toBeNull();
    });

    test("should handle non-cloud-init data", () => {
      const userData = "Just some regular text";

      const result = parseCloudInit(userData);

      expect(result.isCloudInit).toBe(false);
      expect(result.format).toBeNull();
    });
  });
});
