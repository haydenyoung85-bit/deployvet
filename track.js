// Tiny private analytics: page views + button clicks to our own Supabase. No cookies.
(function () {
  var C = window.DEPLOYVET_CONFIG; if (!C) return;
  var p = new URLSearchParams(location.search), v;
  try { v = sessionStorage.getItem("dv_v") || Math.random().toString(36).slice(2, 12); sessionStorage.setItem("dv_v", v);
    if (p.get("utm_source")) sessionStorage.setItem("dv_src", p.get("utm_source"));
    if (p.get("utm_campaign")) sessionStorage.setItem("dv_cmp", p.get("utm_campaign")); } catch (e) {}
  var src = p.get("utm_source") || (function(){ try { return sessionStorage.getItem("dv_src"); } catch(e){ return null; } })();
  var cmp = p.get("utm_campaign") || (function(){ try { return sessionStorage.getItem("dv_cmp"); } catch(e){ return null; } })();
  function send(event) {
    var body = JSON.stringify({ event: event.slice(0, 40), path: location.pathname.slice(0, 300), referrer: (document.referrer || "").slice(0, 500) || null,
      utm_source: src ? src.slice(0, 80) : null, utm_campaign: (cmp || "").slice(0, 80) || null, visitor: v || null });
    fetch(C.SUPABASE_URL + "/rest/v1/page_events", { method: "POST", keepalive: true,
      headers: { apikey: C.SUPABASE_ANON_KEY, Authorization: "Bearer " + C.SUPABASE_ANON_KEY, "Content-Type": "application/json", Prefer: "return=minimal" }, body: body }).catch(function () {});
  }
  send("view");
  document.addEventListener("click", function (e) {
    var el = e.target.closest("button, a"); if (!el) return;
    var label = (el.getAttribute("data-track") || el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 30);
    if (el.tagName === "A" && !/#check|#pricing|checkout|guides/.test(el.getAttribute("href") || "") && el.type !== "submit") return;
    send("click:" + label);
  }, true);
})();
