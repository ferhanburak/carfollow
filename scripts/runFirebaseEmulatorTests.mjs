import { existsSync, readdirSync } from "node:fs";
import { delimiter, dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const rootDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const localJavaDirectory = join(rootDirectory, "tools", "jre-21");

function findJavaExecutable(directory) {
  if (!existsSync(directory)) {
    return null;
  }

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const entryPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      const nestedJava = findJavaExecutable(entryPath);
      if (nestedJava) {
        return nestedJava;
      }
    } else if (entry.name.toLowerCase() === (process.platform === "win32" ? "java.exe" : "java")) {
      return entryPath;
    }
  }

  return null;
}

function resolveJavaEnvironment() {
  const environment = { ...process.env };
  const configuredJava = environment.JAVA_HOME
    ? join(environment.JAVA_HOME, "bin", process.platform === "win32" ? "java.exe" : "java")
    : null;
  const localJava = findJavaExecutable(localJavaDirectory);
  const javaExecutable = configuredJava && existsSync(configuredJava) ? configuredJava : localJava;

  if (javaExecutable) {
    const javaHome = dirname(dirname(javaExecutable));
    environment.JAVA_HOME = javaHome;
    environment.PATH = `${join(javaHome, "bin")}${delimiter}${environment.PATH ?? ""}`;
    return environment;
  }

  const systemJava = spawnSync("java", ["-version"], { encoding: "utf8" });
  if (systemJava.error || systemJava.status !== 0) {
    throw new Error(
      "Java 21 is required for Firebase emulators. Run `npm run setup:java` on Windows or configure JAVA_HOME.",
    );
  }

  return environment;
}

const firebaseCliScript = join(
  rootDirectory,
  "node_modules",
  "firebase-tools",
  "lib",
  "bin",
  "firebase.js",
);
if (!existsSync(firebaseCliScript)) {
  throw new Error("Local Firebase CLI is missing. Run `npm install` first.");
}

const environment = resolveJavaEnvironment();
environment.CI = environment.CI ?? "true";
environment.FIREBASE_CLI_DISABLE_UPDATE_CHECK = "true";
const testCommand = `"${process.execPath}" --test --test-concurrency=1 tests/firebase/rules.integration.test.mjs`;
const result = spawnSync(
  process.execPath,
  [
    firebaseCliScript,
    "emulators:exec",
    "--only",
    "firestore,database,storage",
    "--project",
    "demo-cruiser",
    testCommand,
  ],
  {
    cwd: rootDirectory,
    env: environment,
    stdio: "inherit",
  },
);

if (result.error) {
  throw result.error;
}
process.exit(result.status ?? 1);
