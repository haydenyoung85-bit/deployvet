// Buyer path: free check for your own AI-built app, then one $60 "we fix it" offer.
// A/B stays calm. The $7 list is a quiet secondary link only when something was found.
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

const high = {
  id: "leaked_key",
  severity: "high",
  category: "secrets",
  title: "API key in page JavaScript",
  detail: "KEY-EVIDENCE",
  location: "https://secret.example/assets/index.js",
  fix: "EXACT-FIX-SHOULD-BE-HIDDEN",
};

function fixture(over) {
  return {
    url: "https://my-app.vercel.app",
    score: 62,
    grade: "D",
    total: 3,
    counts: { high: 1, medium: 1, low: 1 },
    topIssue: high,
    locked: { count: 2 },
    check_id: "chk_test",
    ...over,
  };
}

async function boot(scan, opts) {
  opts = opts || {};
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
  const dialogProto = window.HTMLDialogElement.prototype;
  if (typeof dialogProto.showModal !== "function") {
    dialogProto.showModal = function () { this.setAttribute("open", ""); };
    dialogProto.close = function () {
      this.removeAttribute("open");
      this.dispatchEvent(new window.Event("close"));
    };
  }
  window.fetch = async (url, req) => {
    calls.push({ url: String(url), body: req && req.body ? String(req.body) : "" });
    const u = String(url);
    if (u.includes("free-check")) return { ok: true, status: 200, json: async () => scan };
    if (u.includes("leaderboard")) return { ok: true, status: 200, json: async () => (opts.board || { totals: { roasts: 686 } }) };
    return { ok: true, status: 200, json: async () => ({ ok: true }) };
  };
  window.eval(read("app.js"));
  const doc = window.document;
  const live = doc.getElementById("live-checks");
  if (opts.board !== null) {
    for (let i = 0; i < 20 && live && live.hidden; i++) await new Promise((r) => setTimeout(r, 10));
  }
  doc.getElementById("url").value = scan.url;
  doc.getElementById("check").requestSubmit();
  for (let i = 0; i < 20 && !doc.getElementById("roast-head"); i++) await new Promise((r) => setTimeout(r, 10));
  assert.ok(doc.getElementById("roast-head"), "results modal did not render");
  return { window, doc, calls };
}

test("homepage speaks to someone checking their own AI-built app and leads with the $60 fix", () => {
  const home = read("index.html");
  const main = sliceBetween(home, "<main>", "<footer");
  assert.match(main, /Is your AI-built app leaking\?/);
  assert.match(main, /Paste your link/);
  assert.match(main, /Free 10-second check/);
  assert.match(main, /Check it free/);
  assert.match(main, /Lovable|Bolt|Vercel|Netlify/);
  assert.doesNotMatch(main, /client sites/i);
  assert.match(main, /\$60/);
  assert.match(main, /48 hours/);
  assert.doesNotMatch(main, /\$7|\$10|\$29|\$39/);
  assert.match(main, /id="live-checks"/);
  assert.doesNotMatch(main, /more than 600|\b686\b/);
  assert.ok(main.indexOf('id="check"') < main.indexOf('class="shot"'), "check form should come before the example");
  assert.match(home, /id="b-email-hint"/);
});

test("live check count comes from the leaderboard total and stays hidden without it", async () => {
  const shown = await boot(fixture(), { board: { totals: { roasts: 686 } } });
  assert.equal(shown.doc.getElementById("live-checks").hidden, false);
  assert.match(shown.doc.getElementById("live-checks").textContent, /686 checks so far/);
  const hidden = await boot(fixture(), { board: {} });
  assert.equal(hidden.doc.getElementById("live-checks").hidden, true);
  assert.equal(hidden.doc.getElementById("live-checks").textContent.trim(), "");
});

