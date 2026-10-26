// Run: node --test site/tests/lockinfo.test.mjs   (pulls the helpers out of app.js between the <lockinfo> markers)
import { test } from "node:test"; import assert from "node:assert/strict"; import fs from "node:fs";
const src = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const body = src.slice(src.indexOf("// <lockinfo>"), src.indexOf("// </lockinfo>"));
const { totalOf, lockInfo } = new Function(body + "; return { totalOf, lockInfo };")();
const top = { id: "e", severity: "critical", title: "x" };

test("total:null is not zero: falls back to the summed counts", () => {
  assert.equal(totalOf({ total: null, counts: { critical: 1, high: 2 }, topIssue: top }), 3);
  assert.equal(totalOf({ total: "", counts: { low: 2 } }), 2);
  assert.equal(totalOf({ total: NaN, counts: { low: 2 } }), 2);
  assert.equal(totalOf({ counts: { low: 2 } }), 2);
});
test("a real total of 0 stays 0 (clean site), and a real number wins", () => {
  assert.equal(totalOf({ total: 0, counts: {}, topIssue: null }), 0);
  assert.equal(totalOf({ total: 6, counts: { medium: 1 }, topIssue: top, locked: { count: 5 } }), 6);
});
test("never says there are fewer issues than the ones being shown", () => {
  assert.equal(totalOf({ total: null, counts: {}, topIssue: top, locked: { count: 5 } }), 6);
  assert.equal(totalOf({ total: 0, counts: {}, topIssue: top }), 1);
});
test("locked headline and chips agree; chips are dropped if they cannot add up", () => {
  let li = lockInfo({ total: 6, counts: { critical: 1, high: 2, medium: 3 }, topIssue: top, locked: { count: 5 } });
  assert.equal(li.locked, 5); assert.equal(li.chipsOk, true); assert.deepEqual([li.left.critical, li.left.high, li.left.medium], [0, 2, 3]);
  li = lockInfo({ total: 6, counts: { critical: 1, high: 1 }, topIssue: top, locked: { count: 5 } });   // counts disagree with locked.count
  assert.equal(li.locked, 5); assert.equal(li.chipsOk, false);
  li = lockInfo({ total: null, counts: { critical: 1, high: 2 }, topIssue: top, locked: { count: null } });   // old/odd response
  assert.equal(li.total, 3); assert.equal(li.locked, 2); assert.equal(li.chipsOk, true);
  li = lockInfo({ total: 1, counts: { medium: 1 }, topIssue: { severity: "medium" }, locked: { count: 0 } });
  assert.equal(li.locked, 0);
});
