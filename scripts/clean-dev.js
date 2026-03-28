/**
 * .next cache'ini siler (npm run clean) ve dev server'ı --turbo ile başlatır.
 * Webpack dev için: npm run dev:fresh
 * Takılan sayfalar, MODULE_NOT_FOUND, chunk hatalarında kullanın.
 */
const { spawn, spawnSync } = require("child_process");

spawnSync("npm", ["run", "clean"], { stdio: "inherit", shell: true, cwd: process.cwd() });
console.log("Starting dev server (turbo)...");

const child = spawn("npx", ["next", "dev", "-p", "3000", "--turbo"], {
  stdio: "inherit",
  shell: true,
  cwd: process.cwd(),
});

child.on("exit", (code) => process.exit(code || 0));
