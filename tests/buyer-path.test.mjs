// Buyer path: optional $7 deeper report for A/B free checks that left findings out,
// and copy that matches pay -> ownership check -> automated scan -> emailed report link.
// Run: node --test tests/buyer-path.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { JSDOM } from "jsdom";

const root = new URL("..", import.meta.url);
const read = (name) => fs.readFileSync(new URL(name, root), "utf8");

function sliceBetween(s, start, end) {
  const i = s.indexOf(start);
  assert.ok(i >= 0, "missing marker " + start);
  const j = end ? s.indexOf(end, i + start.length) : -1;
  return s.slice(i, j < 0 ? s.length : j);
}

function assertDeliverySequence(text, label) {
  const low = text.toLowerCase();
  const pay = low.search(/\bpay\b|\bpaid\b/);
  const own = low.indexOf("already verified");
  const auto = low.indexOf("automated");
  const link = low.indexOf("link to the report");
  const pdf = low.indexOf("print or save a pdf");
  assert.ok(pay >= 0, label + " mentions pay");
  assert.ok(own > pay, label + " mentions already verified after pay");
  assert.ok(auto > own, label + " mentions the automated check after verification");
  assert.ok(link > auto, label + " mentions the report link after the check");
  assert.ok(pdf > link, label + " mentions printing a PDF after the report link");
  assert.doesNotMatch(text, /the report is sent here/i);
  assert.doesNotMatch(text, /it is emailed to you/i);
  assert.doesNotMatch(text, /emailed pdf/i);
  assert.doesNotMatch(text, /attached pdf/i);
  assert.doesNotMatch(text, /pdf attachment/i);
  assert.doesNotMatch(text, /hand review/i);
  assert.doesNotMatch(text, /reviewed by (a )?human/i);
  assert.doesNotMatch(text, /false positive/i);
  assert.doesNotMatch(text, /instant/i);
}

const top = {
  id: "csp",
  severity: "low",
  category: "headers",
  title: "No Content-Security-Policy",
  detail: "The home page response had no CSP header.",
  fix: "Add a Content-Security-Policy header.",
};

function fixture(over) {
  return {
    url: "https://client.example",
    score: 88,
    grade: "B",
    total: 3,
    counts: { low: 2, info: 1 },
    topIssue: top,
    locked: { count: 2 },
    check_id: "chk_test",
    ...over,
  };
}

async function boot(scan) {
  const html = read("index.html").replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
  const calls = [];
  const dom = new JSDOM(html, {
    url: "https://deployvet.test/",
    pretendToBeVisual: true,
    runScripts: "dangerously",
  });
  const { window } = dom;
  window.DEPLOYVET_CONFIG = { SUPABASE_URL: "https://example.test", SUPABASE_ANON_KEY: "test-anon-key" };
  window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  // jsdom has <dialog> but not showModal/close. Browsers do. This only lets the test open the real modal.
  const dialogProto = window.HTMLDialogElement.prototype;
  if (typeof dialogProto.showModal !== "function") {
    dialogProto.showModal = function () { this.setAttribute("open", ""); };
    dialogProto.close = function () {
      this.removeAttribute("open");
      this.dispatchEvent(new window.Event("close"));
    };
  }
  window.fetch = async (url, opts) => {
    calls.push({ url: String(url), body: opts && opts.body ? String(opts.body) : "" });
    const u = String(url);
    const data = u.includes("free-check") ? scan : { ok: true };
    return { ok: true, status: 200, json: async () => data };
  };
  window.eval(read("app.js"));
  const doc = window.document;
  doc.getElementById("url").value = scan.url;
  doc.getElementById("check").requestSubmit();
  for (let i = 0; i < 20 && !doc.getElementById("roast-head"); i++) {
    await new Promise((r) => setTimeout(r, 10));
  }
  assert.ok(doc.getElementById("roast-head"), "results modal did not render");
  return { window, doc, calls };
}

test("A/B with locked findings keeps the free result and recheck signup, and offers an optional $7 deeper report", async () => {
  const { doc } = await boot(fixture());
  const roast = doc.getElementById("roast");
  assert.equal(roast.open, true);
  assert.match(doc.getElementById("roast-body").textContent, /No Content-Security-Policy/);
  assert.match(roast.textContent, /2 more findings are not listed/);
  const calm = roast.querySelector(".fixpack.calm");
  assert.ok(calm, "recheck block missing");
  assert.match(calm.textContent, /No serious issues found/);
  assert.match(calm.textContent, /2 finding/);
  assert.doesNotMatch(calm.textContent, /unsafe|hacked|critical/i);
  const buy = calm.querySelector("a[data-buy='deployvet_scan_once']");
  assert.ok(buy, "optional buy button missing");
  assert.match(buy.textContent, /\$7/);
  assert.match(buy.className, /btn-line/);
  assert.doesNotMatch(buy.className, /btn-y/);
  assert.equal(buy.getAttribute("data-domain"), "client.example");
  assert.ok(calm.querySelector(".ra-form"), "recheck signup missing");
  assert.ok(calm.querySelector(".ra-consent"));
  const inline = doc.getElementById("check-result");
  assert.equal(inline.hidden, false);
  assert.ok(inline.querySelector(".fixpack.calm a[data-buy='deployvet_scan_once']"));
  assert.ok(inline.querySelector(".ra-form"));
});

