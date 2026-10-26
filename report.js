// DeployVet paid report page. Features that need newer backend functions are switched on in config.js FEATURES.
(async function () {
  const D = window.DeployVet, esc = D.esc, F = (window.DEPLOYVET_CONFIG || {}).FEATURES || {};
  const h = document.getElementById("r-h"), b = document.getElementById("r-body"), extra = document.getElementById("r-extra");
  const qp = new URLSearchParams(location.search);
  const t = qp.get("t") || (qp.get("gh") ? sessionStorage.getItem("dv_report_t") || "" : "");
  const sevCls = (s) => (s === "medium" ? "med" : esc(s));
  let r;
  try { r = await D.call("report", null, "GET", "?t=" + encodeURIComponent(t)); }
  catch (e) { h.textContent = "We couldn't open this report."; b.innerHTML = "<p>" + esc(e.message) + " Check the link in your email, or contact <a href='mailto:support@deployvet.com'>support@deployvet.com</a>.</p>"; return; }
  if (r.status !== "done") { h.textContent = "Your scan is still running."; b.innerHTML = "<p>This page refreshes by itself in 20 seconds.</p>"; setTimeout(() => location.reload(), 20000); return; }
  window.DV_REPORT = { t, r };
  const res = r.result || {}, f = res.findings || [], prompts = res.prompts || [];
  const promptFor = (x) => (prompts.find((p) => p.id === x.id && p.title === x.title) || {}).prompt;
  h.textContent = "Score " + r.score + "/100 · Grade " + r.grade;
  b.innerHTML =
    "<p class='small'>Scanned " + esc(new Date(r.created_at).toLocaleString()) + ". " + f.length + " item(s) found." +
    (res.builder ? " Fix prompts are written for <b>" + esc(res.builder) + "</b>." : "") + "</p>" +
    "<p class='no-print'><button type='button' class='btn btn-line btn-sm' id='r-pdf'>Download PDF</button></p>" +
    f.map((x, i) => {
      const p = promptFor(x);
      return "<div class='box finding' data-i='" + i + "'><p><span class='sev " + sevCls(x.severity) + "'>" + esc(x.severity) + "</span> <b>" + esc(x.title) + "</b></p>" +
        "<p class='small'><b>Proof:</b> " + esc(x.detail) + (x.location ? " · <code>" + esc(x.location) + "</code>" : "") + "</p>" +
        "<p class='small'><b>Fix:</b> " + esc(x.fix) + "</p>" +
        (p ? "<p class='small'><b>Fix prompt for your builder</b> <button type='button' class='btn btn-sm btn-line no-print' data-copy='" + i + "'>Copy prompt</button></p><pre class='fix-t'>" + esc(p) + "</pre>" : "") +
        (F.recheck && /^https?:/.test(x.location || "") && x.category !== "seo" ? "<p class='no-print'><button type='button' class='btn btn-sm btn-y' data-recheck='" + i + "'>" + (x.fixed_at ? "✓ Fixed. Re-check again" : "Did I fix it?") + "</button></p>" : "") +
        "<div class='slot' id='slot-" + i + "' aria-live='polite'>" + (x.fixed_at ? "<p class='notice ok'>✓ fixed " + esc(new Date(x.fixed_at).toLocaleString()) + "</p>" : "") + "</div></div>";
    }).join("") +
    ((res.notes || []).length ? "<details><summary>Scan notes</summary><ul class='small'>" + res.notes.map((n) => "<li>" + esc(n) + "</li>").join("") + "</ul></details>" : "") +
    "<p class='small'>DeployVet is not a penetration test. A clean report means we did not find the issues we check for.</p>";
  document.getElementById("r-pdf").addEventListener("click", () => window.print());
  b.addEventListener("click", async (e) => {
    const rc = e.target.closest("[data-recheck]");
    if (rc) {
      const i = +rc.dataset.recheck, slot = document.getElementById("slot-" + i);
      rc.disabled = true; rc.textContent = "Re-checking…";
      try {
        const x = await D.call("recheck", { t, i });
        if (!x.supported) slot.innerHTML = "<p class='notice'>" + esc(x.message) + "</p>";
        else if (x.fixed === true) { slot.innerHTML = "<p class='notice ok'><b>✓</b> " + esc(x.line) + "</p>"; h.textContent = "Score " + x.score + "/100 · Grade " + x.grade; rc.textContent = "✓ Fixed. Re-check again"; }
        else if (x.fixed === false) { slot.innerHTML = "<p class='notice err'><b>✗</b> " + esc(x.line) + "</p>"; rc.textContent = "Did I fix it?"; }
        else { slot.innerHTML = "<p class='notice'>" + esc(x.message) + "</p>"; rc.textContent = "Did I fix it?"; }
      } catch (err) { slot.innerHTML = "<p class='notice err'>" + esc(err.status === 402 ? "Re-checks come with the $10 Fix it pack (30 days)." : err.message) + "</p>"; rc.textContent = "Did I fix it?"; }
      rc.disabled = false; return;
    }
    const c = e.target.closest("[data-copy]"); if (!c) return;
    const x = f[+c.dataset.copy]; await navigator.clipboard.writeText(promptFor(x)); c.textContent = "Copied ✓";
  });

  // Supabase RLS review: customer runs a read-only query and pastes the result.
  if (r.rls_export_sql) {
    extra.insertAdjacentHTML("beforeend", "<section class='box no-print' id='rls'><h2>Check your Supabase policies (read-only)</h2>" +
      "<p class='small'>Run this in your Supabase SQL editor. It only <b>reads</b> table and policy settings. Never paste your service_role key anywhere.</p>" +
      "<pre class='fix-t'>" + esc(r.rls_export_sql) + "</pre>" +
      (F.rlsExport ? "<label for='rls-in'>Paste the result here</label><textarea id='rls-in' rows='5' style='width:100%'></textarea><p><button type='button' class='btn btn-sm' id='rls-go'>Review my policies</button></p><div id='rls-out' class='notice' hidden aria-live='polite'></div>"
        : "<p class='small'>Pasting the result here is coming soon. For now, email the output to <a href='mailto:support@deployvet.com'>support@deployvet.com</a> and we'll add the review to your report.</p>") + "</section>");
    if (F.rlsExport) document.getElementById("rls-go").addEventListener("click", async () => {
      const out = document.getElementById("rls-out"); out.hidden = false; out.className = "notice"; out.textContent = "Reviewing…";
      try { const x = await D.call("rls-export", { t, export: document.getElementById("rls-in").value }); out.className = "notice ok"; out.textContent = "Added " + x.added + " policy finding(s). New score " + x.score + "/100. Reloading…"; setTimeout(() => location.reload(), 1200); }
      catch (err) { out.className = "notice err"; out.textContent = err.message; }
    });
  }

  if (F.preview) {
    const sec = document.createElement("section"); sec.className = "box no-print"; sec.id = "preview"; extra.prepend(sec);
    sec.innerHTML = "<h2>Check a preview before shipping</h2><p class='small'>Paste a preview URL (Vercel, Netlify, Cloudflare Pages, Lovable, Replit, v0…) or a staging subdomain. 10-second check for leaked keys, open files, open tables and missing headers.</p>" +
      "<form id='pv-f'><label for='pv-u'>Preview URL</label><input id='pv-u' required placeholder='https://my-app-git-feature.vercel.app'> <button class='btn btn-sm' type='submit'>Check it</button></form><div id='pv-out' aria-live='polite'></div>";
    document.getElementById("pv-f").addEventListener("submit", async (e) => {
      e.preventDefault(); const out = document.getElementById("pv-out"), btn = e.target.querySelector("button");
      btn.disabled = true; out.innerHTML = "<p class='small'>Checking the preview… (up to 10 seconds)</p>";
      try {
        const x = await D.call("preview-check", { t, url: document.getElementById("pv-u").value });
        const head = { yes: "No blockers found", careful: "Ship with care", no: "Fix before shipping" }[x.verdict];
        out.innerHTML = "<p class='notice " + (x.verdict === "yes" ? "ok" : "err") + "'><b>" + head + "</b> · " + x.score + "/100 · " + (x.ms / 1000).toFixed(1) + "s<br>" + esc(x.line) + (x.partial ? "<br><span class='small'>Some checks ran out of time.</span>" : "") + "</p>" +
          (x.issues || []).map((i) => "<div class='finding'><span class='sev " + (i.severity === "medium" ? "med" : esc(i.severity)) + "'>" + esc(i.severity) + "</span> <b>" + esc(i.title) + "</b><p class='small'>" + esc(i.fix) + "</p></div>").join("");
      } catch (err) { out.innerHTML = "<p class='notice err'>" + esc(err.status === 402 ? "Preview checks are part of the Fix it pack." : err.message) + "</p>"; }
      btn.disabled = false;
    });
  }

  if (F.fixPr) {
    const sec = document.createElement("section"); sec.className = "box no-print"; sec.id = "fixpr"; extra.append(sec);
    const render = async () => {
      let st; try { st = await D.call("fix-pr", { t, action: "status" }); } catch (e) { sec.innerHTML = "<h2>Fix pull request</h2><p class='small'>" + esc(e.status === 402 ? "Fix pull requests aren't available yet." : e.message) + "</p>"; return; }
      if (!st.repo) { sec.innerHTML = "<h2>Fix pull request</h2><p class='small'>Add your public GitHub repo to use this. Email support@deployvet.com with the repo URL.</p>"; return; }
      if (!st.connected) {
        sec.innerHTML = "<h2>Fix pull request</h2><p class='small'>We can open a pull request on <b>" + esc(st.repo) + "</b> with three standard fixes: security headers, blocking .env/.git files, and adding .env to .gitignore. " +
          "It only happens if you connect GitHub <b>and</b> approve the exact changes. We never push to your main branch, and you review and merge the PR yourself.</p>" +
          (qp.get("gh") === "denied" || qp.get("gh") === "error" ? "<p class='notice err'>GitHub connect didn't finish. Try again.</p>" : "") +
          "<p><button type='button' class='btn btn-sm' id='gh-connect'>Connect GitHub</button></p>";
        document.getElementById("gh-connect").addEventListener("click", async () => {
          try { const x = await D.call("github-oauth", { t }); sessionStorage.setItem("dv_report_t", t); location.href = x.url; } catch (e) { alert(e.message); }
        });
        return;
      }
      sec.innerHTML = "<h2>Fix pull request</h2><p class='small'>Connected as <b>" + esc(st.github_login || "GitHub user") + "</b> · <button type='button' class='btn btn-sm btn-line' id='gh-off'>Disconnect</button></p><p><button type='button' class='btn btn-sm' id='gh-preview'>Preview the fixes</button></p><div id='gh-plan'></div>";
      document.getElementById("gh-off").addEventListener("click", async () => { await D.call("fix-pr", { t, action: "disconnect" }); render(); });
      document.getElementById("gh-preview").addEventListener("click", async () => {
        const plan = document.getElementById("gh-plan"); plan.innerHTML = "<p class='small'>Reading your repo…</p>";
        try {
          const pv = await D.call("fix-pr", { t, action: "preview" });
          if (!pv.changes.length) { plan.innerHTML = "<p class='notice ok'>Nothing to fix. These templates are already in your repo.</p>"; return; }
          plan.innerHTML = "<p class='small'>Pull request into <b>" + esc(pv.repo) + "</b> from a new branch (base: " + esc(pv.base) + ").</p>" +
            pv.changes.map((c) => "<details open><summary><code>" + esc(c.path) + "</code> (" + esc(c.action) + "): " + esc(c.why) + "</summary><pre class='fix-t'>" + esc(c.after) + "</pre></details>").join("") +
            "<p><label><input type='checkbox' id='gh-ok'> I reviewed these changes. Open a pull request (nothing is merged).</label></p><p><button type='button' class='btn btn-sm btn-y' id='gh-open' disabled>Open pull request</button></p><div id='gh-out' aria-live='polite'></div>";
          const ok = document.getElementById("gh-ok"), open = document.getElementById("gh-open");
          ok.addEventListener("change", () => { open.disabled = !ok.checked; });
          open.addEventListener("click", async () => {
            open.disabled = true; const out = document.getElementById("gh-out");
            try { const r2 = await D.call("fix-pr", { t, action: "open", confirm: ok.checked, plan_hash: pv.plan_hash }); out.innerHTML = "<p class='notice ok'>✓ Pull request opened: <a href='" + esc(r2.pr_url) + "' target='_blank' rel='noopener'>" + esc(r2.pr_url) + "</a>. Review it, merge it, deploy, then hit Did I fix it?</p>"; }
            catch (e) { out.innerHTML = "<p class='notice err'>" + esc(e.message) + "</p>"; open.disabled = false; }
          });
        } catch (e) { plan.innerHTML = "<p class='notice err'>" + esc(e.message) + "</p>"; }
      });
    };
    render();
  }

  if (F.history) document.dispatchEvent(new CustomEvent("dv:report", { detail: { t, r } }));
})();
