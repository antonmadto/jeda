import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  // Test transaksi berbagi satu database sungguhan — wajib berurutan, jangan paralel.
  workers: 1,
  use: {
    baseURL: 'http://localhost:5173',
  },
  projects: [
    { name: 'iphone', use: { ...devices['iPhone 14'] } },
    { name: 'android', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
  },
})
