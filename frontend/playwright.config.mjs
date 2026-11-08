import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "@playwright/test";

const frontendDirectory = dirname(fileURLToPath(import.meta.url));
const backendDirectory = join(frontendDirectory, "..", "backend");
const localPython = join(backendDirectory, ".venv", process.platform === "win32" ? "Scripts/python.exe" : "bin/python");
if (!process.env.BEATCODE_PYTHON && !existsSync(localPython)) {
  throw new Error("Crie backend/.venv conforme o README ou defina BEATCODE_PYTHON para executar os testes de navegação.");
}
const python = process.env.BEATCODE_PYTHON || localPython;

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop", use: { browserName: "chromium", viewport: { width: 1280, height: 800 } } },
    { name: "mobile", use: { browserName: "chromium", viewport: { width: 360, height: 640 }, isMobile: true, hasTouch: true } },
  ],
  webServer: [
    {
      command: `"${python}" -m uvicorn main:app --host 127.0.0.1 --port 8000`,
      cwd: backendDirectory,
      url: "http://127.0.0.1:8000/auth/status",
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: "npm run dev",
      cwd: frontendDirectory,
      url: "http://127.0.0.1:3000",
      reuseExistingServer: false,
      timeout: 90_000,
    },
  ],
});
