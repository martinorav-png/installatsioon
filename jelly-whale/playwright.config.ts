import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  reporter: 'list',
  timeout: 30000,
  use: {
    baseURL: 'http://127.0.0.1:5173',
    launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined },
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 900 } } },
    { name: 'mobile', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' } },
  ],
  webServer: [
    { command: 'npm run dev', url: 'http://127.0.0.1:5173', reuseExistingServer: true },
    { command: 'npm run build && npm run preview -- --port 4173', url: 'http://127.0.0.1:4173', reuseExistingServer: true },
  ],
});