test("problem result lists every named finding in plain words, hides high fixes, and puts $60 under the score", async () => {
  const scan = fixture({
    findings: [
      high,
      { id: "sourcemap", severity: "medium", title: "JavaScript source maps are public", detail: "A .map file is public.", fix: "Turn source maps off." },
      { id: "missing_csp", severity: "low", title: "No Content-Security-Policy", detail: "Response is missing the content-security-policy header.", fix: "Add a Content-Security-Policy header." },
    ],
    total: 3,
    locked: { count: 0 },
  });
  const { doc } = await boot(scan);
  const roast = doc.getElementById("roast");
  const html = doc.getElementById("roast-body").innerHTML;
  assert.equal(roast.open, true);
  assert.ok(html.indexOf("fix-now") < html.indexOf("r-burns"), "$60 button should come before the findings");
  assert.match(roast.querySelector(".fix-now").textContent, /\$60/);
  assert.equal(roast.querySelector(".fix-now").getAttribute("data-buy"), "deployvet_fix_for_you");
  assert.match(roast.textContent, /Fixed within 48 hours or your money back/);
  assert.match(roast.textContent, /API key in page JavaScript/);
  assert.match(roast.textContent, /JavaScript source maps are public/);
  assert.match(roast.textContent, /No Content-Security-Policy/);
  assert.match(roast.textContent, /Anyone can copy it/);
  assert.match(roast.textContent, /extra code/);
  assert.match(roast.textContent, /Turn source maps off/);
  assert.doesNotMatch(html, /EXACT-FIX-SHOULD-BE-HIDDEN/);
  assert.doesNotMatch(html, /KEY-EVIDENCE/);
  assert.doesNotMatch(html, /secret\.example/);
  assert.doesNotMatch(html, /content-security-policy header/);
  assert.doesNotMatch(roast.textContent, /\$10|\$29|\$39/);
  const quiet = roast.querySelector(".quiet-list a");
  assert.equal(quiet.getAttribute("data-buy"), "deployvet_scan_once");
  assert.match(quiet.textContent, /full list/);
  assert.match(quiet.textContent, /\$7/);
  assert.equal(roast.querySelector(".ra-form"), null);
  const inline = doc.getElementById("check-result");
  assert.ok(inline.querySelector(".fix-now"));
  assert.ok(inline.querySelector(".quiet-list a[data-buy='deployvet_scan_once']"));
});

test("when the check only names one issue, the others are counted and not invented", async () => {
  const { doc } = await boot(fixture());
  const text = doc.getElementById("roast").textContent;
  assert.match(text, /API key in page JavaScript/);
  assert.match(text, /2 more issues showed up/);
  assert.doesNotMatch(text, /Hidden issue title/);
  assert.doesNotMatch(doc.getElementById("roast-body").innerHTML, /EXACT-FIX-SHOULD-BE-HIDDEN/);
});

test("$60 button opens checkout and does not start payment", async () => {
  const { doc, calls } = await boot(fixture());
  const before = calls.length;
  doc.querySelector("#roast .fix-now").click();
  assert.equal(calls.some((c) => c.url.includes("create-checkout")), false);
  assert.equal(calls.length, before);
  const buy = doc.getElementById("buy");
  assert.equal(buy.open, true);
  assert.equal(doc.getElementById("roast").open, false);
  assert.equal(buy.querySelector("[name=product]").value, "deployvet_fix_for_you");
  assert.match(buy.querySelector("#buy-title").textContent, /\$60/);
  assert.match(buy.querySelector("#buy-pay").textContent, /\$60/);
  assert.match(buy.querySelector("#buy-what").textContent, /48 hours/);
  assert.match(buy.querySelector("#buy-trust").textContent, /do not have to add a DNS record before we start/i);
  assert.equal(buy.querySelector("[name=domain]").value, "https://my-app.vercel.app");
  assert.match(doc.getElementById("b-email-hint").textContent, /reach you about the fix/);
});

test("A and B stay calm: all clear, recheck signup, and a soft $60 link", async () => {
  const { doc } = await boot(fixture({
    url: "https://clean.example",
    score: 96,
    grade: "A",
    total: 0,
    counts: {},
    topIssue: null,
    locked: { count: 0 },
    check_id: "chk_clean",
  }));
  for (const root of [doc.getElementById("roast"), doc.getElementById("check-result")]) {
    assert.match(root.textContent, /All clear/);
    assert.ok(root.querySelector(".ra-form"), "recheck signup missing");
    assert.equal(root.querySelector(".fix-now"), null);
    const soft = root.querySelector("[data-buy='deployvet_fix_for_you']");
    assert.ok(soft, "soft $60 link missing");
    assert.match(soft.textContent, /harden it anyway/);
    assert.match(soft.textContent, /\$60/);
    assert.equal(soft.classList.contains("btn"), false);
    assert.equal(root.querySelector("[data-buy='deployvet_scan_once']"), null);
    assert.doesNotMatch(root.textContent, /\$7|\$10|\$29|\$39|unsafe|hacked/);
  }
});

test("recheck signup still double-opts in and does not open checkout", async () => {
  const { doc, calls } = await boot(fixture({
    score: 96, grade: "A", total: 0, counts: {}, topIssue: null, locked: { count: 0 },
  }));
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

test("pricing still lists the older products and how-it-works leads with the $60 fix", () => {
  const pricing = read("pricing.html");
  const how = read("how-it-works.html");
  assert.match(pricing, /\$60/);
  assert.match(pricing, /48 hours/);
  assert.match(pricing, /<p class="amt">\$7 /);
  assert.match(pricing, /<p class="amt">\$10 /);
  assert.match(pricing, /\$29\/mo/);
  assert.match(how, /\$60/);
  assert.match(how, /48 hours/);
  assert.match(how, /invite/i);
  assert.match(read("thanks.html"), /id="fix-box"/);
  assert.match(read("thanks.html"), /name="access"/);
  assert.match(read("thanks.html"), /Lovable/);
  assert.match(read("thanks.html"), /Netlify/);
  assert.match(read("thanks.html"), /Replit/);
});
