# codex-limit

Check your [OpenAI Codex CLI](https://github.com/openai/codex) quota usage from the command line.

```
$ codex-limit
Codex Quota (plus)
────────────────────────────────────
Weekly:  7% used  (resets in 6d15h)  2% over pace
Burst:   2% used  (resets in 3h52m)  on pace
```

## Why?

[CodexBar](https://github.com/steipete/CodexBar) is great but runs as a **persistent macOS menu bar app at ~6% CPU** — enough to prevent battery charge-hold on laptops.

codex-limit takes a different approach: **on-demand, zero background CPU.** It launches a short-lived `codex app-server` process, fetches quota via JSON-RPC, and exits immediately.

## Install

```bash
npm i -g codex-limit
```

Or run directly without installing:

```bash
npx codex-limit
```

Requires [Codex CLI](https://github.com/openai/codex) to be installed and authenticated (`codex login`).

## Usage

```bash
# Pretty-print quota summary
codex-limit

# JSON output (for scripting / statusline integration)
codex-limit --json
```

### JSON output

```json
{
  "limitId": "codex",
  "primary": {
    "usedPercent": 2,
    "windowDurationMins": 300,
    "resetsAt": 1773320436
  },
  "secondary": {
    "usedPercent": 7,
    "windowDurationMins": 10080,
    "resetsAt": 1773879554
  },
  "planType": "plus"
}
```

- **primary**: Burst window (typically 5 hours)
- **secondary**: Weekly window (7 days)

### Claude Code statusline integration

You can display Codex quota in your Claude Code statusline. Add to `~/.claude/settings.json`:

```json
{
  "statusLine": {
    "type": "command",
    "command": "bash /path/to/your/statusline.sh"
  }
}
```

In your statusline script, cache the JSON output and read it:

```bash
CACHE="$HOME/.cache/codex-limit/quota.json"

# Background refresh if cache is stale (>180s)
if [ ! -f "$CACHE" ] || [ $(( $(date +%s) - $(stat -f%m "$CACHE") )) -gt 180 ]; then
  codex-limit --json > "$CACHE.tmp" && mv "$CACHE.tmp" "$CACHE" &
fi

# Read from cache
codex_used=$(jq -r '.secondary.usedPercent' "$CACHE" 2>/dev/null)
```

### Programmatic usage

```javascript
const { fetchQuota } = require("codex-limit");

const quota = await fetchQuota();
console.log(`Weekly: ${quota.secondary.usedPercent}% used`);
```

## How it works

Codex CLI ships with an experimental `app-server` subcommand that exposes a JSON-RPC interface over stdio. This tool:

1. Spawns `codex app-server` as a subprocess
2. Sends `initialize` + `account/rateLimits/read` via JSON-RPC
3. Parses the response and exits

The app-server internally authenticates with `chatgpt.com` using your Codex OAuth token (`~/.codex/auth.json`). No API keys or browser cookies needed.

> **Note**: The `app-server` command is marked as `[experimental]` by Codex CLI. This tool may break with future Codex CLI updates.

## License

MIT
