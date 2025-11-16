import { jest, describe, test, beforeEach, afterEach, expect } from "@jest/globals";
import {
  sleep,
  log,
  logSuccess,
  logError,
  logWarning,
  logInfo,
  logDanger,
  logSeparator,
  displayBanner,
  extractSSRFParam,
} from "../src/utils.js";
import { COLORS } from "../src/config.js";

// Mock console methods
let consoleSpy;

beforeEach(() => {
  consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  consoleSpy.mockRestore();
});

describe("utils.js", () => {
  describe("sleep", () => {
    test("should delay execution for specified milliseconds", async () => {
      const start = Date.now();
      await sleep(100);
      const end = Date.now();
      const elapsed = end - start;
      // Allow for some timing variance
      expect(elapsed).toBeGreaterThanOrEqual(90);
      expect(elapsed).toBeLessThan(200);
    });
  });

  describe("log", () => {
    test("should log message with timestamp", () => {
      log("test message");
      expect(consoleSpy).toHaveBeenCalledTimes(1);
      const call = consoleSpy.mock.calls[0][0];
      expect(call).toContain("test message");
      expect(call).toMatch(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/); // ISO timestamp
    });

    test("should log message with color", () => {
      log("test message", null, "red");
      expect(consoleSpy).toHaveBeenCalledTimes(1);
      const call = consoleSpy.mock.calls[0][0];
      expect(call).toContain(COLORS.red);
      expect(call).toContain(COLORS.reset);
      expect(call).toContain("test message");
    });

    test("should log message with data", () => {
      const data = { key: "value" };
      log("test message", data);
      expect(consoleSpy).toHaveBeenCalledTimes(2);
      expect(consoleSpy.mock.calls[0][0]).toContain("test message");
      expect(consoleSpy.mock.calls[1][0]).toEqual(data);
    });
  });

  describe("logSuccess", () => {
    test("should log green success message", () => {
      logSuccess("operation successful");
      expect(consoleSpy).toHaveBeenCalledTimes(1);
      const call = consoleSpy.mock.calls[0][0];
      expect(call).toContain(COLORS.green);
      expect(call).toContain("operation successful");
    });
  });

  describe("logError", () => {
    test("should log red error message", () => {
      logError("operation failed");
      expect(consoleSpy).toHaveBeenCalledTimes(1);
      const call = consoleSpy.mock.calls[0][0];
      expect(call).toContain(COLORS.red);
      expect(call).toContain("operation failed");
    });
  });

  describe("logWarning", () => {
    test("should log yellow warning message", () => {
      logWarning("this is a warning");
      expect(consoleSpy).toHaveBeenCalledTimes(1);
      const call = consoleSpy.mock.calls[0][0];
      expect(call).toContain(COLORS.yellow);
      expect(call).toContain("this is a warning");
    });
  });

  describe("logInfo", () => {
    test("should log cyan info message", () => {
      logInfo("informational message");
      expect(consoleSpy).toHaveBeenCalledTimes(1);
      const call = consoleSpy.mock.calls[0][0];
      expect(call).toContain(COLORS.cyan);
      expect(call).toContain("informational message");
    });
  });

  describe("logDanger", () => {
    test("should log magenta danger message", () => {
      logDanger("dangerous permission");
      expect(consoleSpy).toHaveBeenCalledTimes(1);
      const call = consoleSpy.mock.calls[0][0];
      expect(call).toContain(COLORS.magenta);
      expect(call).toContain("dangerous permission");
    });
  });

  describe("logSeparator", () => {
    test("should log 80 dashes", () => {
      logSeparator();
      expect(consoleSpy).toHaveBeenCalledTimes(1);
      expect(consoleSpy.mock.calls[0][0]).toBe("-".repeat(80));
    });
  });

  describe("displayBanner", () => {
    test("should display ASCII art banner", () => {
      displayBanner();
      expect(consoleSpy).toHaveBeenCalledTimes(1);
      const banner = consoleSpy.mock.calls[0][0];
      expect(banner).toContain("███████╗ ██████╗██████╗");
      expect(banner).toContain("AWS IMDSv2 Exploitation Tool");
      expect(banner).toContain("v1.0.0");
      expect(banner).toContain("EDUCATIONAL AND DEMONSTRATION PURPOSES ONLY");
    });
  });

  describe("extractSSRFParam", () => {
    test("should extract parameter from URL with query string", () => {
      const url = "http://example.com/proxy?target=test";
      const param = extractSSRFParam(url);
      expect(param).toBe("target");
      expect(consoleSpy).toHaveBeenCalled();
      const call = consoleSpy.mock.calls.find((c) =>
        c[0].includes("Auto-detected SSRF parameter")
      );
      expect(call).toBeDefined();
    });

    test("should return default 'url' for URL without query string", () => {
      const url = "http://example.com/proxy";
      const param = extractSSRFParam(url);
      expect(param).toBe("url");
      expect(consoleSpy).toHaveBeenCalled();
      const call = consoleSpy.mock.calls.find((c) =>
        c[0].includes("No query parameter found")
      );
      expect(call).toBeDefined();
    });

    test("should return default 'url' for invalid URL", () => {
      const url = "not-a-valid-url";
      const param = extractSSRFParam(url);
      expect(param).toBe("url");
      expect(consoleSpy).toHaveBeenCalled();
      const call = consoleSpy.mock.calls.find((c) =>
        c[0].includes("Could not parse URL")
      );
      expect(call).toBeDefined();
    });

    test("should extract first parameter when multiple exist", () => {
      const url = "http://example.com/proxy?url=test&other=value";
      const param = extractSSRFParam(url);
      expect(param).toBe("url");
    });
  });
});
