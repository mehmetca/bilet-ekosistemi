/**
 * .next cache'ini siler (npm run clean) ve webpack dev server başlatır.
 * Turbopack denemesi için: npm run dev:turbo
 * Takılan sayfalar, MODULE_NOT_FOUND, chunk hatalarında kullanın.
 */
const { spawn, spawnSync } = require("child_process");

spawnSync("npm", ["run", "clean"], { stdio: "inherit", shell: true, cwd: process.cwd() });
console.log("Starting dev server (webpack)...");

const child = spawn("npx", ["next", "dev", "-p", "3000"], {
  stdio: "inherit",
  shell: true,
  cwd: process.cwd(),
});

child.on("exit", (code) => process.exit(code || 0));
