// Launch Pack order form (used on /launch-pack.html and /for/agencies.html). Needs app.js first (DeployVet.call).
(function(){
  const f = document.getElementById("lp-form"), out = document.getElementById("lp-result"), btn = document.getElementById("lp-pay");
  try { const e = localStorage.getItem("dv_email"); if (e) f.email.value = e; } catch (_) {}
  const canceled = new URLSearchParams(location.search).get("checkout") === "canceled";
  if (canceled) { out.hidden = false; out.className = "notice ok"; out.innerHTML = 'Checkout canceled. Nothing was charged. Questions? <a href="mailto:support@deployvet.com">support@deployvet.com</a>'; }
  f.addEventListener("submit", async (e) => {
    e.preventDefault(); out.hidden = true; const l = btn.innerHTML; btn.disabled = true; btn.textContent = "Opening Stripe…";
    try {
      const r = await DeployVet.call("create-checkout", { product: "deployvet_launch_pack", email: f.email.value, domain: f.app.value, builder: "other" });
      try { localStorage.setItem("dv_email", f.email.value.trim()); } catch (_) {}
      sessionStorage.setItem("dv_order", JSON.stringify({ order_id: r.order_id, site_id: r.site_id, domain: f.app.value, pack: "launch" }));
      sessionStorage.setItem("dv_lp_app", f.app.value);
      location.href = r.url;
    } catch (err) { out.hidden = false; out.className = "notice err"; out.textContent = err.message; btn.disabled = false; btn.innerHTML = l; }
  });
})();
