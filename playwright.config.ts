import { defineConfig } from "@playwright/test";
const baseURL = process.env.TEST_APP_URL;
if (baseURL && !["localhost", "127.0.0.1"].includes(new URL(baseURL).hostname)) throw new Error("No se permiten pruebas de escritura en producción.");
export default defineConfig({
  testDir: "./tests/browser", outputDir: "outputs/playwright", workers: 1,
  use: { baseURL, trace: "retain-on-failure", screenshot: "only-on-failure" },
  projects: [{ name: "desktop", use: { browserName: "chromium", viewport: { width: 1600, height: 1000 } } }, { name: "mobile", use: { browserName: "chromium", viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } }]
});
