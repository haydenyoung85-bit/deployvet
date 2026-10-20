// DeployVet paid report page. Features that need newer backend functions are switched on in config.js FEATURES.
(async function () {
  const D = window.DeployVet, esc = D.esc, F = (window.DEPLOYVET_CONFIG || {}).FEATURES || {};
  const h = document.getElementById("r-h"), b = document.getElementById("r-body"), extra = document.getElementById("r-extra");
  const t = new URLSearchParams(location.search).get("t") || "";
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
      } catch (err) { slot.innerHTML = "<p class='notice err'>" + esc(err.status === 402 ? "Re-checks are part of Pro." : err.message) + "</p>"; rc.textContent = "Did I fix it?"; }
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

  if (F.history) document.dispatchEvent(new CustomEvent("dv:report", { detail: { t, r } }));
})();
