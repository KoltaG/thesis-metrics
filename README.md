# Thesis Metrics

This repository consists of two main components:

1. **Lighthouse Performance Testing** - Run automated Lighthouse tests with Puppeteer and Chrome for various app configurations.
2. **Jupyter Notebook Analysis** - Analyze the collected performance data with a Jupyter Notebook.

## Prerequisites

- **Node.js** (version 20+)
- **Yarn** (for managing Node.js dependencies)
- **Python 3.9+** (for Jupyter Notebook)

---

## 1. Lighthouse Performance Testing

This part of the project uses Node.js and Yarn to run Lighthouse performance tests with Puppeteer. The results are saved in JSON format and can be analyzed further.

### Setup

1. Navigate to the `lighthouse` directory:

   ```bash
   cd lighthouse
   ```

2. Install dependencies using Yarn:
   ```bash
   yarn install
   ```

### Running the Tests

To run the Lighthouse tests, use the following command:

```bash
node run_lighthouse.js <appType> <deviceType> <accessToken>
```

- `<appType>`: The type of application, such as `vue`.
- `<deviceType>`: The device type, such as `desktop` or `mobile`.
- `<accessToken>`: An access token for authentication (optional).

#### Example

```bash
node run_lighthouse.js vue desktop eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2NmVjNGIwNzE2ODgxZjcwNjRjZGRjMjQiLCJyb2xlIjoiUE0iLCJpYXQiOjE3MzExNjkxNjksImV4cCI6MTczMTE3Mjc2OX0.z497Nj0xljY7s8YnxBBmVZEPneKniaaJNXr6v2QPymg
```

This will run Lighthouse tests for the `vue` app on `desktop` with the provided access token. Results are saved to `./results/<appType>_<deviceType>/`.

### Test Script Overview

The `run_lighthouse.js` script performs the following steps:

- Launches Chrome in headless mode.
- Uses Puppeteer to authenticate by setting tokens in `localStorage`.
- Runs Lighthouse performance tests multiple times (specified by the `iterations` variable).
- Saves each iteration's results to a JSON file.

---

## 2. Jupyter Notebook Analysis

The `lighthouse-evaluation` directory contains a Jupyter Notebook for analyzing the collected Lighthouse performance data.

### Setup

1. **Create a Virtual Environment**:
   Navigate to the `lighthouse-evaluate` directory and create a virtual environment.

   ```bash
   cd lighthouse-evaluate
   python3 -m venv .venv
   ```

2. **Activate the Virtual Environment**:

   - **On macOS/Linux**:
     ```bash
     source .venv/bin/activate
     ```
   - **On Windows**:
     ```bash
     .venv\Scripts\activate
     ```

3. **Install the Required Packages**:
   Install the necessary Python packages from `requirements.txt`:

   ```bash
   pip install -r requirements.txt
   ```

### Running the Notebook

1. **Launch Jupyter Notebook**:

   ```bash
   jupyter notebook
   ```

2. Open the `lighthouse-evaluation.ipynb` notebook file.

3. Follow the cells in the notebook to analyze the performance data collected from the Lighthouse tests.
