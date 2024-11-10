import { launch } from "chrome-launcher";
import puppeteer from "puppeteer";
import lighthouse from "lighthouse";
import fetch from "node-fetch";
import fs from "fs";
import path from "path";

// Configuration
const args = process.argv.slice(2); // Get command line arguments
const appType = args[0] || "vue"; // Default to "vue" if not provided
const deviceType = args[1] || "desktop"; // Default to "desktop" if not provided
const accessToken = args[2] || ""; // Default to empty string if not provided

const url = `https://thesis-${appType}.webtic.app`;
//const url = "http://localhost:4173";

const userJSON = {
  email: "john_pm1@example.com",
  name: "John PM1",
  role: "PM",
  _id: "66ec4b0716881f7064cddc24",
};
const user = JSON.stringify(userJSON);
const iterations = 30; // Number of Lighthouse cycles to run

// Determine results directory based on accessToken
const resultsDir =
  accessToken === ""
    ? `./results/${appType}_${deviceType}/login`
    : `./results/${appType}_${deviceType}/dashboard`;

if (!fs.existsSync(resultsDir)) {
  fs.mkdirSync(resultsDir, { recursive: true });
}

const outputExcel = `${resultsDir}/lighthouse_results_${appType}_${deviceType}.xlsx`;

// Lighthouse with authentication
async function runLighthouseWithAuth(iteration) {
  // Step 1: Launch Chrome using chrome-launcher with a fixed port
  const chrome = await launch({
    chromeFlags: ["--headless", "--remote-debugging-port=9222"],
    port: 9222,
  });

  // Step 2: Connect Puppeteer to the existing Chrome instance
  const response = await fetch(`http://localhost:${chrome.port}/json/version`);
  const { webSocketDebuggerUrl } = await response.json();
  const browser = await puppeteer.connect({
    browserWSEndpoint: webSocketDebuggerUrl,
  });
  const page = await browser.newPage();

  // Step 3: Navigate to the app's base URL and set the access token and user string in localStorage
  await page.goto(url);
  await page.evaluate(
    (token, userData) => {
      localStorage.setItem("access_token", token);
      localStorage.setItem("user", userData);
    },
    accessToken,
    user
  );

  // Step 4: Reload the page to apply the authenticated session
  await page.reload();
  console.log("Page reloaded with authentication");

  // Wait to make sure the auth state is applied
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // Step 5: Define Lighthouse options based on the device type
  const options = {
    port: 9222,
    output: "json",
    logLevel: "info",
    onlyCategories: ["performance"],
    throttlingMethod: "provided",
    formFactor: deviceType,
    screenEmulation:
      deviceType === "mobile"
        ? {
            mobile: true,
            width: 375,
            height: 667,
            deviceScaleFactor: 2,
            disabled: false,
          }
        : {
            mobile: false,
            width: 1350,
            height: 940,
            deviceScaleFactor: 1,
            disabled: false,
          },
  };

  // Step 6: Run Lighthouse on the authenticated page
  const result = await lighthouse(url, options);

  const lighthouseReportsDir = path.join(resultsDir, "lighthouse_reports");

  if (!fs.existsSync(lighthouseReportsDir)) {
    fs.mkdirSync(lighthouseReportsDir, { recursive: true });
  }

  // Step 7: Save the Lighthouse report with appType and deviceType in the filename
  const outputFile = path.join(
    lighthouseReportsDir,
    `lighthouse_report_${appType}_${deviceType}_iteration_${iteration}.json`
  );
  fs.writeFileSync(outputFile, JSON.stringify(result.lhr, null, 2));
  console.log(`Lighthouse report saved to ${outputFile}`);

  // Step 8: Disconnect Puppeteer and close Chrome
  await browser.disconnect();
  await chrome.kill();

  // Result
  return {
    performance: result.lhr.categories.performance.score,
    metrics: {
      speedIndex: result.lhr.audits["speed-index"].numericValue,
      firstContentfulPaint:
        result.lhr.audits["first-contentful-paint"].numericValue,
      largestContentfulPaint:
        result.lhr.audits["largest-contentful-paint"].numericValue,
      timeToInteractive: result.lhr.audits["interactive"].numericValue,
      totalBlockingTime: result.lhr.audits["total-blocking-time"].numericValue,
      cumulativeLayoutShift:
        result.lhr.audits["cumulative-layout-shift"].numericValue,
    },
  };
}

// Run the Lighthouse process multiple times
async function runMultipleIterations() {
  const results = [];
  const allScores = []; // To store scores and metrics for Excel

  for (let i = 0; i < iterations; i++) {
    console.log(`Running Lighthouse iteration ${i + 1} with authentication...`);
    const metrics = await runLighthouseWithAuth(i);
    results.push(metrics);
    allScores.push(metrics);
    console.log(`Iteration ${i + 1} metrics:`, metrics);
  }
}

// Run
runMultipleIterations().catch(console.error);
