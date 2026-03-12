#!/usr/bin/env node
"use strict";

const { fetchQuota } = require("./index.js");

const HELP = `
codex-quota — Check your Codex CLI quota usage

Usage:
  codex-quota              Pretty-print quota summary
  codex-quota --json       Output raw JSON (for scripting)
  codex-quota --help       Show this help

Requires Codex CLI to be installed and authenticated (codex login).
`;

function formatRemaining(resetsAt) {
  const remaining = Math.max(0, resetsAt - Math.floor(Date.now() / 1000));
  const h = Math.floor(remaining / 3600);
  if (h >= 24) {
    return `${Math.floor(h / 24)}d${h % 24}h`;
  }
  return `${h}h${Math.floor((remaining % 3600) / 60)}m`;
}

function paceLabel(usedPercent, resetsAt, cycleSec) {
  const remaining = Math.max(0, resetsAt - Math.floor(Date.now() / 1000));
  const elapsed = cycleSec - remaining;
  const expected = Math.round((elapsed / cycleSec) * 100);
  const diff = usedPercent - expected;
  if (diff > 0) return `${diff}% over pace`;
  if (diff === 0) return "on pace";
  return `${-diff}% reserved`;
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    process.stdout.write(HELP);
    process.exit(0);
  }

  try {
    const quota = await fetchQuota();

    if (args.includes("--json")) {
      process.stdout.write(JSON.stringify(quota, null, 2) + "\n");
      process.exit(0);
    }

    // Pretty print
    const { primary, secondary, planType } = quota;
    const weekSec = secondary.windowDurationMins * 60;
    const shortSec = primary.windowDurationMins * 60;

    console.log(`Codex Quota (${planType})`);
    console.log("─".repeat(40));
    console.log(
      `Weekly:  ${secondary.usedPercent}% used  ` +
        `(resets in ${formatRemaining(secondary.resetsAt)})  ` +
        paceLabel(secondary.usedPercent, secondary.resetsAt, weekSec)
    );
    console.log(
      `Burst:   ${primary.usedPercent}% used  ` +
        `(resets in ${formatRemaining(primary.resetsAt)})  ` +
        paceLabel(primary.usedPercent, primary.resetsAt, shortSec)
    );
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}

main();
