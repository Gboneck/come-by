#!/usr/bin/env bash
# Runs when a Claude Code cloud session starts (see .claude/settings.json).
# Installs npm packages and, if the network allows, Playwright's headless
# Chromium so `npm run shot` and the tuning scripts work. Does nothing on a
# local machine, and never fails the session.
set -u
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then exit 0; fi
cd "${CLAUDE_PROJECT_DIR:-$(dirname "$0")/..}" || exit 0

if npm ci --no-audit --no-fund >/tmp/comeby-npm.log 2>&1 || npm install --no-audit --no-fund >>/tmp/comeby-npm.log 2>&1; then
  echo "Come By: npm packages installed."
else
  echo "Come By: npm install failed (see /tmp/comeby-npm.log)."
  exit 0
fi

# The co-op relay (server/) runs under wrangler for scripts/cooptest.mjs.
if (cd server && (npm ci --no-audit --no-fund || npm install --no-audit --no-fund)) >>/tmp/comeby-npm.log 2>&1; then
  echo "Come By: relay packages installed (cooptest can run)."
fi

if npx playwright install --with-deps chromium-headless-shell >/tmp/comeby-pw.log 2>&1 \
  || npx playwright install chromium-headless-shell >>/tmp/comeby-pw.log 2>&1; then
  echo "Come By: Playwright ready, so npm run shot works."
else
  echo "Come By: Playwright browser install failed (see /tmp/comeby-pw.log). Typecheck and build still work; screenshots will not."
fi
exit 0
