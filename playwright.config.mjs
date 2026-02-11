import { defineConfig, devices } from '@playwright/test';

const defaultProjects = [
  {
    name: 'chromium',
    use: {
      ...devices['Desktop Chrome']
    }
  }
];

const matrixProjects = [
  {
    name: 'chromium',
    use: {
      ...devices['Desktop Chrome']
    }
  },
  {
    name: 'firefox',
    use: {
      ...devices['Desktop Firefox']
    }
  },
  {
    name: 'webkit',
    use: {
      ...devices['Desktop Safari']
    }
  },
  {
    name: 'mobile-chromium',
    use: {
      ...devices['Pixel 7']
    }
  }
];

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,
  forbidOnly: !!process.env.CI,
  expect: {
    timeout: 10000
  },
  fullyParallel: true,
  workers: process.env.CI ? 1 : undefined,
  retries: process.env.CI ? 2 : 0,
  reporter: [['list']],
  projects: process.env.PW_MATRIX === '1' ? matrixProjects : defaultProjects,
  use: {
    baseURL: 'http://127.0.0.1:4273',
    trace: 'on-first-retry'
  },
  webServer: {
    command: 'npm run serve:test',
    url: 'http://127.0.0.1:4273',
    reuseExistingServer: false,
    timeout: 120000
  }
});
