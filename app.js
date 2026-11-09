// Wires the static site to the DeployVet Supabase edge functions. No build step, no dependencies.
(function () {
  const C = window.DEPLOYVET_CONFIG || {};
  const configured = C.SUPABASE_URL && !/YOUR-PROJECT-REF/.test(C.SUPABASE_URL) && C.SUPABASE_ANON_KEY && !/YOUR-SUPABASE/.test(C.SUPABASE_ANON_KEY);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  async function call(fn, body, method = "POST", query = "") {
    if (!configured) throw new Error("DeployVet is not switched on yet. Please try again soon.");
    const res = await fetch(`${C.SUPABASE_URL}/functions/v1/${fn}${query}`, {
      method,
      headers: { "content-type": "application/json", apikey: C.SUPABASE_ANON_KEY, authorization: `Bearer ${C.SUPABASE_ANON_KEY}` },
      body: method === "POST" ? JSON.stringify(body || {}) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.error) { const e = new Error(data.error || `Something went wrong (${res.status}). Please try again.`); e.status = res.status; e.data = data; throw e; }
    data._status = res.status;
    return data;
  }
  // Friendly text for public scores errors. 400 messages from the server are already plain and specific.
  const friendly = (e) => {
    if (e.status === 429) return "Too many requests from your network today. Please try again tomorrow.";
    if (e.status === 502) return "We could not reach your site just now. Check that it is online and try again in a minute.";
    if (e.status === 404) return "That site is not on the public scores page, so there is nothing to remove.";
    if (e.status === 403) return "We cannot see your token yet. DNS can take a few minutes. Check that it is in place, then try again.";
    if (e.status === 405 || e.status >= 500) return "Something went wrong on our side. Please try again shortly.";
    if (e.status) return e.message;
    return "Could not reach DeployVet. Check your connection and try again.";
  };
  function attrib() { const o = {}; try { const v = sessionStorage.getItem("dv_v"), s = sessionStorage.getItem("dv_src"), c = sessionStorage.getItem("dv_cmp"); if (v) o.visitor = v; if (s) o.utm_source = s.slice(0, 40); if (c) o.utm_campaign = c.slice(0, 40); } catch (_) {} return o; }
window.DeployVet = { call, esc, friendly , attrib };

  const busy = (btn, on, label) => { if (!btn) return; if (on) { btn.dataset.l = btn.innerHTML; btn.disabled = true; btn.textContent = label; } else { btn.disabled = false; btn.innerHTML = btn.dataset.l || btn.innerHTML; } };
  const msg = (el, text, kind) => { if (!el) return; el.hidden = false; el.className = "notice " + (kind || ""); el.innerHTML = text; };

  // ---- Free check: result copy. Plain and factual, built from the real scan data. ----
  const S = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
  const HEADS = { A: "No significant issues found", B: "Mostly in good shape", C: "Several issues to address", D: "Significant issues found", F: "Serious issues found" };
  const SEVNAME = { critical: "Critical", high: "High", medium: "Medium", low: "Low", info: "Info" };
  // Same cutoffs as scanner.ts scoreOf()
  const band = (g, score) => { g = String(g || "").trim().toUpperCase().charAt(0); if (/^[ABCDF]$/.test(g)) return g; if (g === "E") return "F";
    const n = Number(score); return n >= 90 ? "A" : n >= 75 ? "B" : n >= 60 ? "C" : n >= 40 ? "D" : "F"; };
  const SITE = "https://deployvet.com/?utm_source=share";
  const siteFor = (how) => `${SITE}&utm_campaign=${how}`; // how = x | native | copy | card, so the numbers show which button worked
  const shareLead = (r, g, withUrl) => `I ran a DeployVet outside security check on ${withUrl && r.url ? r.url : "my site"}: ${r.score}/100 (grade ${g}). Check yours:`;
  const shareText = (r, g, withUrl, how) => `${shareLead(r, g, withUrl)} ${siteFor(how)}`;
  // Context from the real scan data. The result copy is built from this.
  const hostOf = (u) => String(u || "").replace(/^[a-z]+:\/\//i, "").replace(/\/.*$/, "").toLowerCase() || "your app";
  const pathOf = (u, host) => { const s = String(u || "").replace(/^[a-z]+:\/\//i, "").replace(/\/$/, ""); return s.includes("/") ? s : (s || host); };
  // <lockinfo>
  // Counts. Trust a server number only when it is a real finite number: null / "" / undefined / NaN are NOT zero.
  // Total = r.total, else the summed per-severity counts. Locked = r.locked.count, else total minus the worst issue shown.
  const SEVS = ["critical", "high", "medium", "low", "info"];
  const finiteNum = (v) => (typeof v === "number" || (typeof v === "string" && v.trim() !== "")) && Number.isFinite(Number(v)) ? Number(v) : null;
  const sumCounts = (r) => SEVS.reduce((a, k) => a + (finiteNum(((r && r.counts) || {})[k]) || 0), 0);
  const totalOf = (r) => {
    const t = finiteNum(r && r.total), base = t !== null && t >= 0 ? t : sumCounts(r);
    const lc = finiteNum(r && r.locked && r.locked.count);
    return Math.max(base, (lc !== null && lc > 0 ? lc : 0) + (r && r.topIssue ? 1 : 0));   // never fewer issues than the ones we are showing
  };
  // One source of truth for the locked box: the headline number and the chips always describe the same issues.
  function lockInfo(r) {
    const total = totalOf(r), counts = (r && r.counts) || {}, top = r && r.topIssue;
    const lc = finiteNum(r && r.locked && r.locked.count);
    const n = lc !== null && lc >= 0 ? lc : (top ? Math.max(0, total - 1) : total);
    const left = {}; SEVS.forEach((k) => { left[k] = Math.max(0, (finiteNum(counts[k]) || 0) - (top && top.severity === k ? 1 : 0)); });
    const chipSum = SEVS.reduce((a, k) => a + left[k], 0);
    return { total, locked: n, left, chipsOk: chipSum === n };   // chips are shown only when they add up to the headline
  }
  // </lockinfo>
  // <findings>
  // Plain consequence for the person who owns the app. High and critical keep the title only.
  function consequence(f) {
    const hay = `${(f && f.id) || ""} ${(f && f.title) || ""} ${(f && f.category) || ""}`;
    if (/api key|secret|service_role|leaked|token|stripe key|private key/i.test(hay)) return "A key that should stay private is in the public page. Anyone can copy it and use your account.";
    if (/content-security-policy|\bcsp\b|missing_csp/i.test(hay)) return "A browser can run extra code on your page. Someone could slip a fake login or steal what people type.";
    if (/source map|sourcemap/i.test(hay)) return "Your original code is public. Someone can read how the app is built.";
    if (/row level|\brls\b|database|supabase table|open table/i.test(hay)) return "People can read or change rows in your database without an account. That can include your users' info.";
    if (/\.env|environment file|git_exposed|\.git\b|backup/i.test(hay)) return "Project files that should stay private are on the open web. They can hold passwords or show your whole project.";
    if (/https|certificate|\bssl\b|mixed content|not secure/i.test(hay)) return "The browser may warn people the site is not private, and someone on the same network can read what they send.";
    if (/hsts|strict-transport/i.test(hay)) return "A visitor can be sent to the unsafe version of your site before the lock kicks in.";
    if (/x-frame|clickjack|framing/i.test(hay)) return "Another site can hide yours in a frame and trick someone into clicking the wrong thing.";
    if (/cors|access-control/i.test(hay)) return "Other websites may be allowed to call your app and read the answer.";
    if (/\badmin\b/i.test(hay)) return "An admin page answers without a login. A stranger might get in.";
    if (/robots|sitemap|meta description|page title/i.test(hay)) return "Search engines may skip or misread the page. That costs you visitors.";
    if (/broken|404|dead link/i.test(hay)) return "A page or link is dead. People hit a wall and leave.";
    return "This is something a stranger can already see. It can cause trouble for you or the people using the app.";
  }
  function listFindings(r) {
    const raw = Array.isArray(r && r.findings) && r.findings.length ? r.findings : [r && r.topIssue].concat((r && r.locked && r.locked.rows) || []);
    const out = [], seen = new Set();
    raw.forEach((f) => {
      if (!f || !f.title || f.locked === true) return;
      const severity = String(f.severity || "info").toLowerCase();
      const key = severity + "|" + f.title;
      if (seen.has(key)) return;
      seen.add(key);
      const hide = severity === "high" || severity === "critical";
      out.push({ id: String(f.id || ""), title: String(f.title), severity, consequence: consequence(f), fix: hide ? "" : String(f.fix || ""), detail: "", location: "" });
    });
    return out;
  }
  // </findings>
  // <intake>
  function intakeEvent(b) {
    const pack = {
      order_id: String((b && b.order_id) || ""),
      session_id: String((b && b.session_id) || ""),
      email: String((b && b.email) || "").trim(),
      url: String((b && b.url) || "").trim(),
      builder: String((b && b.builder) || ""),
      access: String((b && b.access) || "").trim(),
      notes: String((b && b.notes) || "").trim(),
    };
    while (JSON.stringify(pack).length > 500 && (pack.access.length || pack.notes.length)) {
      if (pack.access.length) pack.access = pack.access.slice(0, Math.max(0, pack.access.length - 40));
      else pack.notes = pack.notes.slice(0, Math.max(0, pack.notes.length - 20));
    }
    return { event: "fix-intake", path: (pack.order_id || pack.session_id || "/thanks").slice(0, 300), referrer: JSON.stringify(pack), utm_source: "fix-intake", utm_campaign: pack.builder.slice(0, 80) };
  }
  // </intake>
  async function saveFixIntake(b) {
    if (b && b.website) return { ok: true, skipped: true };
    const body = { order_id: b.order_id || "", session_id: b.session_id || "", email: String((b && b.email) || "").trim(), url: String((b && b.url) || "").trim(), builder: (b && b.builder) || "", access: String((b && b.access) || "").trim(), notes: String((b && b.notes) || "").trim() };
    try { return await call("fix-intake", body); }
    catch (e) {
      if (e.status !== 404) throw e;
      const res = await fetch(`${C.SUPABASE_URL}/rest/v1/page_events`, {
        method: "POST",
        headers: { apikey: C.SUPABASE_ANON_KEY, authorization: `Bearer ${C.SUPABASE_ANON_KEY}`, "content-type": "application/json", prefer: "return=minimal" },
        body: JSON.stringify(intakeEvent(body)),
      });
      if (!res.ok) throw new Error("We could not save that. Email support@deployvet.com and include your site address.");
      return { ok: true, stored: "page_events" };
    }
  }
  window.DeployVet.saveFixIntake = saveFixIntake;
  const liveEl = document.getElementById("live-checks");
  if (liveEl && configured) {
    call("leaderboard", null, "GET").then((d) => {
      const n = d && d.totals ? Number(d.totals.roasts) : NaN;
      if (!Number.isFinite(n) || n <= 0) return;
      liveEl.hidden = false;
      liveEl.textContent = n.toLocaleString("en-US") + " checks so far";
    }).catch(() => {});
  }
  function ctx(r) {
    const counts = r.counts || {}, t = r.topIssue || {}, host = hostOf(r.url || r.domain);
    const total = totalOf(r);
    const loc = t.location ? pathOf(t.location, host) : "";
    const guess = { env_exposed: "/.env", git_exposed: "/.git/", admin_open: "/admin", ds_store: "/.DS_Store" }[t.id];
    return { host, score: r.score, total, crit: Number(counts.critical) || 0, high: Number(counts.high) || 0,
      title: t.title || "", worst: (t.title || "nothing serious").replace(/\.$/, ""), wpath: loc && loc !== host ? loc : "",
      path: loc && loc !== host ? loc : guess ? host + guess : host };
  }
  const urlForm = document.getElementById("check");
  const out = document.getElementById("check-result");
  const dlgR = document.getElementById("roast");
  let lastFocus = null;

  // One paid offer on the result: $60 and we fix it. A/B (75+) stays calm, with a text link only.
  // The $7 list is a quiet second link when something was found. Real counts only. No invented findings.
  const isGood = (r) => { const g = band(r && r.grade, r && r.score); return g === "A" || g === "B"; };
  function scoreOffer(host, good, where) {
    if (good) return `<p class="soft-fix"><a href="#buy" data-buy="deployvet_fix_for_you" data-domain="${host}" data-track="${where}-fix60-soft">Want us to harden it anyway? $60</a></p>`;
    return `<a class="btn fix-now" href="#buy" data-buy="deployvet_fix_for_you" data-domain="${host}" data-track="${where}-fix60">$60. We fix it for you</a><p class="fix-promise">Fixed within 48 hours or your money back.</p><p class="quiet-list"><a href="#buy" data-buy="deployvet_scan_once" data-domain="${host}" data-track="${where}-list7">Just send me the full list · $7</a></p>`;
  }
  function offersBlock(c, total, where, top, r) {
    const host = esc(c.host);
    if (r && isGood(r)) {
      return `<div class="fixpack calm"${where === "popup" ? ' id="fixpack"' : ""}>
        <p class="fp-h">All clear. Want an email if a later check finds something serious?</p>
        <form class="ra-form" data-domain="${host}">
          <input class="hp" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
          <label for="ra-email-${where}" class="sr">Your email</label>
          <input id="ra-email-${where}" class="ra-email" type="email" required placeholder="you@email.com" autocomplete="email">
          <label class="ra-ok"><input type="checkbox" class="ra-consent" required><span>Yes, email me if a re-check of ${host} finds something serious. We send a confirm link first, and no confirm means no emails. Unsubscribe any time. <a href="/privacy.html">Privacy</a></span></label>
          <button type="submit" class="btn btn-sm btn-lime" data-track="${where}-recheck-alert">Email me re-check alerts</button>
          <div class="ra-result notice" data-ra hidden aria-live="polite"></div>
        </form></div>`;
    }
    if (!(r && r.check_id)) return "";
    return `<div class="fixpack quiet"${where === "popup" ? ' id="fixpack"' : ""}>
      <div class="fu"><p class="fu-h">Email me this result <span>(optional)</span></p>
        <form class="fu-form" data-check="${esc(r.check_id)}">
          <input class="hp" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
          <label for="fu-email-${where}" class="sr">Your email</label>
          <input id="fu-email-${where}" class="fu-email" type="email" required placeholder="you@email.com" autocomplete="email">
          <label class="ra-ok"><input type="checkbox" class="fu-consent" required><span>Send this ${host} result to this address, plus one reminder in 3 days. We send a confirm link first. Nothing else, and no confirm means no emails. Unsubscribe any time. <a href="/privacy.html">Privacy</a></span></label>
          <button type="submit" class="btn btn-sm btn-lime" data-track="${where}-followup">Email me this result</button>
          <div class="fu-result notice" data-fu hidden aria-live="polite"></div>
        </form></div></div>`;
  }
  // Re-check alert (A/B grades): same double opt-in newsletter flow, an unticked box, and a clear sentence of what the person is agreeing to.
  document.addEventListener("submit", async (e) => {
    const f = e.target.closest(".ra-form"); if (!f) return;
    e.preventDefault(); const btn = f.querySelector("button[type=submit]"), res = f.querySelector("[data-ra]");
    if (!f.querySelector(".ra-consent").checked) { msg(res, "Tick the box so we know you want the heads-up.", "err"); return; }
    busy(btn, true, "Sending…");
    try {
      await call("newsletter", { email: f.querySelector(".ra-email").value, source: "recheck-alert", domain: f.dataset.domain, website: f.querySelector("[name=website]").value || "" });
      msg(res, "Check your inbox (and spam or promotions) for the confirm link. No confirm, no emails.", "ok"); f.querySelector(".ra-email").value = ""; f.querySelector(".ra-consent").checked = false;
    } catch (err) { msg(res, esc(err.status === 400 ? "That email doesn't look right." : friendly(err)), "err"); }
    busy(btn, false);
  });
  // Follow-up (C/D/F): unticked box, double opt-in through the newsletter function, tied to this check (check_id). Nothing is sent before the person confirms.
  document.addEventListener("submit", async (e) => {
    const f = e.target.closest(".fu-form"); if (!f) return;
    e.preventDefault(); const btn = f.querySelector("button[type=submit]"), res = f.querySelector("[data-fu]");
    if (!f.querySelector(".fu-consent").checked) { msg(res, "Tick the box so we know you want the emails.", "err"); return; }
    busy(btn, true, "Sending…");
    try {
      await call("newsletter", { email: f.querySelector(".fu-email").value, followup_check_id: f.dataset.check, website: f.querySelector("[name=website]").value || "" });
      msg(res, "Check your inbox (and spam or promotions) for the confirm link. No confirm, no emails.", "ok"); f.querySelector(".fu-email").value = ""; f.querySelector(".fu-consent").checked = false;
    } catch (err) { msg(res, esc(err.status === 400 ? "That didn't work. Check the email, or run the check again." : friendly(err)), "err"); }
    busy(btn, false);
  });
  const rrBox = (tag, host) => `<${tag}>Re-check reminder</${tag}><form class="rr" id="rr-form">
          <input class="hp" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
          <div class="rr-row"><label for="rr-email" class="sr">Email</label><input id="rr-email" type="email" required placeholder="you@email.com" autocomplete="email">
          <button type="submit" class="btn btn-sm btn-lime" data-track="reroast-email">Email me</button></div>
          <p class="small rr-ok">We email a confirm link first. No confirm, no emails. After that: occasional security tips and a reminder to re-check ${host}. Unsubscribe any time. <a href="/privacy.html">Privacy</a></p>
          <div id="rr-result" class="notice" hidden aria-live="polite"></div>
        </form>`;
  function openRoast(r) {
    const g = band(r.grade, r.score), c = ctx(r), t = r.topIssue, total = totalOf(r), good = isGood(r);
    const counts = r.counts || {}, order = ["critical", "high", "medium", "low", "info"];
    const chips = order.filter((k) => counts[k]).map((k) => `<span class="sev ${k}">${esc(counts[k])} ${esc(SEVNAME[k])}</span>`).join("");
    const named = listFindings(r);
    const extra = Math.max(0, total - named.length);
    const head = good || (!named.length && !total) ? "All clear" : HEADS[g];
    const sub = good || (!named.length && !total)
      ? `${c.host} scored ${r.score}/100. Nothing serious showed up. That is not a promise the app is safe. It means this check did not find a serious problem.`
      : `${c.host} scored ${r.score}/100. ${S(total, "issue")} showed up.`;
    let burns = named.map((f) => `<li class="note">
      <span class="sev ${esc(f.severity)}">${esc(SEVNAME[f.severity] || f.severity)}</span>
      <p class="burn-l">${esc(f.title)}</p>
      <p class="what">${esc(f.consequence)}</p>
      ${f.fix ? `<div class="fixbox"><b>What to change</b><p>${esc(f.fix)}</p></div>` : (f.severity === "high" || f.severity === "critical" ? `<p class="lockline">The exact change is part of the $60 fix.</p>` : "")}
    </li>`).join("");
    if (extra) burns += `<li class="note unnamed"><p class="burn-l">${esc(extra)} more ${extra === 1 ? "issue" : "issues"} showed up</p><p class="what">This free check did not include ${extra === 1 ? "its name" : "their names"}.</p></li>`;
    const site = esc(r.url || c.host);
    dlgR.className = "roast g-" + g;
    document.getElementById("roast-body").innerHTML = `
      <div class="r-card">
        <p class="r-label">Free check · ${site}</p>
        <div class="r-top"><div class="r-ring" style="--p:${Math.max(0, Math.min(100, Number(r.score) || 0))}"><span class="r-score">${esc(r.score)}<small>/100</small></span></div><span class="r-grade" aria-label="Grade ${esc(g)}">${esc(g)}</span></div>
        ${scoreOffer(site, good, "popup")}
        <h2 class="r-head" id="roast-head">${esc(head)}</h2>
        <p class="r-sub">${esc(sub)}</p>
        <div class="r-counts">${chips || '<span class="sev low">0 issues</span>'}</div>
        ${r.message ? `<p class="small">${esc(r.message)}</p>` : ""}
        <ol class="r-burns">${burns}</ol>
      </div>
      ${offersBlock(c, total, "popup", t, r)}
      ${good ? `<section class="bdg-box" id="bdg-box" hidden><h3>Show this result on your site</h3><div id="bdg"></div></section>` : ""}
      <details class="more"><summary data-track="more-open">Share, reminders and public listing</summary><div>
        <h3>Share this result</h3>
        <div class="r-actions">
          <button type="button" class="btn btn-sm btn-line" id="share-main" hidden>Share</button>
          <button type="button" class="btn btn-sm btn-line" data-track="share-copy" id="share-copy">Copy text</button>
          <button type="button" class="btn btn-sm btn-line" data-track="roast-card" id="roast-card">Download card (PNG)</button>
        </div>
        <label class="share-opt"><input type="checkbox" id="share-url"> Include my site's web address</label>
        <span class="share-note small" id="share-note" aria-live="polite"></span>
        ${good ? "" : rrBox("h3", esc(c.host))}
        ${r.check_id ? `<h3>Public scores</h3><div class="qj" id="qj">
          <p class="small">Optional. List your score and grade on the public scores page. Your domain stays hidden as <code>${esc(maskDomain(c.host))}</code> unless you verify ownership.</p>
          <form id="qj-form" class="qj-form">
            <label for="qj-name" class="sr">Nickname (optional)</label><input id="qj-name" maxlength="40" value="" placeholder="Nickname (optional)" autocomplete="off">
            <button type="submit" class="btn btn-sm btn-line qj-btn" data-track="board-quick">List my score</button>
          </form>
          <div id="qj-result" class="notice" hidden aria-live="polite"></div>
        </div>` : ""}
        <p class="small"><button type="button" class="linkbtn" data-track="scoreboard-join" id="join-open">Verify you own this site</button> to show your full domain on the public scores page with a Verified label.</p>
        <div class="join" id="join" hidden>
          <h3>Verify you own this site</h3>
          <p class="small">Optional. Prove you control the site and the public scores page shows your full domain with a Verified label. You can leave any time.</p>
          <form id="join-form"><label for="j-domain">Your domain</label><input id="j-domain" required autocomplete="url" placeholder="your-site.com" value="${esc(r.url || "")}">
            <label for="j-name">Display name <span class="opt">(optional)</span></label><input id="j-name" maxlength="40" placeholder="Shown instead of your domain">
            <div><button type="submit" class="btn btn-sm">Next: verify</button></div></form>
          <div id="join-step2" hidden></div>
          <div id="join-result" class="notice" hidden aria-live="polite"></div>
          <p class="small leave"><a href="#" id="leave-open" data-track="scoreboard-leave">Remove my site</a> from the public scores page</p>
        </div>
      </div></details>`;
    lastFocus = document.activeElement;
    dlgR.showModal();
    dlgR.querySelector(".roast-scroll").scrollTop = 0;
    dlgR.querySelector(".close").focus();
    const withUrl = () => document.getElementById("share-url").checked;
    const note = document.getElementById("share-note");
    const main = document.getElementById("share-main");
    const canNative = typeof navigator.share === "function" && (matchMedia("(max-width: 820px)").matches || /Mobi|Android/i.test(navigator.userAgent));
    if (canNative) {
      main.hidden = false; main.dataset.track = "share-native";
      main.addEventListener("click", async () => { try { await navigator.share({ text: shareLead(r, g, withUrl()), url: siteFor("native") }); } catch (e) { if (e.name !== "AbortError") note.textContent = "Sharing is not available here. Use Copy text."; } });
    }
    document.getElementById("share-copy").addEventListener("click", async () => {
      const tx = shareText(r, g, withUrl(), "copy");
      try { await navigator.clipboard.writeText(tx); note.textContent = "Copied."; } catch (_) { window.prompt("Copy this:", tx); }
    });
    if (good && window.DeployVetBadge) {
      const dom = window.DeployVetBadge.norm(c.host);
      window.DeployVetBadge.info(dom, true).then((i) => { if (!i) return; document.getElementById("bdg-box").hidden = false; window.DeployVetBadge.render(document.getElementById("bdg"), dom, i, { compact: true, id: "pop" }); }).catch(() => {});
    }
    document.getElementById("roast-card").addEventListener("click", () => roastCard({ score: r.score, grade: g, host: c.host, head, sub: t ? t.title : "No serious issues found" }).catch((e) => { note.textContent = "Could not make the card: " + e.message; }));
    joinFlow(r);
    quickJoin(r);
    if (document.getElementById("rr-form")) reRoast(r, c);
  }

  // Result card: 1200x630 PNG drawn in the browser.
  async function drawCard({ score, grade, host, head, sub }) {
    const W = 1200, H = 630, cv = document.createElement("canvas"); cv.width = W; cv.height = H;
    const x = cv.getContext("2d");
    const F = 'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
    const gc = { A: "#17703f", B: "#17703f", C: "#8a5a00", D: "#b4400f", F: "#b42318" }[grade] || "#0b2545";
    x.fillStyle = "#fff"; x.fillRect(0, 0, W, H);
    x.fillStyle = "#0b2545"; x.fillRect(0, 0, 18, H);
    x.fillStyle = gc; x.fillRect(18, 0, 6, H);
    x.textBaseline = "alphabetic"; x.textAlign = "left";
    x.fillStyle = "#0b2545"; x.font = `700 40px ${F}`; x.fillText("DeployVet", 80, 100);
    x.fillStyle = "#475569"; x.font = `500 28px ${F}`; x.fillText("Website security and bug check", 80, 146);
    x.fillStyle = "#0b2545"; x.font = `700 220px ${F}`; x.fillText(String(score), 76, 400);
    const sw = x.measureText(String(score)).width; x.font = `500 52px ${F}`; x.fillStyle = "#64748b"; x.fillText("/100", 90 + sw, 400);
    x.fillStyle = gc; x.fillRect(900, 190, 190, 190); x.fillStyle = "#fff"; x.font = `700 130px ${F}`; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText(grade, 995, 290);
    x.textAlign = "left"; x.textBaseline = "alphabetic";
    const wrap = (t, X, Y, maxW, lh, maxLines) => { const words = String(t).split(/\s+/); let line = "", n = 0;
      for (let i = 0; i < words.length; i++) { const test = line ? line + " " + words[i] : words[i];
        if (x.measureText(test).width > maxW && line) { if (++n === maxLines) { x.fillText(line + "…", X, Y); return Y; } x.fillText(line, X, Y); line = words[i]; Y += lh; } else line = test; }
      x.fillText(line, X, Y); return Y; };
    x.fillStyle = "#0b2545"; x.font = `650 46px ${F}`;
    const y = wrap(head, 80, 476, 1040, 52, 1);
    x.fillStyle = "#475569"; x.font = `400 30px ${F}`; wrap(sub, 80, y + 48, 1040, 38, 1);
    x.fillStyle = "#64748b"; x.font = `400 24px ${F}`;
    x.fillText(`Outside-in check, not a security audit or certification  ·  ${new Date().toISOString().slice(0, 10)}  ·  deployvet.com`, 80, 590);
    return cv;
  }
  async function roastCard(d) {
    const cv = await drawCard(d);
    const blob = await new Promise((res) => cv.toBlob(res, "image/png"));
    const file = new File([blob], `deployvet-check-${d.score}.png`, { type: "image/png" });
    const mobile = matchMedia("(max-width: 820px)").matches || /Mobi|Android/i.test(navigator.userAgent);
    if (mobile && navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], text: `DeployVet outside check: ${d.score}/100. Check yours: ${siteFor("card")}` }); return; } catch (e) { if (e.name === "AbortError") return; }
    }
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = file.name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  window.DeployVet.drawCard = drawCard;

  // Public scores join: join -> verify instructions -> confirm. Leave: same proof, two calls. Spec: app/LEADERBOARD.md
  const proofHtml = (j, what) => {
    const i = j.instructions || {}, t = i.dns_txt || {};
    return `<p><b>Prove you own ${esc(j.domain)}.</b> Add <b>one</b> of these, then hit ${what}.</p>
      <p class="small">Option 1: a DNS TXT record on <code>${esc(t.host)}</code></p><pre class="code">${esc(t.value)}</pre>
      <p class="small">Option 2: this meta tag in the &lt;head&gt; of your home page</p><pre class="code">${esc(i.meta_tag)}</pre>
      <p class="small">The token works once and lasts 7 days. DNS can take a few minutes.</p>`;
  };
  function maskDomain(d) { const p = String(d).split("."); return `${(p[0] || "?").charAt(0)}*******${p.length > 1 ? "." + p.at(-1) : ""}`; }
  // "Listed at #3 in lowest scores". Same split (70) and tie rules as the public scores page.
  function boardRank(d, en) {
    const fame = en.score >= 70, rows = ((fame ? d.fame : d.flame) || []);
    const i = rows.findIndex((x) => (en.id && x.id === en.id) || (!en.id && x.masked === en.masked && x.display_name === en.display_name && x.score === en.score));
    if (i < 0) return "";
    const rank = rows.findIndex((x) => x.score === rows[i].score) + 1;
    return `Listed at #${rank} in ${fame ? "highest" : "lowest"} scores`;
  }
  function quickJoin(r) {
    const f = document.getElementById("qj-form"); if (!f) return;
    const res = document.getElementById("qj-result");
    f.addEventListener("submit", async (e) => {
      e.preventDefault(); const btn = f.querySelector("button[type=submit]"); res.hidden = true;
      busy(btn, true, "Listing…");
      try {
        const nickname = document.getElementById("qj-name").value.trim();
        const j = await call("leaderboard", { action: "join_quick", check_id: r.check_id, nickname: nickname || undefined }); // no score sent, ever
        const en = j.entry || {};
        f.hidden = true;
        let where = "";
        try { where = boardRank(await call("leaderboard", null, "GET"), en); } catch (_) {}
        msg(res, `${where ? esc(where) : "Listed"} as <b>${esc(en.display_name || en.masked)}</b>. <a href="/scoreboard.html">See public scores</a>`, "ok");
      } catch (err) { msg(res, esc(err.status === 409 ? "That site is already listed. There is one entry per site." : friendly(err)), "err"); busy(btn, false); }
    });
  }
  function reRoast(r, c) {
    const f = document.getElementById("rr-form"), res = document.getElementById("rr-result");
    f.addEventListener("submit", async (e) => {
      e.preventDefault(); const btn = f.querySelector("button[type=submit]"); res.hidden = true;
      busy(btn, true, "Sending…");
      try {
        await call("newsletter", { email: document.getElementById("rr-email").value, source: "popup", domain: c.host, website: f.querySelector("[name=website]").value || "" });
        msg(res, "Check your inbox (and spam or promotions) for the confirm link. No confirm, no emails.", "ok"); f.querySelector("#rr-email").value = "";
      } catch (err) { msg(res, esc(err.status === 400 ? "That email does not look right." : friendly(err)), "err"); }
      busy(btn, false);
    });
  }
  function joinFlow(r) {
    const box = document.getElementById("join"), res = document.getElementById("join-result"), step2 = document.getElementById("join-step2");
    const form = document.getElementById("join-form"), dom = document.getElementById("j-domain");
    const clear = () => { res.hidden = true; };
    document.getElementById("join-open").addEventListener("click", () => { box.hidden = false; dom.focus(); });
    form.addEventListener("submit", async (e) => {
      e.preventDefault(); clear(); const btn = form.querySelector("button[type=submit]");
      const domain = dom.value.trim(), display_name = document.getElementById("j-name").value.trim();
      if (!domain) { msg(res, "Type your domain first, like your-site.com.", "err"); return; }
      busy(btn, true, "Saving…");
      try {
        const j = await call("leaderboard", { action: "join", domain, display_name: display_name || undefined });
        step2.hidden = false;
        step2.innerHTML = proofHtml(j, "Check now") + `<button type="button" class="btn btn-sm btn-lime" id="join-confirm" data-track="scoreboard-confirm">Check now</button>`;
        const go = document.getElementById("join-confirm"); go.focus();
        go.addEventListener("click", async () => {
          clear(); busy(go, true, "Checking…");
          try {
            const c = await call("leaderboard", { action: "confirm", domain: j.domain });
            const en = c.entry || {};
            msg(res, c.listed === false
              ? `Verified, score ${esc(en.score)} (${esc(en.grade)}). Your site is hidden by a moderator for now, so it will not show on the public scores page. Questions? <a href="mailto:support@deployvet.com">support@deployvet.com</a>`
              : `Verified and listed. ${esc(en.display_name || en.domain)} scored ${esc(en.score)} (${esc(en.grade)}) on a fresh scan. <a href="/scoreboard.html">See public scores</a>`, "ok");
            step2.hidden = true;
          } catch (err) { msg(res, esc(friendly(err)), "err"); }
          busy(go, false);
        });
      } catch (err) { msg(res, esc(friendly(err)), "err"); }
      busy(btn, false);
    });
    document.getElementById("leave-open").addEventListener("click", async (ev) => {
      ev.preventDefault(); clear();
      const domain = dom.value.trim(); if (!domain) { msg(res, "Type your domain above first.", "err"); dom.focus(); return; }
      const link = ev.currentTarget; link.setAttribute("aria-disabled", "true");
      try {
        const l = await call("leaderboard", { action: "leave", domain });
        if (l.removed) { step2.hidden = true; msg(res, "Done. Your site is off the public scores page. You can delete the token now.", "ok"); }
        else { step2.hidden = false; step2.innerHTML = proofHtml(l, "Remove my site again") + `<p class="small">This is a new token, just for leaving.</p>`; msg(res, "Almost gone. Add the new token, then click Remove my site again.", ""); }
      } catch (err) { msg(res, esc(friendly(err)), "err"); }
      link.removeAttribute("aria-disabled");
    });
  }

  if (dlgR) {
    dlgR.querySelector(".close").addEventListener("click", () => dlgR.close());
    dlgR.addEventListener("close", () => { if (lastFocus) lastFocus.focus(); });
    dlgR.addEventListener("keydown", (e) => { // keep Tab inside the modal
      if (e.key !== "Tab") return;
      const f = [...dlgR.querySelectorAll("a[href],button:not([disabled]),input:not([type=hidden]),textarea,select")].filter((el) => el.offsetParent !== null || el.classList.contains("close"));
      if (!f.length) return; const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
  }

  if (urlForm) urlForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = urlForm.querySelector("button[type=submit]");
    const url = urlForm.querySelector("#url").value;
    out.hidden = true;
    busy(btn, true, "Checking…");
    try {
      const r = await call("free-check", { url, visitor: (() => { try { return sessionStorage.getItem("dv_v") || undefined; } catch (_) { return undefined; } })(), website: urlForm.querySelector("[name=website]")?.value || "" });
      if (r.blocked) {   // firewall / bot challenge: nothing honest to grade, so show no score
        out.hidden = false; out.className = "result-offers";
        out.innerHTML = `<p class="ro-h">Blocked by a firewall / bot challenge</p><p class="small">${esc(r.message)}</p>`;
        busy(btn, false); return;
      }
      openRoast(r);
      // Same two offers inline under the form, so they are still there when the popup closes.
      const cc = ctx(r), tot = totalOf(r);
      const good = isGood(r);
      out.hidden = false; out.className = "result-offers"; out.innerHTML = `<p class="ro-h">${good ? "All clear" : "Free check done"} for ${esc(cc.host)}: ${esc(r.score)}/100.</p>`
        + (r.cached && r.rescan_in_hours ? `<p class="small">This is your latest free check. A new free check is available in about ${esc(r.rescan_in_hours)} hour${r.rescan_in_hours === 1 ? "" : "s"}.</p>` : "")
        + (r.incomplete ? `<p class="small">${esc(r.incompleteNote || "Part of your site sits behind a firewall, so this score may be incomplete.")}</p>` : "")
        + scoreOffer(esc(r.url || cc.host), good, "result")
        + offersBlock(cc, tot, "result", r.topIssue, r);
    } catch (err) { msg(out, esc(err.message), "err"); }
    busy(btn, false);
  });

  // When the checkout opens from inside the results modal, close it so only one modal shows.
  document.addEventListener("click", (e) => { if (e.target.closest("#roast [data-buy]") && dlgR.open) dlgR.close(); }, true);
  // Locked rows: take the person to the two offers in the popup (the Scan / Fix it pack buttons).
  document.addEventListener("click", (e) => {
    const row = e.target.closest("#roast .ph"); if (!row) return;
    const fp = document.getElementById("fixpack"); if (!fp) return;
    fp.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" });
    fp.classList.remove("pulse"); void fp.offsetWidth; fp.classList.add("pulse");
  });

  // ---- Newsletter ----
  const mailForm = document.querySelector(".mail-form");
  if (mailForm) mailForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = mailForm.querySelector("button"), note = document.getElementById("mail-result");
    busy(btn, true, "Sending…");
    try {
      const r = await call("newsletter", { email: mailForm.querySelector("#email").value, source: "site", website: mailForm.querySelector("[name=website]")?.value || "" });
      msg(note, "Almost done: we sent a confirm link. If you don't see it in a minute, check spam or promotions.", "ok"); mailForm.reset();
    } catch (err) { msg(note, esc(err.message), "err"); }
    busy(btn, false);
  });
  const nl = new URLSearchParams(location.search).get("newsletter");
  if (nl) msg(document.getElementById("mail-result"), { confirmed: "You're subscribed. Thanks!", unsubscribed: "You're unsubscribed. Sorry to see you go.", invalid: "That link didn't work. It may have expired." }[nl] || "", nl === "invalid" ? "err" : "ok");

  const fb = new URLSearchParams(location.search).get("followup");
  if (fb) { const m = { confirmed: ["Confirmed. Your email is on its way.", "ok"], unsubscribed: ["You're unsubscribed. We will not email you about that check again.", "ok"], invalid: ["That link didn't work. It may have expired.", "err"] }[fb];
    if (m) { const n = document.createElement("div"); n.className = "notice co-cancel " + m[1]; n.setAttribute("role", "status"); n.textContent = m[0]; (document.querySelector("main") || document.body).prepend(n); } }

  // ---- Checkout (Scan / Fix it pack): email first, domain prefilled, price on the button, short trust line ----
  const dlg = document.getElementById("buy");
  // create-checkout must accept deployvet_fix_for_you. Use inline price_data and do not change existing prices:
  // { currency: "usd", unit_amount: 6000, product_data: { name: "We fix it for you" } }
  const OFFER = {
    deployvet_fix_for_you: { name: "We fix it for you", price: "$60", what: "We fix the problems this check found. Fixed within 48 hours of getting access, or your money back.", trust: "One-time $60. Nothing renews." },
    deployvet_pro_29: { name: "DeployVet Pro", price: "$29/mo", what: "Every issue with its fix for up to 5 sites, a check every week, and an email when something new shows up.", trust: "$29 a month. Cancel any time from your account." },
    deployvet_scan_once: { name: "DeployVet Scan", price: "$7", what: "What the deeper check finds, with evidence and a fix, and fix prompts for your builder.", trust: "One-time $7. No subscription, nothing renews." },
    deployvet_fix_pack: { name: "DeployVet Fix it pack", price: "$10", what: "The full report with copyable fix prompts and 30 days of re-checks.", trust: "One-time $10. No subscription, nothing renews." },
  };
  const hostShow = (u) => String(u || "").replace(/^https?:\/\//i, "").replace(/\/.*$/, "");
  const getEmail = () => { try { return localStorage.getItem("dv_email") || ""; } catch (_) { return ""; } };
  document.addEventListener("click", (e) => {
    const a = e.target.closest("[data-buy]"); if (!a || !dlg) return;
    e.preventDefault();
    const product = OFFER[a.dataset.buy] ? a.dataset.buy : "deployvet_scan_once", o = OFFER[product];
    dlg.querySelector("[name=product]").value = product;
    dlg.querySelector("#buy-title").textContent = `${o.name.replace("DeployVet ", "")} · ${o.price}${o.price.includes("/") ? "" : " once"}`;
    dlg.querySelector("#buy-what").textContent = "You get: " + o.what;
    const hint = dlg.querySelector("#b-email-hint");
    if (hint) hint.textContent = product === "deployvet_fix_for_you" ? "(so we can reach you about the fix)" : product === "deployvet_pro_29" ? "(the report is sent here)" : "(we email a link to the report here)";
    const afterPay = product === "deployvet_fix_for_you"
      ? " After you pay, a short form asks how we get in (a GitHub invite or a collaborator invite). You do not have to add a DNS record before we start."
      : product === "deployvet_pro_29"
      ? " After you pay on Stripe, you confirm you own the site (one DNS record or meta tag), then Pro turns on."
      : " You pay on Stripe first. You prove you own the site (one DNS record or meta tag), unless we already verified it. Then an automated check runs. We email a link to the report when it is ready. You can print or save a PDF from that page.";
    dlg.querySelector("#buy-trust").textContent = product === "deployvet_fix_for_you" ? `${o.trust}${afterPay}` : `${o.trust} We only take a read-only look at your public site.${afterPay}`;
    dlg.querySelector("#buy-pay").innerHTML = `Pay ${o.price} on Stripe <span aria-hidden="true">→</span>`;
    const u = a.dataset.domain || document.getElementById("url")?.value || "";
    const dom = dlg.querySelector("[name=domain]"); dom.value = u;
    const known = !!u && /\./.test(u);
    dlg.querySelector("#b-for").hidden = !known; dlg.querySelector("#b-domain-wrap").hidden = known;
    dlg.querySelector("#b-host").textContent = hostShow(u);
    const em = dlg.querySelector("[name=email]"); if (!em.value) em.value = getEmail();
    document.getElementById("buy-result").hidden = true;
    dlg.showModal ? dlg.showModal() : dlg.setAttribute("open", "");
    if (!em.value) em.focus();
  });
  if (dlg) {
    dlg.querySelector(".close").addEventListener("click", () => dlg.close());
    dlg.querySelector("#b-change").addEventListener("click", () => { dlg.querySelector("#b-for").hidden = true; dlg.querySelector("#b-domain-wrap").hidden = false; dlg.querySelector("[name=domain]").focus(); });
    dlg.querySelector("form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const f = new FormData(e.target), btn = e.target.querySelector("button[type=submit]");
      const body = { product: f.get("product"), email: f.get("email"), domain: f.get("domain"), builder: f.get("builder"), ...attrib() };
      if (f.get("repo_url")) body.repo_url = f.get("repo_url");
      if (f.get("supabase_url")) body.supabase_url = f.get("supabase_url");
      busy(btn, true, "Opening Stripe…");
      try {
        const r = await call("create-checkout", body);
        try { localStorage.setItem("dv_email", String(body.email || "").trim()); } catch (_) {}
        const order = { order_id: r.order_id, site_id: r.site_id, verify_token: r.verify_token, domain: body.domain, email: body.email, product: body.product };
        if (body.product === "deployvet_fix_for_you") order.pack = "fix";
        sessionStorage.setItem("dv_order", JSON.stringify(order));
        location.href = r.url; // Stripe Checkout. The $60 fix collects access on the thanks page. Scans still wait for domain proof.
      } catch (err) {
        if (body.product === "deployvet_pro_29" && !(err.status >= 400 && err.status < 500)) { location.href = "https://buy.stripe.com/14A4gz2vR4zU2qG2GLes001"; return; } // backend down: fall back to the Stripe Payment Link
        const unknown = body.product === "deployvet_fix_for_you" && /unknown product/i.test(err.message || "");
        msg(document.getElementById("buy-result"), esc(unknown ? "The $60 card form is not switched on yet. Email support@deployvet.com with your site address and we will send a pay link. Nothing was charged." : err.message), "err"); busy(btn, false); }
    });
  }
  // Back from Stripe without paying: say so plainly.
  if (new URLSearchParams(location.search).get("checkout") === "canceled") {
    const n = document.createElement("div"); n.className = "notice ok co-cancel"; n.setAttribute("role", "status");
    n.innerHTML = `Checkout canceled. Nothing was charged. Questions? <a href="mailto:support@deployvet.com">support@deployvet.com</a> <button type="button" class="linkbtn" aria-label="Dismiss">Dismiss</button>`;
    n.querySelector("button").addEventListener("click", () => n.remove());
    document.body.prepend(n);
  }
})();
