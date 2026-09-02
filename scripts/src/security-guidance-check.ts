import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const securityRunbook = readFileSync(
  resolve(repositoryRoot, "SECURITY.md"),
  "utf8",
);
const prePushHook = readFileSync(
  resolve(repositoryRoot, ".githooks/pre-push"),
  "utf8",
);

const requiredRunbookSteps = [
  ["rotate or revoke the secret", "**Rotate or revoke the secret first.**"],
  ["scrub every affected commit", "**Scrub every affected commit.**"],
  ["force-push the rewritten history", "**Force-push the rewritten history.**"],
  [
    "notify collaborators and fork owners",
    "**Notify collaborators and fork owners.**",
  ],
  ["tell collaborators to re-clone", "**re-clone**"],
] as const;

const failures: string[] = [];
let previousPosition = -1;

for (const [description, marker] of requiredRunbookSteps) {
  const position = securityRunbook.indexOf(marker);

  if (position === -1) {
    failures.push(
      `SECURITY.md is missing the ${description} step (${marker}).`,
    );
    continue;
  }

  if (position <= previousPosition) {
    failures.push(`SECURITY.md puts the ${description} step out of order.`);
  }

  previousPosition = position;
}

const purgeRunbookLink = "SECURITY.md#purge-a-secret-from-git-history";
if (!prePushHook.includes(purgeRunbookLink)) {
  failures.push(
    `.githooks/pre-push must link directly to the purge runbook (${purgeRunbookLink}).`,
  );
}

if (failures.length > 0) {
  console.error("Security guidance check failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exitCode = 1;
} else {
  console.log("Security guidance check passed.");
}
