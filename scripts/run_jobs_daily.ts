/**
 * run_jobs_daily.ts
 *
 * Daily orchestrator: collect -> evaluate -> summary
 *
 * Usage:
 *   npm run jobs:daily
 *   npx tsx scripts/run_jobs_daily.ts
 */

import { spawnSync } from "node:child_process";
import path from "node:path";

const projectRoot = process.cwd();

type CollectSummary = {
  step: string;
  companies_processed: number;
  companies_failed: number;
  total_fetched: number;
  total_inserted: number;
  total_skipped_existing: number;
};

type EvalDetail = {
  id: number;
  company: string;
  role_title: string;
  decision: "accepted" | "maybe" | "rejected";
  fit_score: number;
};

type EvalSummary = {
  step: string;
  evaluated_count: number;
  accepted: number;
  maybe: number;
  rejected: number;
  details: EvalDetail[];
};

function runStep(scriptPath: string, args: string[] = []): { stdout: string; stderr: string; ok: boolean } {
  const result = spawnSync("npx", ["tsx", scriptPath, ...args], {
    cwd: projectRoot,
    encoding: "utf8",
    stdio: "pipe",
  });

  return {
    stdout: result.stdout?.trim() ?? "",
    stderr: result.stderr?.trim() ?? "",
    ok: result.status === 0,
  };
}

function parseJson<T>(text: string): T | null {
  if (!text) return null;
  // stdout may have multiple JSON blobs if there are warnings — take the last valid block
  const blocks = text.split(/\n(?=\{)/);
  for (let i = blocks.length - 1; i >= 0; i--) {
    try {
      return JSON.parse(blocks[i]) as T;
    } catch {
      // try next block
    }
  }
  return null;
}

function main() {
  const startedAt = new Date().toISOString();
  console.log(`\n=== Dragon Egg Daily Jobs Pipeline — ${startedAt} ===\n`);

  // --- Step 1: Collect ---
  console.log("Step 1/2: Collecting live jobs...");
  const collectResult = runStep(path.join("scripts", "collect_jobs_live.ts"));

  if (collectResult.stderr) {
    // stderr is progress logs — print them
    for (const line of collectResult.stderr.split("\n")) {
      console.log(" ", line);
    }
  }

  if (!collectResult.ok) {
    console.error("\nCollection failed. Aborting pipeline.");
    console.error(collectResult.stderr);
    process.exit(1);
  }

  const collectData = parseJson<CollectSummary>(collectResult.stdout);
  if (collectData) {
    console.log(
      `  ✓ collected: ${collectData.total_inserted} new, ${collectData.total_skipped_existing} already existed, ${collectData.companies_failed} company errors`,
    );
  }

  // --- Step 2: Evaluate ---
  console.log("\nStep 2/2: Evaluating new jobs...");
  const evalResult = runStep(path.join("scripts", "evaluate_jobs.ts"));

  if (!evalResult.ok) {
    console.error("\nEvaluation failed.");
    console.error(evalResult.stderr);
    process.exit(1);
  }

  const evalData = parseJson<EvalSummary>(evalResult.stdout);

  // --- Summary ---
  console.log("\n=== Pipeline Summary ===\n");

  if (evalData) {
    console.log(
      `Evaluated : ${evalData.evaluated_count} jobs`,
    );
    console.log(`  accepted: ${evalData.accepted}`);
    console.log(`  maybe   : ${evalData.maybe}`);
    console.log(`  rejected: ${evalData.rejected}`);

    const topAccepted = (evalData.details ?? [])
      .filter((d) => d.decision === "accepted")
      .sort((a, b) => b.fit_score - a.fit_score)
      .slice(0, 10);

    if (topAccepted.length > 0) {
      console.log("\nTop accepted jobs:");
      for (const job of topAccepted) {
        console.log(`  [${job.fit_score}] ${job.company} — ${job.role_title}`);
      }
    }
  } else if (evalResult.stdout) {
    console.log(evalResult.stdout);
  } else {
    console.log("No new jobs to evaluate (all already scored).");
  }

  console.log(`\nFinished at ${new Date().toISOString()}`);
  console.log("View shortlist: open http://localhost:4000/jobs\n");
}

main();
