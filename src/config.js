import os from "os";
import path from "path";

function generateFunnyInstanceName() {
  const adjectives = [
    "Sneaky",
    "Stealthy",
    "Invisible",
    "Shadow",
    "Phantom",
    "Ghost",
    "Covert",
    "Rogue",
    "Ninja",
    "Silent",
  ];
  const nouns = [
    "Pineapple",
    "Potato",
    "Banana",
    "Cucumber",
    "Toaster",
    "Penguin",
    "Narwhal",
    "Llama",
    "Capybara",
    "Platypus",
  ];
  const numbers = Math.floor(Math.random() * 9000) + 1000;

  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];

  return `${adj}${noun}${numbers}`;
}

export const CONFIG = {
  ssrf: {
    paramName: "url",
  },
  imdsv2: {
    baseUrl: "http://169.254.169.254",
    endpoints: {
      token: "/latest/api/token",
      iamMetadata: "/latest/meta-data/iam/security-credentials",
    },
    headers: {
      tokenTTL: "x-aws-ec2-metadata-token-ttl-seconds",
      tokenRequest: "x-aws-ec2-metadata-token",
    },
  },
  aws: {
    defaultRegion: "il-central-1",
    credentialsPath: path.join(os.homedir(), ".aws", "credentials"),
  },
  ec2: {
    ami: "ami-006183c868a62af95",
    instanceType: "t3.micro",
    instanceCount: 1,
    instanceName: generateFunnyInstanceName(),
  },
};

export const COLORS = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
};
