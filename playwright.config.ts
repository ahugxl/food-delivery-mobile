import { defineConfig, devices } from "@playwright/test";
import * as dotenv from "dotenv";
import path from "path";

/**
 * Đọc biến môi trường từ file .env.
 */
dotenv.config({ path: path.resolve(__dirname, ".env") });

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: "./e2e",

  /* THÊM MỚI: Tăng timeout lên 60s để chờ PostHog xả queue (flushInterval: 30_000) */
  timeout: 60 * 1000,
  expect: { timeout: 10000 },

  /* SỬA: Chạy tuần tự để đảm bảo luồng event analytics (app_opened -> search -> add_to_cart) không bị chồng chéo */
  fullyParallel: false,

  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,

  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,

  /* SỬA: Chỉ dùng 1 worker để chạy tuần tự các test case analytics */
  workers: 1,

  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: "html",

  /* Shared settings for all the projects below. */
  use: {
    /* SỬA: Bổ sung baseURL trỏ đến biến môi trường hoặc cổng mặc định của Expo Web */
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:8081",

    /* Collect trace when retrying the failed test. */
    trace: "on-first-retry",
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
    },
  ],
});
