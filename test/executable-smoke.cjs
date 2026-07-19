"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const executable = path.join(root, "dist", "kr-rnd-preflight-windows-x64.exe");
const readExample = (name) => fs.readFileSync(path.join(root, "examples", name), "utf8");
const child = spawn(executable, ["--no-browser"], { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });

function waitForUrl() {
  return new Promise((resolve, reject) => {
    let output = "";
    let errors = "";
    const timeout = setTimeout(() => reject(new Error(`Timed out waiting for URL. stdout=${output} stderr=${errors}`)), 10000);
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      output += chunk;
      const match = output.match(/http:\/\/127\.0\.0\.1:\d+\/[a-f0-9]+\//);
      if (match) {
        clearTimeout(timeout);
        resolve(match[0]);
      }
    });
    child.stderr.on("data", (chunk) => { errors += chunk; });
    child.on("exit", (code) => {
      clearTimeout(timeout);
      reject(new Error(`Executable exited before startup with ${code}. stdout=${output} stderr=${errors}`));
    });
  });
}

(async () => {
  let url;
  try {
    url = await waitForUrl();
    const page = await fetch(url);
    const html = await page.text();
    assert.equal(page.status, 200);
    assert.match(html, /<title>/);

    const validation = await fetch(`${url}validate`, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        project: {
          project_name: "Integration test",
          agreement_start: "2026-01-01",
          agreement_end_current: "2026-07-31",
          personnel_budget_codes: "LAB"
        },
        files: {
          budget: readExample("budget.csv"),
          participants: readExample("participants.csv"),
          evidence: readExample("evidence.csv"),
          transactions: readExample("transactions.csv")
        }
      })
    });
    const payload = await validation.json();
    assert.equal(validation.status, 200, payload.error);
    assert.equal(payload.result.summary.findings, 8);
    assert.equal(payload.result.summary.high, 5);
    assert.equal(payload.result.summary.medium, 2);
    assert.equal(payload.result.summary.low, 1);
    console.log(JSON.stringify({ page_status: page.status, findings: 8, high: 5, medium: 2, low: 1 }));
  } finally {
    if (url) {
      try { await fetch(`${url}shutdown`, { method: "POST" }); } catch { /* process may close first */ }
    }
    setTimeout(() => { if (!child.killed) child.kill(); }, 1000).unref();
  }
})().catch((error) => {
  console.error(error);
  child.kill();
  process.exitCode = 1;
});
