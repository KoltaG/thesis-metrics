import { launch } from "chrome-launcher";
import puppeteer from "puppeteer";
import lighthouse from "lighthouse";
import fetch from "node-fetch";
import fs from "fs";
import path from "path";

// Configuration
const appType = "react"; // Set the app type to "react" or "vue"

const url = `https://thesis-${appType}.webtic.app`;
const accessToken =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2NmVjNGIwNzE2ODgxZjcwNjRjZGRjMjQiLCJyb2xlIjoiUE0iLCJpYXQiOjE3MzA0OTI5NTksImV4cCI6MTczMDQ5NjU1OX0.cfUX3nV0QvHxBcFf6jLAI0RtuN2H4dtigxQF3488GQo";
const userJSON = {
  email: "john_pm1@example.com",
  name: "John PM1",
  role: "PM",
  _id: "66ec4b0716881f7064cddc24",
};
const user = JSON.stringify(userJSON);
const resultsDir = `./results/${appType}/`;
const iterations = 3; // Number of Lighthouse iterations

// Make sure the results directory exists
if (!fs.existsSync(resultsDir)) {
  fs.mkdirSync(resultsDir, { recursive: true });
}

// Lighthouse with authentication
async function runLighthouseWithAuth(iteration) {
  // Step 1: Launch Chrome using chrome-launcher with a fixed port
  const chrome = await launch({
    chromeFlags: ["--remote-debugging-port=9222"],
    port: 9222,
  });

  // Step 2: Connect Puppeteer to the existing Chrome instance
  const response = await fetch(`http://localhost:${chrome.port}/json/version`);
  const { webSocketDebuggerUrl } = await response.json();
  const browser = await puppeteer.connect({
    browserWSEndpoint: webSocketDebuggerUrl,
  });
  const page = await browser.newPage();

  // Step 3: Navigate to the app's base URL and set the access token and the userstring in localStorage
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

  // Step 5: Run Lighthouse on the authenticated page
  const result = await lighthouse(url, {
    port: 9222,
    output: "json",
    logLevel: "info",
  });

  // Step 6: Save the Lighthouse report
  const outputFile = path.join(
    resultsDir,
    `lighthouse_report_dashboard_${iteration}.json`
  );
  fs.writeFileSync(outputFile, JSON.stringify(result.lhr, null, 2));
  console.log(`Lighthouse report saved to ${outputFile}`);

  // Step 7: Disconnect Puppeteer and close Chrome
  await browser.disconnect();
  await chrome.kill();

  // Return the Lighthouse scores for logging
  return {
    performance: result.lhr.categories.performance.score,
    accessibility: result.lhr.categories.accessibility.score,
    bestPractices: result.lhr.categories["best-practices"].score,
    seo: result.lhr.categories.seo.score,
    pwa: result.lhr.categories.pwa ? result.lhr.categories.pwa.score : null,
  };
}

// Run the Lighthouse process multiple times
async function runMultipleIterations() {
  const results = [];

  for (let i = 0; i < iterations; i++) {
    console.log(`Running Lighthouse iteration ${i + 1} with authentication...`);
    const metrics = await runLighthouseWithAuth(i);
    results.push(metrics);
    console.log(`Iteration ${i + 1} metrics:`, metrics);
  }

  // Save the summary of all results
  fs.writeFileSync(
    path.join(resultsDir, "average_metrics.json"),
    JSON.stringify(results, null, 2)
  );
  console.log("All iteration metrics saved to average_metrics.json");
}

// Run
runMultipleIterations().catch(console.error);
