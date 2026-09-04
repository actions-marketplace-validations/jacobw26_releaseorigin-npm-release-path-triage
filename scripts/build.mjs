import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = await readFile(path.join(root, "src", "index.js"), "utf8");
const banner = "// Generated from src/index.js by npm run build. Do not edit dist directly.\n";
const expected = `${banner}${source}`;
const destination = path.join(root, "dist", "index.js");

if (process.argv.includes("--check")) {
  let actual = "";
  try {
    actual = await readFile(destination, "utf8");
  } catch {
    // Report the same deterministic error for a missing or stale bundle.
  }
  if (actual !== expected) {
    console.error("dist/index.js is stale. Run npm run build and commit the result.");
    process.exitCode = 1;
  }
} else {
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, expected, "utf8");
}
