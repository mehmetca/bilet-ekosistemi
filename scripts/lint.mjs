import { spawnSync } from "node:child_process";
import path from "node:path";

const eslintPath = path.join(process.cwd(), "node_modules", "eslint", "bin", "eslint.js");
const result = spawnSync(process.execPath, [eslintPath, "src"], {
  stdio: "inherit",
  env: { ...process.env, ESLINT_USE_FLAT_CONFIG: "true" },
});

if (result.error) {
  console.error(result.error);
  process.exit(1);
}

process.exit(result.status ?? 1);