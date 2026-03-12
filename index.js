/**
 * codex-limit — Fetch Codex rate limits via app-server RPC.
 *
 * Codex CLI exposes an experimental JSON-RPC interface through `codex app-server`.
 * This module launches a short-lived app-server process, sends `account/rateLimits/read`,
 * and returns the parsed quota data. The process exits immediately after — zero background CPU.
 */

"use strict";

const { spawn } = require("child_process");

/**
 * @typedef {Object} Window
 * @property {number} usedPercent  - Usage percentage (0-100)
 * @property {number} windowDurationMins - Window size in minutes
 * @property {number} resetsAt    - Reset time as Unix timestamp (seconds)
 */

/**
 * @typedef {Object} QuotaResult
 * @property {string} limitId
 * @property {Window} primary    - Short window (typically 5 hours)
 * @property {Window} secondary  - Weekly window (typically 7 days)
 * @property {string} planType   - e.g. "plus", "pro"
 */

/**
 * Fetch Codex quota from the local Codex CLI.
 * Requires `codex` to be installed and authenticated.
 *
 * @param {Object} [options]
 * @param {number} [options.timeout=15000] - Timeout in ms
 * @returns {Promise<QuotaResult>}
 */
function fetchQuota({ timeout = 15000 } = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn("codex", ["app-server"], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let reqId = 0;
    const pending = new Map();
    const timer = setTimeout(() => {
      proc.kill();
      reject(new Error("Timeout waiting for codex app-server response"));
    }, timeout);

    proc.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
      // Process complete JSON-RPC lines
      let nl;
      while ((nl = stdout.indexOf("\n")) !== -1) {
        const line = stdout.slice(0, nl).trim();
        stdout = stdout.slice(nl + 1);
        if (!line) continue;
        try {
          const msg = JSON.parse(line);
          const cb = pending.get(msg.id);
          if (cb) {
            pending.delete(msg.id);
            cb(msg);
          }
        } catch {
          // ignore non-JSON lines
        }
      }
    });

    proc.on("error", (err) => {
      clearTimeout(timer);
      reject(
        new Error(
          `Failed to start codex app-server: ${err.message}\nIs Codex CLI installed? Run: npm i -g @openai/codex`
        )
      );
    });

    function rpc(method, params = {}) {
      return new Promise((res, rej) => {
        const id = ++reqId;
        pending.set(id, (msg) => {
          if (msg.error) rej(new Error(msg.error.message));
          else res(msg.result);
        });
        const payload = JSON.stringify({ jsonrpc: "2.0", id, method, params });
        proc.stdin.write(payload + "\n");
      });
    }

    (async () => {
      try {
        await rpc("initialize", {
          clientInfo: { name: "codex-limit", version: "1.0.0" },
        });
        const result = await rpc("account/rateLimits/read");
        clearTimeout(timer);
        proc.kill();
        resolve(result.rateLimits);
      } catch (err) {
        clearTimeout(timer);
        proc.kill();
        reject(err);
      }
    })();
  });
}

module.exports = { fetchQuota };
