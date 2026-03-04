/**
 * .next cache'ini siler ve dev server'ı başlatır.
 * Takılan sayfalar, MODULE_NOT_FOUND, 404 chunk hatalarında kullanın.
 */
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const nextDir = path.join(process.cwd(), ".next");
if (fs.existsSync(nextDir)) {
  console.log("Cleaning .next folder...");
  fs.rmSync(nextDir, { recursive: true });
  console.log("Done. Starting dev server...");
} else {
  console.log("No .next folder. Starting dev server...");
}

const child = spawn("npx", ["next", "dev", "--turbo"], {
  stdio: "inherit",
  shell: true,
  cwd: process.cwd(),
});

child.on("exit", (code) => process.exit(code || 0));
