// Plain-language findings: titles stay, high/critical fixes and evidence do not.
// Run: node --test tests/findings.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const src = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const body = src.slice(src.indexOf("// <findings>"), src.indexOf("// </findings>"));
const { listFindings, consequence } = new Function(body + "; return { listFindings, consequence };")();

test("high and critical findings keep the title and drop the fix and evidence", () => {
  const rows = listFindings({
    findings: [
      { id: "leaked_key", severity: "critical", title: "Service key in the page", fix: "Rotate it", detail: "sk_live_secret", location: "https://app.example/a.js" },
      { id: "missing_csp", severity: "low", title: "No Content-Security-Policy", fix: "Add a header", detail: "Response is missing the content-security-policy header." },
    ],
  });
  assert.equal(rows.length, 2);
  assert.equal(rows[0].title, "Service key in the page");
  assert.equal(rows[0].fix, "");
  assert.equal(rows[0].detail, "");
  assert.equal(rows[0].location, "");
  assert.match(rows[0].consequence, /copy it/);
  assert.equal(rows[1].fix, "Add a header");
  assert.equal(rows[1].detail, "");
  assert.match(rows[1].consequence, /extra code/);
  assert.doesNotMatch(rows[1].consequence, /content-security-policy header/i);
});

test("without a findings list, only the named top issue is used", () => {
  const rows = listFindings({
    topIssue: { id: "sourcemap", severity: "medium", title: "JavaScript source maps are public", fix: "Turn them off" },
    locked: { count: 4, rows: [{ locked: true }, { locked: true }] },
    total: 5,
  });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].title, "JavaScript source maps are public");
  assert.equal(rows[0].fix, "Turn them off");
  assert.match(consequence(rows[0]), /original code/);
});

test("intake pack keeps the order id and trims the stored event to the column size", () => {
  const srcIntake = src.slice(src.indexOf("// <intake>"), src.indexOf("// </intake>"));
  const { intakeEvent } = new Function(srcIntake + "; return { intakeEvent };")();
  const ev = intakeEvent({
    order_id: "ord_123",
    email: "ada@example.com",
    url: "https://my-app.vercel.app",
    builder: "lovable",
    access: "GitHub invite to ada/app. " + "x".repeat(800),
    notes: "please hurry",
  });
  assert.equal(ev.event, "fix-intake");
  assert.equal(ev.path, "ord_123");
  assert.ok(ev.referrer.length <= 500);
  const packed = JSON.parse(ev.referrer);
  assert.equal(packed.order_id, "ord_123");
  assert.equal(packed.builder, "lovable");
  assert.equal(packed.url, "https://my-app.vercel.app");
  assert.ok(packed.access.length < 800);
});
