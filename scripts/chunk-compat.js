const fs = require("fs");
const path = require("path");

const targetDir = path.join(
  process.cwd(),
  ".next",
  "static",
  "chunks",
  "app",
  "yonetim",
  "slider-yonetimi"
);

const legacyChunkNames = [
  "page-815349d2a69839f4.js",
];

function ensureLegacyChunks() {
  if (!fs.existsSync(targetDir)) return;

  const files = fs
    .readdirSync(targetDir)
    .filter((file) => file.startsWith("page-") && file.endsWith(".js"));

  if (files.length === 0) return;

  const sourceFile = files[0];
  const sourcePath = path.join(targetDir, sourceFile);

  for (const legacyName of legacyChunkNames) {
    if (legacyName === sourceFile) continue;
    const legacyPath = path.join(targetDir, legacyName);
    try {
      fs.copyFileSync(sourcePath, legacyPath);
    } catch {
      // no-op: compatibility copy is best-effort
    }
  }
}

ensureLegacyChunks();
