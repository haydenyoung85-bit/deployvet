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
    if (!res.ok || data.error) throw new Error(data.error || `Something went wrong (${res.status}). Please try again.`);
    return data;
  }
  window.DeployVet = { call, esc };

  const busy = (btn, on, label) => { if (!btn) return; if (on) { btn.dataset.l = btn.innerHTML; btn.disabled = true; btn.textContent = label; } else { btn.disabled = false; btn.innerHTML = btn.dataset.l || btn.innerHTML; } };
  const msg = (el, text, kind) => { if (!el) return; el.hidden = false; el.className = "notice " + (kind || ""); el.innerHTML = text; };

  // ---- Free Check ----
  const urlForm = document.querySelector(".url-form");
  const out = document.getElementById("check-result");
  if (urlForm) urlForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = urlForm.querySelector("button");
    const url = urlForm.querySelector("#url").value;
    busy(btn, true, "Checking…");
    try {
      const r = await call("free-check", { url, website: urlForm.querySelector("[name=website]")?.value || "" });
      const counts = Object.entries(r.counts || {}).map(([k, v]) => `<span class="sev ${k === "medium" ? "med" : k}">${v} ${esc(k)}</span>`).join("");
      const top = r.topIssue ? `<p class="r-top"><b>Worst issue:</b> ${esc(r.topIssue.title)}</p><p class="small">${esc(r.topIssue.detail)}</p><pre class="fix-t">${esc(r.topIssue.fix)}</pre>` : "<p>We found no serious issues in our outside check.</p>";
      msg(out, `<p class="r-score">Score <b>${esc(r.score)}</b>/100 · Grade ${esc(r.grade)}</p><div class="chips">${counts}</div>${top}${r.message ? `<p class="small">${esc(r.message)}</p>` : ""}<p><a class="btn" href="#pricing" data-buy="deployvet_scan_once">See every issue for $7</a></p>`, "ok");
    } catch (err) { msg(out, esc(err.message), "err"); }
    busy(btn, false);
  });

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
