#!/usr/bin/env bash
# Builds, serves the build on :4173 and runs Lighthouse (mobile, simulated) against it. Prints the four scores and TBT.
# Uses Chrome (set CHROME_PATH to override). Brave headless adds seconds of its own shield work to the main thread and is not a fair judge.
set -e
NO_ADAPTER=1 npm run build >/dev/null 2>&1
(NO_REMOTE=1 npx vite preview --port 4173 --strictPort >/dev/null 2>&1 &) ; sleep 3
CHROME_PATH="${CHROME_PATH:-C:\Program Files\Google\Chrome\Application\chrome.exe}" npx --yes lighthouse http://localhost:4173/ --quiet --chrome-flags="--headless=new --no-sandbox" --only-categories=performance,accessibility,best-practices,seo --output=json --output-path=./lh-local.json >/dev/null 2>&1 || true
node -e 'const r=require("./lh-local.json");const c=r.categories;const a=r.audits;console.log(Object.entries(c).map(([k,v])=>k+":"+Math.round(v.score*100)).join(" "),"| TBT",a["total-blocking-time"].displayValue,"LCP",a["largest-contentful-paint"].displayValue,"| long:",JSON.stringify((a["long-tasks"]?.details?.items||[]).slice(0,3).map(i=>Math.round(i.duration))))'
for pid in $(netstat -ano | grep ":4173" | grep LISTENING | awk '{print $5}' | sort -u); do taskkill //F //PID $pid >/dev/null 2>&1; done
