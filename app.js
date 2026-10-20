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
  // Friendly text for scoreboard errors. 400 messages from the server are already plain and specific.
  const friendly = (e) => {
    if (e.status === 429) return "Whoa, slow down. Too many tries from your network today. Come back tomorrow.";
    if (e.status === 502) return "We couldn't scan your site just now. Is it up? Try again in a minute.";
    if (e.status === 404) return "That site isn't on the scoreboard, so there's nothing to remove.";
    if (e.status === 403) return "We can't see your token yet. DNS can take a few minutes. Check it's there, then try again.";
    if (e.status === 405 || e.status >= 500) return "Our side tripped. Please try again in a bit.";
    if (e.status) return e.message;
    return "Couldn't reach DeployVet. Check your connection and try again.";
  };
  window.DeployVet = { call, esc, friendly };

  const busy = (btn, on, label) => { if (!btn) return; if (on) { btn.dataset.l = btn.innerHTML; btn.disabled = true; btn.textContent = label; } else { btn.disabled = false; btn.innerHTML = btn.dataset.l || btn.innerHTML; } };
  const msg = (el, text, kind) => { if (!el) return; el.hidden = false; el.className = "notice " + (kind || ""); el.innerHTML = text; };

  // ---- Free roast ----
  // Roast lines: [headline, subline] per spice level and grade band. Roast the APP, never the person. No crude stuff.
  const ROASTS = {
    mild: {
      A: [["Honestly? Nice work.", "We came to roast and found almost nothing. Your app is buttoned up."], ["Clean plate.", "Your app kept its keys in its pocket. Gold star."], ["Not much to roast here.", "Hackers would get bored fast. That's a compliment."]],
      B: [["Pretty solid, one loose thread.", "Your app is mostly ready. A small fix and you're there."], ["Good, with a small to-do.", "Your app left a sock on the floor. Pick it up and you're done."], ["Almost honor roll.", "Your app did the homework. It skipped one page."]],
      C: [["Middle of the road.", "Some doors are unlocked. Easy fixes, though."], ["Okay, but let's tidy up.", "Your AI wrote the code and took a long lunch."], ["Fixable, for sure.", "A short list stands between you and a safe launch."]],
      D: [["A bit leaky.", "A few things are open that shouldn't be. Let's close them."], ["Needs some love.", "Your app trusts strangers a little too much."], ["Let's patch a few holes.", "Nothing a calm afternoon can't fix."]],
      F: [["Okay, this one needs work.", "Good news: you checked before someone else did."], ["Lots to fix, but you've got this.", "Start with the worst issue below."], ["Your app is wide open right now.", "Take it one fix at a time."]],
    },
    spicy: {
      A: [["We tried. We really tried.", "Your app gave us nothing to roast. Rude, honestly."], ["Survived the roast.", "Locked doors, hidden keys. Who raised this app so well?"], ["Main character energy, but secure.", "Hackers took one look and went somewhere easier."]],
      B: [["So close it hurts.", "Your app has one button undone and it's doing its best."], ["Good vibes, one side quest.", "Your app is 90% fine and 10% 'oh, about that.'"], ["B for 'barely leaking'.", "One small leak. Patch it before launch day."]],
      C: [["Mid. Very mid.", "Your app has the security of a phone with no lock screen."], ["It's giving 'ship now, patch later'.", "Later is here. Good news: the list is short."], ["C for 'could be worse'.", "And it could be a lot better. Let's go."]],
      D: [["Your app is out here trusting strangers.", "Like a golden retriever. Sweet, but no."], ["D for 'doors open'.", "The welcome mat is out and so is your data."], ["Your AI was very confident.", "The code was less sure."]],
      F: [["Your app is open for business. All of it.", "Front door, back door, the database. Good thing you checked first."], ["F for 'free real estate'.", "Your app is sharing more than a group chat at 2am."], ["The vibes were coded. The locks were not.", "Totally fixable. Start below."]],
    },
    nuclear: {
      A: [["We brought the flamethrower for nothing.", "Your app is so locked down it's almost boring. Respect."], ["Fireproof. Annoyingly.", "We searched every corner. Your app just stared back."], ["Roast cancelled. Not enough fuel.", "This app takes security more seriously than most banks we've seen."]],
      B: [["One crack, and we found it.", "Your app was one fix from untouchable. Now it's one fix from untouchable and roasted."], ["Close. Not close enough to escape.", "Your app locked the house and left a window open."], ["Almost perfect, which is the funniest kind.", "So much work, and then this."]],
      C: [["Your app's security is a group project nobody finished.", "Some parts are great. Some parts are a sticky note that says 'TODO'."], ["Average is a choice.", "Your app picked 'it works on my machine' as its security model."], ["This app runs on hope.", "Hope is not a security header."]],
      D: [["Your app is a screen door on a submarine.", "It looks like a door. It does not act like one."], ["Hackers would leave a thank-you note.", "Your app does half their work for them."], ["This isn't a bug. It's a buffet.", "Strangers can help themselves. Let's close the kitchen."]],
      F: [["Your app isn't leaking. It's a sprinkler.", "Keys, data, files. Everyone gets some."], ["Your app has the security of a public diary.", "With a sign that says 'please read'. Fix below, fast."], ["We've seen sandcastles with better walls.", "And the tide is coming. Start with the fix below."]],
    },
  };
  // Burns per finding category (from scanner.ts). Specific ids override the category.
  const BURNS = {
    secrets: ["A secret key is sitting in your public code.", "Your secret key is in the JS bundle. Anyone can copy it, and the bill is yours.", "Your API key is more public than your landing page."],
    database: ["Some of your database can be read without a login.", "Your database is open to anyone who asks nicely. Or rudely.", "Your database has no lock. It barely has a door."],
    headers: ["A few security headers are missing.", "No security headers at all. Bold choice.", "Your headers are as empty as a hackathon fridge at 4am."],
    transport: ["Some traffic isn't using HTTPS.", "Plain HTTP in this economy?", "Your app talks in plain text like it's 1999."],
    exposure: ["A private file or route is reachable by strangers.", "Your private stuff is one URL away from the whole internet.", "Your app left its diary open on the bus."],
    links: ["Some pages or links are broken.", "Links that go nowhere. Very mysterious. Very broken.", "Your app has more dead ends than a corn maze."],
    seo: ["Search engines can't read you well.", "Google can't find you. That's the one thing that should find you.", "Your app is hiding from Google better than from hackers."],
    info: ["A small detail leaks out.", "Your app overshares about its tech stack.", "Your app announces its whole tech stack like a dating profile."],
  };
  const ID_BURNS = {
    env_exposed: ["Your .env file can be downloaded.", "Your .env file is public. Every secret, one click away.", "Your .env file is basically a press release."],
    git_exposed: ["Your .git folder is public.", "Your whole source code history is public. Every commit. Every regret.", "Your .git folder is open. That's every commit, including the 'oops' ones."],
    supabase_rls_readable: ["A table can be read without a login.", "RLS is off. Your users' data is a public spreadsheet.", "Your table is so open it should have a guestbook."],
    admin_open: ["/admin loads without a login.", "Your admin page has no bouncer.", "Your admin panel is open to the public. Even the cat could get in."],
    stripe_live_secret: ["A live Stripe secret key is in public code.", "Your live Stripe key is public. That's your money, not a demo.", "You put your Stripe live key in the browser. It's like taping your card to a lamppost."],
    missing_csp: ["No Content-Security-Policy header.", "No CSP. Any script can show up and run.", "No CSP. Your page runs whatever script shows up."],
    no_https: ["Your site isn't on HTTPS.", "No HTTPS. Every password goes out in plain text.", "No HTTPS. Your login form sends passwords on a postcard."],
  };
  const COUNT_BURNS = {
    critical: (n, s) => [`${n} critical issue${n > 1 ? "s" : ""}. Fix these first.`, `${n} critical. This one's a fire, not a burn.`, `${n} critical. Somewhere a hacker just got excited.`][s],
    high: (n, s) => [`${n} high issue${n > 1 ? "s" : ""} to look at.`, `${n} high. That's ${n} open door${n > 1 ? "s" : ""}.`, `${n} high. Your app is one tweet away from trending, for the wrong reason.`][s],
    medium: (n, s) => [`${n} medium issue${n > 1 ? "s" : ""}.`, `${n} medium. Not on fire, but warm.`, `${n} medium. Smoldering, not quite flames.`][s],
    low: (n, s) => [`${n} low issue${n > 1 ? "s" : ""}. Small stuff.`, `${n} low. Small stuff, but it adds up.`, `${n} low. Paper cuts, but lots of them.`][s],
  };
  const LV = { mild: 0, spicy: 1, nuclear: 2 };
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  // Same cutoffs as scanner.ts scoreOf()
  const band = (g, score) => { g = String(g || "").trim().toUpperCase().charAt(0); if (ROASTS.spicy[g]) return g; if (g === "E") return "F";
    const n = Number(score); return n >= 90 ? "A" : n >= 75 ? "B" : n >= 60 ? "C" : n >= 40 ? "D" : "F"; };
  const SITE = "https://deployvet.com/?utm_source=share";
  const shareText = (r, withUrl) => `DeployVet just roasted my app${withUrl && r.url ? ` (${r.url})` : ""}: ${r.score}/100 🔥 Get roasted free: ${SITE}`;
  const BADGE_HTML = '<a href="https://deployvet.com/?utm_source=badge"><img src="https://deployvet.com/assets/badge-survived.svg" alt="Survived the DeployVet Roast" width="160" height="160"></a>';
  window.DeployVet.roastLine = (g) => pick(ROASTS.spicy[band(g)])[0];

  const urlForm = document.getElementById("check");
  const out = document.getElementById("check-result");
  const dlgR = document.getElementById("roast");
  let lastFocus = null;

  function fx(g) {
    const box = dlgR.querySelector(".fx"); box.innerHTML = "";
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const good = g === "A" || g === "B";
    const n = { A: 60, B: 30, C: 18, D: 34, F: 60 }[g];
    const cols = good ? ["#ff3d8b", "#ffe14d", "#b6f23a", "#ff7a1a", "#fff"] : ["#ff7a1a", "#ffe14d", "#ff3d8b"];
    box.className = "fx" + (good ? " conf" : "");
    for (let i = 0; i < n; i++) {
      const el = document.createElement("i");
      el.style.left = Math.random() * 100 + "%"; el.style.background = cols[i % cols.length];
      el.style.setProperty("--d", (1.6 + Math.random() * 1.8) + "s"); el.style.setProperty("--w", (Math.random() * .8) + "s");
      const sc = good ? 1 : .7 + Math.random() * 1.3; el.style.transform = `scale(${sc})`;
      box.appendChild(el);
    }
  }

  function openRoast(r, spice) {
    const g = band(r.grade, r.score), lv = LV[spice] ?? 1;
    const [head, sub] = pick(ROASTS[spice] ? ROASTS[spice][g] : ROASTS.spicy[g]);
    const t = r.topIssue;
    const topBurn = t ? ((ID_BURNS[t.id] || BURNS[t.category] || BURNS.info)[lv]) : "";
    const counts = r.counts || {};
    const order = ["critical", "high", "medium", "low", "info"];
    const chips = order.filter((k) => counts[k]).map((k) => `<span class="sev ${k}">${esc(counts[k])} ${esc(k)}</span>`).join("");
    const total = order.reduce((a, k) => a + (Number(counts[k]) || 0), 0);
    let burns = "";
    if (t) burns += `<li><span class="sev ${esc(t.severity)}">Worst issue · ${esc(t.category)}</span><p class="burn-l">${esc(topBurn)}</p>
      <p class="what"><b>${esc(t.title)}</b>${t.detail ? ` ${esc(t.detail)}` : ""}</p>
      <div class="fixbox"><b>The fix</b><p>${esc(t.fix || "Open the full roast for step-by-step fix prompts.")}</p></div></li>`;
    const rest = order.slice(0, 4).filter((k) => counts[k]).map((k) => {
      const left = Number(counts[k]) - (t && t.severity === k ? 1 : 0); if (left < 1) return "";
      return `<li class="locked"><span class="sev ${k}">${esc(k)}</span><p class="burn-l">${esc(COUNT_BURNS[k](left, lv))}</p>
        <div class="fixbox"><b>The fix</b><p>Every one of these, with a fix prompt for your builder, is in the full roast ($7 once).</p></div></li>`; }).join("");
    burns += rest;
    if (!burns) burns = `<li><p class="burn-l">Nothing serious to burn.</p><p class="what">Our outside check found no serious issues. That's not a promise your app is safe, but it's a great start.</p></li>`;
    dlgR.className = "roast g-" + g;
    document.getElementById("roast-body").innerHTML = `
      <div class="r-card ${g === "A" || g === "B" ? "slam" : "shake"}">
        <p class="r-label">${esc(r.url || "Your app")} · ${esc(spice)} roast</p>
        <div class="r-top"><span class="r-score">${esc(r.score)}<small>/100</small></span><span class="r-grade" aria-label="Grade ${esc(g)}">${esc(g)}</span></div>
        <h2 class="r-head" id="roast-head">${esc(head)}</h2>
        <p class="r-sub">${esc(sub)}</p>
        <div class="r-counts">${chips || '<span class="sev low">0 issues</span>'}</div>
        ${total && t ? `<p class="small">${esc(total)} finding${total > 1 ? "s" : ""} in total. The free roast shows the worst one in full.</p>` : ""}
        ${r.message ? `<p class="small">${esc(r.message)}</p>` : ""}
      </div>
      <ol class="r-burns">${burns}</ol>
      ${g === "A" ? `<div class="r-badge"><img src="/assets/badge-survived.svg" alt="Survived the Roast badge" width="140" height="140">
        <div><h3>You survived the roast.</h3><p>Show it off. Paste this on your site. <a href="/badge.html">About the badge</a></p>
        <label for="badge-code" class="sr">Badge HTML</label><textarea id="badge-code" readonly>${esc(BADGE_HTML)}</textarea>
        <button type="button" class="btn btn-sm btn-y" id="badge-copy" data-track="badge-copy">Copy badge code</button></div></div>` : ""}
      <div class="r-actions">
        <a class="btn btn-big btn-y" href="#buy" data-buy="deployvet_scan_once">Get the full roast: $7</a>
        <button type="button" class="btn btn-lime" data-track="share" id="share-x">Share my roast</button>
        <button type="button" class="btn btn-line" data-track="roast-card" id="roast-card">Download roast card</button>
        <button type="button" class="btn btn-line" data-track="share-copy" id="share-copy">Copy text</button>
        <button type="button" class="btn btn-line" data-track="scoreboard-join" id="join-open">Put me on the scoreboard</button>
      </div>
      <span class="share-note small" id="share-note" aria-live="polite"></span>
      <label class="share-opt"><input type="checkbox" id="share-url"> Include my app's web address in the post</label>
      <div class="join" id="join" hidden>
        <h3>Join the scoreboard</h3>
        <p class="small">Opt-in only. You need to prove you own the site first. You can leave any time.</p>
        <form id="join-form"><label for="j-domain">Your domain</label><input id="j-domain" required autocomplete="url" placeholder="your-app.com" value="${esc(r.url || "")}">
          <label for="j-name">Display name <span class="opt">(optional)</span></label><input id="j-name" maxlength="40" placeholder="Shown instead of your domain">
          <div><button type="submit" class="btn btn-sm">Next: verify</button></div></form>
        <div id="join-step2" hidden></div>
        <div id="join-result" class="notice" hidden aria-live="polite"></div>
        <p class="small leave"><a href="#" id="leave-open" data-track="scoreboard-leave">Remove my site</a> from the scoreboard</p>
      </div>`;
    fx(g);
    lastFocus = document.activeElement;
    dlgR.showModal();
    dlgR.querySelector(".close").focus();
    const withUrl = () => document.getElementById("share-url").checked;
    const note = document.getElementById("share-note");
    document.getElementById("share-x").addEventListener("click", () => window.open("https://x.com/intent/post?text=" + encodeURIComponent(shareText(r, withUrl())), "_blank", "noopener,noreferrer"));
    document.getElementById("share-copy").addEventListener("click", async () => {
      const tx = shareText(r, withUrl());
      try { await navigator.clipboard.writeText(tx); note.textContent = "Copied. Paste it anywhere."; } catch (_) { window.prompt("Copy this:", tx); }
    });
    const bc = document.getElementById("badge-copy");
    if (bc) bc.addEventListener("click", async () => { try { await navigator.clipboard.writeText(BADGE_HTML); bc.textContent = "Copied"; } catch (_) { document.getElementById("badge-code").select(); } });
    document.getElementById("roast-card").addEventListener("click", () => roastCard({ score: r.score, grade: g, head, burn: topBurn || sub }).catch((e) => { note.textContent = "Couldn't make the card: " + e.message; }));
    joinFlow(r);
  }

  // Roast card: 1200x675 PNG drawn in the browser.
  async function drawCard({ score, grade, head, burn }) {
    const W = 1200, H = 675, cv = document.createElement("canvas"); cv.width = W; cv.height = H;
    const x = cv.getContext("2d");
    try { await document.fonts.load('800 80px "Bricolage Grotesque"'); } catch (_) {}
    const F = '"Bricolage Grotesque", "Arial Black", sans-serif';
    const bg = { A: "#b6f23a", B: "#b6f23a", C: "#ffe14d", D: "#ff7a1a", F: "#ff3d8b" }[grade] || "#ff3d8b";
    x.fillStyle = "#fff6e5"; x.fillRect(0, 0, W, H);
    const box = (X, Y, w, h, r, fill, sh = 10) => { x.fillStyle = "#111"; rr(X + sh, Y + sh, w, h, r); x.fill(); x.fillStyle = fill; rr(X, Y, w, h, r); x.fill(); x.lineWidth = 6; x.strokeStyle = "#111"; x.stroke(); };
    const rr = (X, Y, w, h, r) => { x.beginPath(); x.roundRect ? x.roundRect(X, Y, w, h, r) : x.rect(X, Y, w, h); };
    x.save(); x.translate(600, 330); x.rotate(-0.015); x.translate(-600, -330); box(40, 40, 1110, 560, 36, bg); x.restore();
    x.fillStyle = "#111"; x.font = `800 250px ${F}`; x.textBaseline = "alphabetic"; x.fillText(String(score), 90, 300);
    const sw = x.measureText(String(score)).width; x.font = `800 60px ${F}`; x.fillText("/100", 100 + sw, 300);
    x.save(); x.translate(980, 190); x.rotate(0.14); box(-100, -100, 200, 200, 34, "#111", 0); x.fillStyle = "#ffe14d"; x.font = `800 170px ${F}`; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText(grade, 0, 10); x.restore();
    const wrap = (t, X, Y, maxW, lh, maxLines) => { const words = String(t).split(/\s+/); let line = "", n = 0;
      for (let i = 0; i < words.length; i++) { const test = line ? line + " " + words[i] : words[i];
        if (x.measureText(test).width > maxW && line) { if (++n === maxLines) { x.fillText(line + "…", X, Y); return Y; } x.fillText(line, X, Y); line = words[i]; Y += lh; } else line = test; }
      x.fillText(line, X, Y); return Y; };
    x.fillStyle = "#111"; x.textAlign = "left"; x.textBaseline = "alphabetic"; x.font = `800 58px ${F}`;
    let y = wrap(head, 90, 390, 1000, 62, 2);
    x.font = `600 34px ${F}`; wrap(burn, 90, y + 56, 1000, 40, 2);
    // footer strip
    box(40, 610, 1110, 50, 14, "#111", 0);
    x.fillStyle = "#fff6e5"; x.font = `800 28px ${F}`; x.fillText("Roasted by DeployVet  ·  deployvet.com", 170, 645);
    try { const img = new Image(); img.src = "/favicon.svg"; await img.decode(); x.drawImage(img, 110, 614, 42, 42); } catch (_) {}
    return cv;
  }
  async function roastCard(d) {
    const cv = await drawCard(d);
    const blob = await new Promise((res) => cv.toBlob(res, "image/png"));
    const file = new File([blob], `deployvet-roast-${d.score}.png`, { type: "image/png" });
    const mobile = matchMedia("(max-width: 820px)").matches || /Mobi|Android/i.test(navigator.userAgent);
    if (mobile && navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], text: `DeployVet just roasted my app: ${d.score}/100 🔥 ${SITE}` }); return; } catch (e) { if (e.name === "AbortError") return; }
    }
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = file.name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  window.DeployVet.drawCard = drawCard;

  // Scoreboard join: join -> verify instructions -> confirm. Leave: same proof, two calls. Spec: app/LEADERBOARD.md
  const proofHtml = (j, what) => {
    const i = j.instructions || {}, t = i.dns_txt || {};
    return `<p><b>Prove you own ${esc(j.domain)}.</b> Add <b>one</b> of these, then hit ${what}.</p>
      <p class="small">Option 1: a DNS TXT record on <code>${esc(t.host)}</code></p><pre class="code">${esc(t.value)}</pre>
      <p class="small">Option 2: this meta tag in the &lt;head&gt; of your home page</p><pre class="code">${esc(i.meta_tag)}</pre>
      <p class="small">The token works once and lasts 7 days. DNS can take a few minutes.</p>`;
  };
  function joinFlow(r) {
    const box = document.getElementById("join"), res = document.getElementById("join-result"), step2 = document.getElementById("join-step2");
    const form = document.getElementById("join-form"), dom = document.getElementById("j-domain");
    const clear = () => { res.hidden = true; };
    document.getElementById("join-open").addEventListener("click", () => { box.hidden = false; dom.focus(); });
    form.addEventListener("submit", async (e) => {
      e.preventDefault(); clear(); const btn = form.querySelector("button[type=submit]");
      const domain = dom.value.trim(), display_name = document.getElementById("j-name").value.trim();
      if (!domain) { msg(res, "Type your domain first, like your-app.com.", "err"); return; }
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
              ? `Verified, score ${esc(en.score)} (${esc(en.grade)}). Your site is hidden by a moderator for now, so it won't show on the board. Questions? <a href="mailto:support@deployvet.com">support@deployvet.com</a>`
              : `You're in! ${esc(en.display_name || en.domain)} scored ${esc(en.score)} (${esc(en.grade)}) on a fresh scan. <a href="/scoreboard.html">See the scoreboard</a>`, "ok");
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
        if (l.removed) { step2.hidden = true; msg(res, "Done. Your site is off the scoreboard. You can delete the token now.", "ok"); }
        else { step2.hidden = false; step2.innerHTML = proofHtml(l, "Remove my site again") + `<p class="small">This is a new token, just for leaving.</p>`; msg(res, "Almost gone. Add the new token, then click Remove my site again.", ""); }
      } catch (err) { msg(res, esc(friendly(err)), "err"); }
      link.removeAttribute("aria-disabled");
    });
  }

  if (dlgR) {
    dlgR.querySelector(".close").addEventListener("click", () => dlgR.close());
    dlgR.addEventListener("close", () => { dlgR.querySelector(".fx").innerHTML = ""; if (lastFocus) lastFocus.focus(); });
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
    const spice = (urlForm.querySelector("[name=spice]:checked") || {}).value || "spicy";
    out.hidden = true;
    busy(btn, true, "Roasting…");
    try {
      const r = await call("free-check", { url, website: urlForm.querySelector("[name=website]")?.value || "" });
      openRoast(r, spice);
    } catch (err) { msg(out, esc(err.message), "err"); }
    busy(btn, false);
  });

  // When the checkout opens from inside the roast modal, close the roast so only one modal shows.
  document.addEventListener("click", (e) => { if (e.target.closest("#roast [data-buy]") && dlgR.open) dlgR.close(); }, true);

  // ---- Newsletter ----
  const mailForm = document.querySelector(".mail-form");
  if (mailForm) mailForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = mailForm.querySelector("button"), note = document.getElementById("mail-result");
    busy(btn, true, "Sending…");
    try {
      const r = await call("newsletter", { email: mailForm.querySelector("#email").value, source: "site", website: mailForm.querySelector("[name=website]")?.value || "" });
      msg(note, esc(r.message || "Check your inbox to confirm."), "ok"); mailForm.reset();
    } catch (err) { msg(note, esc(err.message), "err"); }
    busy(btn, false);
  });
  const nl = new URLSearchParams(location.search).get("newsletter");
  if (nl) msg(document.getElementById("mail-result"), { confirmed: "You're subscribed. Thanks!", unsubscribed: "You're unsubscribed. Sorry to see you go.", invalid: "That link didn't work. It may have expired." }[nl] || "", nl === "invalid" ? "err" : "ok");

  // ---- Checkout (Scan / Pro) ----
  const dlg = document.getElementById("buy");
  const NAMES = { deployvet_scan_once: "DeployVet Scan · $7 once", deployvet_pro_monthly: "DeployVet Pro · $15 / month", deployvet_pro_yearly: "DeployVet Pro · $150 / year" };
  document.addEventListener("click", (e) => {
    const a = e.target.closest("[data-buy]"); if (!a || !dlg) return;
    e.preventDefault();
    let product = a.dataset.buy;
    dlg.querySelectorAll("[name=plan]").forEach((r) => { r.checked = r.value === product; });
    dlg.querySelector("[name=product]").value = product;
    dlg.querySelector("#buy-title").textContent = NAMES[product] || "Checkout";
    dlg.querySelector(".pro-plan").hidden = !product.startsWith("deployvet_pro");
    const u = document.getElementById("url")?.value; if (u) dlg.querySelector("[name=domain]").value = u;
    document.getElementById("buy-result").hidden = true;
    dlg.showModal ? dlg.showModal() : dlg.setAttribute("open", "");
  });
  if (dlg) {
    dlg.querySelector(".close").addEventListener("click", () => dlg.close());
    dlg.querySelectorAll("[name=plan]").forEach((r) => r.addEventListener("change", () => { dlg.querySelector("[name=product]").value = r.value; dlg.querySelector("#buy-title").textContent = NAMES[r.value]; }));
    dlg.querySelector("form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const f = new FormData(e.target), btn = e.target.querySelector("button[type=submit]");
      const body = { product: f.get("product"), email: f.get("email"), domain: f.get("domain"), builder: f.get("builder") };
      if (f.get("repo_url")) body.repo_url = f.get("repo_url");
      if (f.get("supabase_url")) body.supabase_url = f.get("supabase_url");
      busy(btn, true, "Opening secure checkout…");
      try {
        const r = await call("create-checkout", body);
        sessionStorage.setItem("dv_order", JSON.stringify({ order_id: r.order_id, site_id: r.site_id, verify_token: r.verify_token, domain: body.domain }));
        location.href = r.url; // Stripe Checkout. The scan runs only after payment and domain proof.
      } catch (err) { msg(document.getElementById("buy-result"), esc(err.message), "err"); busy(btn, false); }
    });
  }
})();
