// Run: node --test tests/site.test.mjs
//
// No shared head: .nojekyll, and each HTML file is its own document. Paste
// the meta tag below immediately after <meta charset="utf-8"> in every HTML
// file. Page, CSS, and JS edits are frozen for the restyle, so the tag is
// not in the tree yet. When a page does carry the tag, it must match CSP.
//
// Stripe Checkout is a top-level navigation to the URL create-checkout
// returns. It is not a script, frame, or fetch, so Stripe is not a source.
// The 390px check launches the local google-chrome binary. Nothing is installed.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import net from "node:net";
import http from "node:http";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SKIP = new Set([".git", "tests", "node_modules"]);

// Content of the meta tag. 'unsafe-inline' is required: thanks.html and
// verify.html run classic inline scripts, and app.js / report.js / glowup.js
// set element.style and style="" (hashes do not cover CSSOM or style attrs).
// fonts.gstatic.com is where the fonts.googleapis.com stylesheet loads faces.
// Directory hosts are <img src> badges. The Supabase origin is config.js
// (fetch) and the glow-up card, whose <img src> is share_url from that API.
export const CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src https://fonts.gstatic.com",
  "img-src 'self' https://xlbjkhhcaqqxdviagymp.supabase.co https://fazier.com https://findly.tools https://indielineup.com https://launchfree.io https://saaslineup.com https://theaitoolsdir.com https://thedevtoolsdir.com https://thedevtoolsindex.com https://thedevtoolslist.com https://themicrosaasdir.com https://thesaasdir.com",
  "connect-src https://xlbjkhhcaqqxdviagymp.supabase.co https://fonts.googleapis.com https://fonts.gstatic.com",
].join("; ");

export const CSP_META = `<meta http-equiv="Content-Security-Policy" content="${CSP}">`;

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml",
};

function walk(dir, acc = []) {
  for (const name of fs.readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const abs = path.join(dir, name);
    if (fs.statSync(abs).isDirectory()) walk(abs, acc);
    else acc.push(abs);
  }
  return acc;
}

function rel(abs) {
  return path.relative(root, abs).split(path.sep).join("/");
}

const files = walk(root);
const pages = files.filter((f) => f.endsWith(".html")).map((abs) => ({ rel: rel(abs), abs, text: fs.readFileSync(abs, "utf8") }));
const jsFiles = files.filter((f) => f.endsWith(".js")).map((abs) => ({ rel: rel(abs), text: fs.readFileSync(abs, "utf8") }));
const cssFiles = files.filter((f) => f.endsWith(".css")).map((abs) => ({ rel: rel(abs), text: fs.readFileSync(abs, "utf8") }));

function attrs(tag) {
  const out = {};
  for (const m of tag.matchAll(/([:@\w-]+)\s*=\s*("([^"]*)"|'([^']*)')/g)) out[m[1].toLowerCase()] = m[3] ?? m[4] ?? "";
  return out;
}

function metas(text) {
  return [...text.matchAll(/<meta\b[^>]*>/gi)].map((m) => attrs(m[0]));
}

function resolveUrl(fromRel, raw) {
  if (raw == null || raw === "" || /^(mailto:|tel:|javascript:|data:)/i.test(raw)) return { skip: true };
  let url;
  try { url = new URL(raw, `https://deployvet.com/${fromRel}`); }
  catch { return { broken: true, raw }; }
  if (url.protocol !== "http:" && url.protocol !== "https:") return { skip: true };
  const local = url.hostname === "deployvet.com" || url.hostname === "www.deployvet.com";
  return { url, local, origin: url.origin, raw };
}

function diskFor(pathname) {
  let p = pathname;
  if (p.endsWith("/")) p += "index.html";
  if (p === "" || p === "/") p = "/index.html";
  const abs = path.resolve(root, "." + (p.startsWith("/") ? p : `/${p}`));
  const fromRoot = path.relative(root, abs);
  if (fromRoot.startsWith("..") || path.isAbsolute(fromRoot)) return null;
  return abs;
}

function supabaseOrigin() {
  const config = jsFiles.find((f) => f.rel === "config.js");
  assert.ok(config, "config.js");
  const m = config.text.match(/SUPABASE_URL:\s*"(https:\/\/[^"]+)"/);
  assert.ok(m, "SUPABASE_URL");
  return new URL(m[1]).origin;
}

