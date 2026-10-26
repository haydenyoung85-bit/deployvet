// Headline + sub line per traffic source. Small lookup; unknown or missing source keeps the page's own text.
// Also remembers utm_source / utm_campaign for the session and carries them on internal links, so events and checkout keep them.
(function () {
  var HOME = ["Website security and bug check", "Enter your site's address. In under a minute you get a score, your most important issue and how to fix it. Free, no signup, no card."];
  var HOMEC = ["Check a client site before you hand it over", "Enter the site's address. You get a score, the most important issue and how to fix it in under a minute. Free, no signup, no card."];
  var HOMET = ["Outside-in website security and bug check", "Enter a public URL. You get a score and the fix for the top issue. It is not a pentest: it checks common, known problems such as exposed keys, open database tables and public config files."];
  var AG = ["Check each client site before handoff", "A free outside check per site, plus a $39 Launch Pack for launch copy: landing-page rewrite, social posts and a launch email, written with AI and delivered in 48 hours with one revision. Not a security service."];
  var BU = ["Check a live site, then fix it for $10", "The free check shows your score and top issue with the fix. The $10 Fix it pack lists every issue with fix steps and prompts you can paste into your builder. One payment, no subscription."];
  var V = {
    home: { reddit: HOMEC, groups: HOMEC, indiehackers: HOME, x: HOME, devto: HOMET, hashnode: HOMET, hn: HOMET },
    builders: { reddit: BU, devto: BU, hashnode: BU, hn: BU, x: BU, indiehackers: BU, groups: BU },
    agencies: { reddit: AG, devto: AG, hashnode: AG, hn: AG, x: AG, indiehackers: AG, groups: AG }
  };
  var ALIAS = { twitter: "x", "x.com": "x", hackernews: "hn", "news.ycombinator.com": "hn", ycombinator: "hn", "dev.to": "devto", dev: "devto", ih: "indiehackers", "indie-hackers": "indiehackers", group: "groups", facebook: "groups", "facebook-groups": "groups", fb: "groups" };
  var q = new URLSearchParams(location.search), s, c;
  try {
    if (q.get("utm_source")) sessionStorage.setItem("dv_src", q.get("utm_source"));
    if (q.get("utm_campaign")) sessionStorage.setItem("dv_cmp", q.get("utm_campaign"));
    s = sessionStorage.getItem("dv_src"); c = sessionStorage.getItem("dv_cmp");
  } catch (e) { s = q.get("utm_source"); c = q.get("utm_campaign"); }
  var key = (s || "").toLowerCase().trim(); key = ALIAS[key] || key;
  var page = document.body.getAttribute("data-vpage") || "home";
  var pair = (V[page] || {})[key];
  if (pair) {
    var h = document.querySelector("[data-v=h]"), sub = document.querySelector("[data-v=sub]");
    if (h) h.textContent = pair[0]; if (sub) sub.textContent = pair[1];
  }
  function tag() {
    if (!s && !c) return;
    var as = document.querySelectorAll("a[href]");
    for (var i = 0; i < as.length; i++) {
      var raw = as[i].getAttribute("href");
      if (!raw || raw.charAt(0) !== "/" || raw.charAt(1) === "/" || /^\/(assets|badge|api)\//.test(raw) || /\.(png|svg|ico|xml|txt|js|css)(\?|#|$)/.test(raw)) continue;
      var u; try { u = new URL(raw, location.origin); } catch (e) { continue; }
      if (u.searchParams.get("utm_source")) continue;
      if (s) u.searchParams.set("utm_source", s); if (c) u.searchParams.set("utm_campaign", c);
      as[i].setAttribute("href", u.pathname + u.search + u.hash);
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", tag); else tag();
  window.DeployVetAttr = function () {
    var o = {}; try { var v = sessionStorage.getItem("dv_v"); if (v) o.visitor = v; } catch (e) {}
    if (s) o.utm_source = s.slice(0, 40); if (c) o.utm_campaign = c.slice(0, 40); return o;
  };
})();