test("A/B optional buy button opens the existing $7 checkout and does not start payment", async () => {
  const { doc, calls } = await boot(fixture());
  const before = calls.length;
  doc.querySelector("#roast .fixpack.calm a[data-buy='deployvet_scan_once']").click();
  assert.equal(calls.length, before);
  assert.equal(calls.some((c) => c.url.includes("create-checkout")), false);
  const buy = doc.getElementById("buy");
  assert.equal(buy.open, true);
  assert.equal(doc.getElementById("roast").open, false);
  assert.equal(buy.querySelector("[name=product]").value, "deployvet_scan_once");
  assert.match(buy.querySelector("#buy-title").textContent, /\$7/);
  assert.match(buy.querySelector("#buy-pay").textContent, /\$7/);
  assert.equal(buy.querySelector("[name=domain]").value, "client.example");
  assert.match(doc.getElementById("b-email-hint").textContent, /link to the report/);
  assertDeliverySequence(buy.querySelector("#buy-what").textContent + " " + buy.querySelector("#buy-trust").textContent, "checkout dialog");
});

test("A/B with no extra findings keeps the recheck signup and does not upsell", async () => {
  const { doc } = await boot(fixture({
    url: "https://clean.example",
    score: 100,
    grade: "A",
    total: 0,
    counts: {},
    topIssue: null,
    locked: { count: 0 },
    check_id: "chk_clean",
  }));
  for (const root of [doc.getElementById("roast"), doc.getElementById("check-result")]) {
    assert.ok(root.querySelector(".fixpack.calm .ra-form"));
    assert.equal(root.querySelector("[data-buy]"), null);
    assert.doesNotMatch(root.querySelector(".fixpack").textContent, /\$7|deeper report|unsafe|hacked/i);
  }
  assert.match(doc.getElementById("roast-head").textContent, /No issues found/);
});

test("A/B still offers the deeper report when locked.count is omitted but extra findings are counted", async () => {
  const scan = fixture({ locked: undefined, total: 2, counts: { low: 2 } });
  delete scan.locked;
  const { doc } = await boot(scan);
  assert.ok(doc.querySelector("#roast .fixpack.calm a[data-buy='deployvet_scan_once']"));
  assert.ok(doc.querySelector("#check-result .ra-form"));
});

test("C, D, and F still show the paid $7 offer, the results modal, and the follow-up form", async () => {
  for (const grade of ["C", "D", "F"]) {
    const score = grade === "C" ? 62 : grade === "D" ? 45 : 20;
    const { doc } = await boot(fixture({
      grade,
      score,
      total: 4,
      counts: { high: 1, medium: 2, low: 1 },
      topIssue: { ...top, severity: "high", title: "API key in page JavaScript" },
      locked: { count: 3 },
      check_id: "chk_" + grade,
    }));
    assert.equal(doc.getElementById("roast").open, true, grade);
    assert.equal(doc.querySelector("#roast .ra-form"), null, grade + " should not use the A/B recheck block");
    const paid = doc.querySelectorAll("#roast a[data-buy='deployvet_scan_once'], #check-result a[data-buy='deployvet_scan_once']");
    assert.ok(paid.length >= 2, grade + " paid offer missing from modal or inline result");
    assert.ok([...paid].some((a) => /\$7/.test(a.textContent)), grade);
    assert.ok(doc.querySelector("#roast .fu-form"), grade + " follow-up form missing");
    assert.match(doc.getElementById("roast-body").textContent, /API key in page JavaScript/);
  }
});

test("recheck signup still double-opts in and does not open checkout", async () => {
  const { doc, calls } = await boot(fixture());
  const form = doc.querySelector("#roast .ra-form");
  form.querySelector(".ra-email").value = "buyer@example.com";
  form.querySelector(".ra-consent").checked = true;
  const before = calls.length;
  form.requestSubmit();
  for (let i = 0; i < 20 && calls.length === before; i++) await new Promise((r) => setTimeout(r, 10));
  const news = calls.filter((c) => c.url.includes("newsletter"));
  assert.equal(news.length, 1);
  assert.match(news[0].body, /recheck-alert/);
  assert.match(news[0].body, /buyer@example\.com/);
  assert.equal(calls.some((c) => c.url.includes("create-checkout")), false);
  assert.equal(doc.getElementById("buy").open, false);
});

test("home, pricing, and how-it-works describe pay, verify, automated check, then a report link", () => {
  const home = read("index.html");
  const pricing = read("pricing.html");
  const how = read("how-it-works.html");
  assertDeliverySequence(sliceBetween(home, 'id="pricing"', 'id="faq"'), "home pricing");
  assertDeliverySequence(sliceBetween(pricing, "<h3>Scan</h3>", 'id="pro"'), "pricing scan");
  assertDeliverySequence(sliceBetween(how, "Get the full report", "Fix and check again"), "how it works");
  assert.match(home, /id="b-email-hint"[^>]*>\(we email a link to the report here\)/);
  assert.match(pricing, /id="b-email-hint"[^>]*>\(we email a link to the report here\)/);
  assert.match(home, /\$7 once/);
  assert.match(home, /\$29 a month/);
  assert.match(pricing, /<p class="amt">\$7 /);
  assert.match(pricing, /<p class="amt">\$10 /);
  assert.match(pricing, /\$29\/mo/);
  assert.doesNotMatch(sliceBetween(home, 'id="pricing"', 'id="faq"'), /\$8|\$9|\$19/);
});