function parseCsp(policy) {
  const map = new Map();
  for (const part of policy.split(";")) {
    const bits = part.trim().split(/\s+/).filter(Boolean);
    if (!bits.length) continue;
    assert.equal(map.has(bits[0]), false, "duplicate directive " + bits[0]);
    map.set(bits[0], bits.slice(1));
  }
  return map;
}

function setsOf(map) {
  const out = {};
  for (const [k, v] of [...map.entries()].sort()) out[k] = [...v].sort();
  return out;
}

function requiredPolicy() {
  const need = {
    "default-src": new Set(["'self'"]),
    "base-uri": new Set(["'self'"]),
    "object-src": new Set(["'none'"]),
    "script-src": new Set(),
    "style-src": new Set(),
    "font-src": new Set(),
    "img-src": new Set(),
    "connect-src": new Set(),
  };
  const sb = supabaseOrigin();
  const note = (dir, raw, from) => {
    if (!need[dir]) need[dir] = new Set();
    const got = resolveUrl(from, raw);
    if (got.skip || got.broken) return;
    if (got.local) need[dir].add("'self'");
    else need[dir].add(got.origin);
  };

  for (const page of pages) {
    for (const m of page.text.matchAll(/<(a|link|script|img|source|video|audio|iframe|object|embed|base)\b[^>]*>/gi)) {
      const tag = m[0];
      const name = m[1].toLowerCase();
      const a = attrs(tag);
      if (name === "script" && !a.src) continue;
      if (name === "base") {
        if (a.href) note("base-uri", a.href, page.rel);
        continue;
      }
      if (name === "iframe") { note("frame-src", a.src || "about:blank", page.rel); continue; }
      if (name === "object" || name === "embed") { note("object-src", a.data || a.src || "", page.rel); continue; }
      if (name === "img" || name === "source" || name === "video" || name === "audio") {
        if (a.src) note("img-src", a.src, page.rel);
        continue;
      }
      if (name === "script") { note("script-src", a.src, page.rel); continue; }
      if (name === "link") {
        const rels = (a.rel || "").toLowerCase().split(/\s+/);
        if (rels.includes("preconnect")) note("connect-src", a.href, page.rel);
        if (rels.includes("stylesheet")) note("style-src", a.href, page.rel);
        if (rels.includes("icon") || rels.includes("apple-touch-icon")) note("img-src", a.href, page.rel);
        if (rels.includes("preconnect") && /^https:\/\/fonts\.gstatic\.com\/?$/.test(a.href || "")) need["font-src"].add("https://fonts.gstatic.com");
      }
    }
    const classic = [...page.text.matchAll(/<script\b([^>]*)>/gi)].some((m) => {
      const a = attrs("<script " + m[1] + ">");
      if (a.src) return false;
      const type = (a.type || "").toLowerCase();
      return !type || type === "text/javascript" || type === "application/javascript" || type === "module";
    });
    if (classic) need["script-src"].add("'unsafe-inline'");
    if (/\sstyle\s*=/.test(page.text)) need["style-src"].add("'unsafe-inline'");
  }

  for (const file of jsFiles) {
    if (/\sstyle\s*=|\.style\./.test(file.text)) need["style-src"].add("'unsafe-inline'");
    if (/\bfetch\s*\(/.test(file.text) && file.text.includes("SUPABASE_URL")) need["connect-src"].add(sb);
    for (const m of file.text.matchAll(/\bfetch\s*\(\s*(['"`])(https?:\/\/[^'"`]+)\1/g)) need["connect-src"].add(new URL(m[2]).origin);
    // share_url from the history call is inserted as an <img src>.
    if (/<img\b[^>]*\ssrc\s*=\s*["']\$\{/.test(file.text)) need["img-src"].add(sb);
  }

  for (const file of cssFiles) {
    for (const m of file.text.matchAll(/url\(\s*(['"]?)([^"')]+)\1\s*\)/g)) {
      const raw = m[2].trim();
      if (/^(data:|blob:|#)/.test(raw)) continue;
      const got = resolveUrl(file.rel, raw);
      if (!got.skip && !got.broken && !got.local) {
        if (/\.(woff2?|ttf|otf|eot)(\?|$)/i.test(got.url.pathname)) need["font-src"].add(got.origin);
        else need["img-src"].add(got.origin);
      }
    }
  }

  // The Google stylesheet's font files are served from fonts.gstatic.com.
  // That host is not spelled in styles.css; the preconnect and css2 link are.
  if (need["style-src"].has("https://fonts.googleapis.com")) need["font-src"].add("https://fonts.gstatic.com");

  for (const dir of Object.keys(need)) if (need[dir].size === 0) delete need[dir];
  return need;
}

test("HTML documents have the basics", () => {
  const problems = [];
  for (const page of pages) {
    const t = page.text;
    if (!t.trimStart().toLowerCase().startsWith("<!doctype html>")) problems.push(`${page.rel}: doctype`);
    if (!/<html\b[^>]*\blang="en"/i.test(t)) problems.push(`${page.rel}: lang`);
    for (const name of ["html", "head", "body"]) {
      const open = t.match(new RegExp(`<${name}\\b`, "gi")) || [];
      const close = t.match(new RegExp(`</${name}>`, "gi")) || [];
      if (open.length !== 1 || close.length !== 1) problems.push(`${page.rel}: ${name} ${open.length}/${close.length}`);
    }
    const charset = metas(t).filter((a) => (a.charset || "").toLowerCase() === "utf-8");
    if (charset.length !== 1) problems.push(`${page.rel}: charset ${charset.length}`);
    const viewport = metas(t).filter((a) => (a.name || "").toLowerCase() === "viewport");
    if (viewport.length !== 1 || !/width=device-width/.test(viewport[0].content || "")) problems.push(`${page.rel}: viewport`);
    const titles = [...t.matchAll(/<title>([^<]*)<\/title>/gi)];
    if (titles.length !== 1 || !titles[0][1].trim()) problems.push(`${page.rel}: title`);
    const desc = metas(t).filter((a) => (a.name || "").toLowerCase() === "description");
    if (desc.length !== 1 || !(desc[0].content || "").trim()) problems.push(`${page.rel}: description`);
    const ids = [...t.matchAll(/\sid\s*=\s*("([^"]+)"|'([^']+)')/gi)].map((m) => m[2] ?? m[3]);
    const seen = new Set();
    for (const id of ids) {
      if (seen.has(id)) problems.push(`${page.rel}: duplicate id ${id}`);
      seen.add(id);
    }
    for (const m of t.matchAll(/<img\b[^>]*>/gi)) {
      if (!Object.hasOwn(attrs(m[0]), "alt")) problems.push(`${page.rel}: img missing alt`);
    }
  }
  assert.deepEqual(problems, []);
});

test("required meta tags are present", () => {
  const want = [
    ["property", "og:title"],
    ["property", "og:image"],
    ["name", "twitter:card"],
    ["name", "theme-color"],
  ];
  const problems = [];
  for (const page of pages) {
    const list = metas(page.text);
    for (const [attr, value] of want) {
      const hit = list.filter((a) => (a[attr] || "").toLowerCase() === value && (a.content || "").trim());
      if (!hit.length) problems.push(`${page.rel}: ${value}`);
    }
  }
  assert.deepEqual(problems, []);
});

test("internal links and asset references resolve", () => {
  const problems = [];
  const idsOf = new Map(pages.map((p) => [p.abs, new Set([...p.text.matchAll(/\sid\s*=\s*("([^"]+)"|'([^']+)')/gi)].map((m) => m[2] ?? m[3]))]));
  const check = (from, raw) => {
    const got = resolveUrl(from, raw);
    if (got.skip) return;
    if (got.broken || !got.local) {
      if (got.broken) problems.push(`${from}: bad url ${raw}`);
      return;
    }
    const abs = diskFor(got.url.pathname);
    if (!abs || !fs.existsSync(abs) || fs.statSync(abs).isDirectory()) {
      problems.push(`${from}: missing ${got.url.pathname} (${raw})`);
      return;
    }
    const hash = got.url.hash.length > 1 ? decodeURIComponent(got.url.hash.slice(1)) : "";
    if (!hash) return;
    const target = abs.endsWith(".html") ? abs : null;
    if (target && !idsOf.get(target)?.has(hash)) problems.push(`${from}: missing #${hash} in ${rel(target)}`);
  };

  for (const page of pages) {
    for (const m of page.text.matchAll(/<(a|link|script|img|source)\b[^>]*>/gi)) {
      const a = attrs(m[0]);
      if (a.href) check(page.rel, a.href);
      if (a.src) check(page.rel, a.src);
      if (a.srcset) for (const part of a.srcset.split(",")) check(page.rel, part.trim().split(/\s+/)[0]);
    }
  }
  for (const file of cssFiles) {
    for (const m of file.text.matchAll(/url\(\s*(['"]?)([^"')]+)\1\s*\)/g)) {
      const raw = m[2].trim();
      if (/^(data:|blob:|#|https?:)/i.test(raw)) continue;
      const base = path.posix.dirname(file.rel);
      const joined = path.posix.normalize(path.posix.join("/", base, raw));
      if (!fs.existsSync(diskFor(joined) || "")) problems.push(`${file.rel}: missing css url ${raw}`);
    }
  }
  for (const extra of ["sitemap.xml", "llms.txt", "robots.txt"]) {
    const text = fs.readFileSync(path.join(root, extra), "utf8");
    for (const m of text.matchAll(/https:\/\/deployvet\.com[^"'<\s]*/g)) check(extra, m[0]);
  }
  assert.deepEqual(problems, []);
});

test("CSP is the smallest policy that covers real origins", () => {
  const sb = supabaseOrigin();
  assert.equal(new URL(sb).host, "xlbjkhhcaqqxdviagymp.supabase.co");
  const js = jsFiles.map((f) => f.text).join("\n");
  assert.doesNotMatch(js, /\beval\s*\(|\bnew\s+Function\b|\bnew\s+Worker\b|serviceWorker/);
  assert.equal(CSP.includes("*"), false);
  assert.equal(/stripe\.com/.test(CSP), false);
  assert.equal(CSP.includes("unsafe-eval"), false);

  const parsed = parseCsp(CSP);
  for (const sources of parsed.values()) {
    for (const token of sources) assert.equal(["http:", "https:", "data:", "blob:", "ws:", "wss:", "*"].includes(token), false, token);
  }
  const expected = {};
  for (const [dir, set] of Object.entries(requiredPolicy())) expected[dir] = [...set].sort();
  assert.deepEqual(setsOf(parsed), expected);

  for (const page of pages) {
    for (const tag of page.text.matchAll(/<meta\b[^>]*>/gi)) {
      const a = attrs(tag[0]);
      if ((a["http-equiv"] || "").toLowerCase() !== "content-security-policy") continue;
      assert.equal(a.content, CSP, page.rel);
    }
  }
});

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
    server.on("error", reject);
  });
}

test("pages do not scroll sideways at 390px", { timeout: 60_000 }, async () => {
  const port = await freePort();
  const site = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split("?")[0]);
    if (p.endsWith("/")) p += "index.html";
    const abs = diskFor(p);
    if (!abs || !fs.existsSync(abs) || fs.statSync(abs).isDirectory()) { res.writeHead(404); res.end("missing"); return; }
    res.writeHead(200, { "content-type": TYPES[path.extname(abs)] || "application/octet-stream" });
    fs.createReadStream(abs).pipe(res);
  });
  await new Promise((resolve) => site.listen(port, "127.0.0.1", resolve));

  const debug = await freePort();
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "deployvet-chrome-"));
  const chrome = spawn("google-chrome", [
    "--headless=new", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage",
    "--no-first-run", "--window-size=390,844", `--remote-debugging-port=${debug}`,
    `--user-data-dir=${dataDir}`, "about:blank",
  ], { detached: true, stdio: "ignore" });

  try {
    let version;
    for (let i = 0; i < 50; i++) {
      try {
        const res = await fetch(`http://127.0.0.1:${debug}/json/version`);
        if (res.ok) { version = await res.json(); break; }
      } catch { /* chrome still starting */ }
      await new Promise((r) => setTimeout(r, 100));
    }
    assert.ok(version, "Chrome did not open a DevTools port");

    const browser = new WebSocket(version.webSocketDebuggerUrl);
    let seq = 0;
    const pending = new Map();
    browser.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (!msg.id || !pending.has(msg.id)) return;
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message || JSON.stringify(msg.error)));
      else resolve(msg.result);
    };
    const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
      const id = ++seq;
      pending.set(id, { resolve, reject });
      const payload = { id, method, params };
      if (sessionId) payload.sessionId = sessionId;
      browser.send(JSON.stringify(payload));
    });
    await new Promise((resolve, reject) => {
      if (browser.readyState === 1) resolve();
      else { browser.onopen = resolve; browser.onerror = reject; }
    });

    const { targetId } = await send("Target.createTarget", { url: "about:blank" });
    const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
    await send("Page.enable", {}, sessionId);
    // Layout viewport is 390 CSS pixels. mobile:false keeps width=device-width
    // from swapping in the legacy 980px mobile fallback.
    await send("Emulation.setDeviceMetricsOverride", {
      width: 390, height: 844, deviceScaleFactor: 1, mobile: false,
      screenWidth: 390, screenHeight: 844,
    }, sessionId);

    const problems = [];
    for (const page of pages) {
      const pathname = "/" + page.rel;
      await send("Page.navigate", { url: `http://127.0.0.1:${port}${pathname}` }, sessionId);
      const want = JSON.stringify(pathname);
      const ready = await send("Runtime.evaluate", {
        expression: `new Promise((resolve) => {
          const start = Date.now();
          const tick = () => {
            if (location.pathname === ${want} && document.readyState === "complete") {
              document.fonts.ready.then(() => resolve({
                path: location.pathname,
                scroll: document.documentElement.scrollWidth,
                client: document.documentElement.clientWidth,
                inner: window.innerWidth,
              }));
            } else if (Date.now() - start > 8000) resolve({ path: location.pathname, error: "timeout" });
            else setTimeout(tick, 25);
          };
          tick();
        })`,
        awaitPromise: true,
        returnByValue: true,
      }, sessionId);
      const box = ready.result?.value;
      if (!box || box.path !== pathname) { problems.push(`${page.rel}: did not load (${box && box.path})`); continue; }
      if (box.inner !== 390) problems.push(`${page.rel}: window ${box.inner}px`);
      if (box.scroll > box.client) problems.push(`${page.rel}: scrollWidth ${box.scroll} > clientWidth ${box.client}`);
    }
    browser.close();
    assert.deepEqual(problems, []);
  } finally {
    try { process.kill(-chrome.pid, "SIGKILL"); } catch { chrome.kill("SIGKILL"); }
    site.close();
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});
