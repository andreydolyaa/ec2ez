import { COLORS } from "./config.js";

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function log(message, data = null, color = null) {
  const timestamp = new Date().toISOString();
  const colorCode = color ? COLORS[color] : "";
  const reset = color ? COLORS.reset : "";
  console.log(
    `${COLORS.dim}[${timestamp}]${COLORS.reset} ${colorCode}${message}${reset}`
  );
  if (data) {
    console.log(data);
  }
}

export function logSuccess(message) {
  log(message, null, "green");
}

export function logError(message) {
  log(message, null, "red");
}

export function logWarning(message) {
  log(message, null, "yellow");
}

export function logInfo(message) {
  log(message, null, "cyan");
}

export function logDanger(message) {
  log(message, null, "magenta");
}

export function logSeparator() {
  console.log("-".repeat(80));
}

export function displayBanner() {
  const banner = `
${COLORS.red}
    ███████╗ ██████╗██████╗     ███████╗███████╗
    ██╔════╝██╔════╝╚════██╗    ██╔════╝╚══███╔╝
    █████╗  ██║      █████╔╝    █████╗    ███╔╝
    ██╔══╝  ██║     ██╔═══╝     ██╔══╝   ███╔╝
    ███████╗╚██████╗███████╗    ███████╗███████╗
    ╚══════╝ ╚═════╝╚══════╝    ╚══════╝╚══════╝
${COLORS.reset}
${COLORS.cyan}    ═══════════════════════════════════════════════════════════════════════${COLORS.reset}
${COLORS.yellow}                    AWS IMDSv2 Exploitation Tool${COLORS.reset}
${COLORS.dim}              Automated credential extraction and privilege analysis${COLORS.reset}
${COLORS.cyan}    ═══════════════════════════════════════════════════════════════════════${COLORS.reset}

${COLORS.magenta}    [+]${COLORS.reset} Extract IMDSv2 tokens through SSRF vulnerabilities
${COLORS.magenta}    [+]${COLORS.reset} Enumerate IAM role permissions and dangerous access
${COLORS.magenta}    [+]${COLORS.reset} Automatically test credentials with EC2 instance creation
${COLORS.magenta}    [+]${COLORS.reset} Detect privilege escalation vectors (PassRole, etc.)

${COLORS.cyan}    ═══════════════════════════════════════════════════════════════════════${COLORS.reset}
${COLORS.dim}                                v1.0.0 | @ec2ez${COLORS.reset}
${COLORS.dim}     THIS TOOL IS INTENDED FOR EDUCATIONAL AND DEMONSTRATION PURPOSES ONLY${COLORS.reset}
${COLORS.cyan}    ═══════════════════════════════════════════════════════════════════════${COLORS.reset}
`;
  console.log(banner);
}

export function extractSSRFParam(url) {
  try {
    const urlObj = new URL(url);
    const params = urlObj.searchParams;

    // If URL already has a query parameter, extract the first one
    if (params.keys().next().value) {
      const paramName = params.keys().next().value;
      logInfo(`Auto-detected SSRF parameter: ${paramName}`);
      return paramName;
    }

    // Otherwise, default to 'url'
    logInfo("No query parameter found in URL, defaulting to 'url'");
    return "url";
  } catch (error) {
    // If URL parsing fails, default to 'url'
    logWarning("Could not parse URL, defaulting to 'url' parameter");
    return "url";
  }
}
