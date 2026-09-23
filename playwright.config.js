import { defineConfig, devices } from '@playwright/test';
import process from 'node:process';

const requestedPort = Number.parseInt(process.env.PLAYWRIGHT_PORT || '', 10);
const port = Number.isInteger(requestedPort) && requestedPort >= 1024 && requestedPort <= 65535
  ? requestedPort
  : 41737;
const baseURL = `http://127.0.0.1:${port}/screenshot-library/`;

export default defineConfig({
  testDir: './e2e',
  outputDir: 'output/playwright/test-results',
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: 'list',
  use: {
    baseURL,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npm run dev -- --host 127.0.0.1 --port ${port} --strictPort`,
    env: { VITE_CONTENT_API_URL: `http://127.0.0.1:${port}/__test_api__` },
    url: baseURL,
    reuseExistingServer: false,
  },
});
