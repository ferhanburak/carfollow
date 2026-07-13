import { spawnSync } from "node:child_process";

const firebaseCommand = "firebase";
const targets = ["firestore:rules", "database"];

for (const target of targets) {
  const result = spawnSync(
    firebaseCommand,
    ["deploy", "--only", target, "--project", "carfollow-75750", "--dry-run"],
    { stdio: "inherit", shell: process.platform === "win32" },
  );

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
