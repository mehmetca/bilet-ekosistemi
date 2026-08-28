/**
 * Dev script: NODE_ENV'i her zaman "development" yaparak next dev başlatır.
 *
 * Ortamda yanlışlıkla NODE_ENV=production kalırsa `next dev` şu hatayı verir:
 *   "You are using a non-standard NODE_ENV value..."
 *   "EvalError: Code generation from strings disallowed for this context"
 * ve site açılmaz. Bu sarmalayıcı, dev sunucusunu her zaman doğru modda başlatır.
 */
process.env.NODE_ENV = "development";

const { spawn } = require("child_process");

const nextBin = require.resolve("next/dist/bin/next");
const child = spawn(process.execPath, [nextBin, "dev", "-p", "3000"], {
  stdio: "inherit",
  env: process.env,
});

child.on("error", (err) => {
  console.error("next dev başlatılamadı:", err);
  process.exit(1);
});

child.on("exit", (code) => {
  process.exit(code ?? 1);
});
