import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e", fullyParallel: false, workers: 1,
  outputDir: "output/playwright/results", reporter: "list",
  use: { baseURL: "http://127.0.0.1:3100", browserName: "chromium", launchOptions: { executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium" }, trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { viewport: { width: 1440, height: 900 } } },
    { name: "mobile", use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  ],
  webServer: { command: "npm run start -- --port 3100", url: "http://127.0.0.1:3100", reuseExistingServer: false, timeout: 60000 },
});
