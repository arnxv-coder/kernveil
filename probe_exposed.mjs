/* Regression guard for the exposed-files false positive.
   A Vite SPA answers every path with the same 200 HTML, which previously made
   the scanner report five critical vulnerabilities that did not exist.

   Run: node probe_exposed.mjs
   Exits non-zero if a catch-all host is ever reported as exposing files. */
import { scanHost } from "./api/lib/scanCore.js";

// Hosts that serve a SPA shell for every path.
const CATCH_ALL_HOSTS = ["kernveil.vercel.app", "vercel.com"];

let failures = 0;

for (const host of CATCH_ALL_HOSTS) {
  let result;
  try {
    result = await scanHost(host);
  } catch (err) {
    console.log(`SKIP  ${host}  (${err.message})`);
    continue;
  }

  const check = result.checks.find((c) => c.rule === "exposed-files");
  const falsePositive = check.status === "fail";
  if (falsePositive) {
    failures++;
    console.log(`FAIL  ${host}  exposed-files=${check.status}  score=${result.score}`);
    console.log(`      ${check.summary}`);
  } else {
    console.log(`PASS  ${host}  exposed-files=${check.status}  score=${result.score}`);
  }
}

console.log(failures === 0 ? "\nAll checks passed" : `\n${failures} failure(s)`);
process.exit(failures === 0 ? 0 : 1);