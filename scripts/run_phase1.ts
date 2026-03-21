import { spawnSync } from "node:child_process";
import path from "node:path";

const projectRoot = process.cwd();
const steps = [
  { name: "normalize", script: path.join("scripts", "normalize_jobs.ts") },
  { name: "filter", script: path.join("scripts", "filter_jobs.ts") },
  { name: "sync", script: path.join("scripts", "sync_jobs_to_supabase.ts") },
];

function runStep(step: { name: string; script: string }) {
  console.log(`\n=== Phase 1 step: ${step.name} ===`);

  const result = spawnSync("npx", ["tsx", step.script], {
    cwd: projectRoot,
    encoding: "utf8",
    stdio: "pipe",
  });

  if (result.stdout?.trim()) {
    console.log(result.stdout.trim());
  }

  if (result.stderr?.trim()) {
    console.error(result.stderr.trim());
  }

  if (result.status !== 0) {
    throw new Error(`Phase 1 failed at step: ${step.name}`);
  }
}

function main() {
  console.log("Starting Dragon Egg Phase 1 pipeline...");
  console.log(`Project root: ${projectRoot}`);

  for (const step of steps) {
    runStep(step);
  }

  console.log("\nPhase 1 pipeline completed successfully.");
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
