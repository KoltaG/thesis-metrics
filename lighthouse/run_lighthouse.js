import { launch } from "chrome-launcher";
import puppeteer from "puppeteer";
import lighthouse from "lighthouse";
import fetch from "node-fetch";
import fs from "fs";
import path from "path";
import * as xlsx from "xlsx";

// Configuration
const args = process.argv.slice(2); // Get command line arguments
const appType = args[0] || "vue"; // Default to "vue" if not provided
const deviceType = args[1] || "desktop"; // Default to "desktop" if not provided

const url = `https://thesis-${appType}.webtic.app`;
//const url = "http://localhost:4173";
const accessToken = "";
const userJSON = {
  email: "john_pm1@example.com",
  name: "John PM1",
  role: "PM",
  _id: "66ec4b0716881f7064cddc24",
};
const user = JSON.stringify(userJSON);
const iterations = 15; // Number of Lighthouse cycles to run

// Determine results directory based on accessToken
const resultsDir =
  accessToken === ""
    ? `./results/${appType}_${deviceType}/login`
    : `./results/${appType}_${deviceType}/dashboard`;

// Ensure the results directory exists
if (!fs.existsSync(resultsDir)) {
  fs.mkdirSync(resultsDir, { recursive: true });
}

const outputExcel = `./results/${appType}_${deviceType}/lighthouse_results_${appType}_${deviceType}.xlsx`;

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
    accessibility: result.lhr.categories.accessibility.score,
    bestPractices: result.lhr.categories["best-practices"].score,
    seo: result.lhr.categories.seo.score,
    pwa: result.lhr.categories.pwa ? result.lhr.categories.pwa.score : null,
    metrics: {
      firstContentfulPaint:
        result.lhr.audits["first-contentful-paint"].displayValue,
      largestContentfulPaint:
        result.lhr.audits["largest-contentful-paint"].displayValue,
      timeToInteractive: result.lhr.audits["interactive"].displayValue,
      totalBlockingTime: result.lhr.audits["total-blocking-time"].displayValue,
      cumulativeLayoutShift:
        result.lhr.audits["cumulative-layout-shift"].displayValue,
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

  // Write scores and metrics to Excel
  const workbook = xlsx.utils.book_new();

  // Add each iteration's scores and metrics to a separate sheet
  allScores.forEach((metrics, index) => {
    const sheetData = [["Metric", "Score"]];
    // Include both scores and metrics in the Excel sheet
    for (const [metric, score] of Object.entries(metrics)) {
      if (metric === "metrics") {
        for (const [subMetric, value] of Object.entries(metrics[metric])) {
          sheetData.push([subMetric, value]);
        }
      } else {
        sheetData.push([metric, score]);
      }
    }
    const worksheet = xlsx.utils.aoa_to_sheet(sheetData);
    xlsx.utils.book_append_sheet(workbook, worksheet, `Iteration_${index + 1}`);
  });

  // Calculate and save average scores and metrics
  const avgScores = {};
  const avgMetrics = {};

  for (const metric in allScores[0]) {
    if (metric !== "metrics") {
      avgScores[metric] = (
        allScores.reduce(
          (sum, iteration) => sum + (iteration[metric] || 0),
          0
        ) / iterations
      ).toFixed(2);
    } else {
      // Calculate averages for each metric in "metrics"
      for (const subMetric in allScores[0].metrics) {
        avgMetrics[subMetric] = (
          allScores.reduce(
            (sum, iteration) =>
              sum + parseFloat(iteration.metrics[subMetric] || 0),
            0
          ) / iterations
        ).toFixed(2);
      }
    }
  }

  // Add average scores and metrics to a summary sheet
  const avgSheetData = [["Metric", "Average Score"]];
  for (const [metric, avgScore] of Object.entries(avgScores)) {
    avgSheetData.push([metric, avgScore]);
  }
  for (const [subMetric, avgValue] of Object.entries(avgMetrics)) {
    avgSheetData.push([subMetric, avgValue]);
  }
  const avgWorksheet = xlsx.utils.aoa_to_sheet(avgSheetData);
  xlsx.utils.book_append_sheet(workbook, avgWorksheet, "Averages");

  // Save the workbook
  xlsx.writeFile(workbook, outputExcel);
  console.log(`Excel file saved at ${outputExcel}`);

  // Save the JSON summary of all results
  fs.writeFileSync(
    path.join(resultsDir, "results.json"),
    JSON.stringify(results, null, 2)
  );
  console.log("All iteration metrics saved to results.json");
}

// Run
runMultipleIterations().catch(console.error);
