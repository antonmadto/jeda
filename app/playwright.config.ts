import { defineConfig, devices } from '@playwright/test'

// Arahkan test ke project Supabase KHUSUS TEST dengan:
//   E2E_SUPABASE_URL=... E2E_SUPABASE_ANON_KEY=... E2E_EMAIL=... E2E_PASSWORD=... npm run test:e2e
// Tanpa env itu, dev server memakai .env.local (project produksi) — hati-hati.
const testDbEnv: Record<string, string> = {}
if (process.env.E2E_SUPABASE_URL && process.env.E2E_SUPABASE_ANON_KEY) {
  testDbEnv.VITE_SUPABASE_URL = process.env.E2E_SUPABASE_URL
  testDbEnv.VITE_SUPABASE_ANON_KEY = process.env.E2E_SUPABASE_ANON_KEY
}

export default defineConfig({
  testDir: './e2e',
  // Test transaksi berbagi satu database — wajib berurutan, jangan paralel.
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
    // reuse hanya bila TIDAK menarget DB test (server yang sudah jalan memakai .env.local)
    reuseExistingServer: !process.env.CI && !testDbEnv.VITE_SUPABASE_URL,
    env: { ...process.env, ...testDbEnv } as Record<string, string>,
  },
})
