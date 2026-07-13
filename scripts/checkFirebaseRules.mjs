import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const firebaseCliScript = join(rootDirectory, "node_modules", "firebase-tools", "lib", "bin", "firebase.js");
const targets = ["firestore:rules", "database"];

for (const target of targets) {
  const result = spawnSync(
    process.execPath,
    [firebaseCliScript, "deploy", "--only", target, "--project", "carfollow-75750", "--dry-run"],
    { cwd: rootDirectory, stdio: "inherit" },
  );

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
