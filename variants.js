// Headline + sub line per traffic source. Small lookup; unknown or missing source keeps the page's own text.
// Also remembers utm_source / utm_campaign for the session and carries them on internal links, so events and checkout keep them.
(function () {
  var V = {
    home: {
      reddit: ["Built your app with AI? See what a stranger can see.", "Paste your live address. You get a free score, your worst issue and the fix in under a minute. No signup, no card."],
      devto: ["A free outside check for your AI-built app.", "We scan the live site from the outside: exposed keys, open Supabase tables, public .env files, missing headers. You get a score and the fix for the worst issue."],
      hashnode: ["Ship your AI-built app with fewer surprises.", "Paste the live URL and get a score, a roast built from your own data, and the real fix for your worst issue. Free, no signup."],
      hn: ["A free outside-in scan for AI-built apps.", "Paste a URL, get a score and the fix for the worst issue. It is not a pentest: it checks common, known problems such as exposed keys, open Supabase tables and public config files."],
      x: ["Roast my vibe-coded app. Free.", "Paste your live URL. Get a score, a roast built from your own app's data, and the fix for the worst issue. Under a minute."],
      indiehackers: ["Shipping a side project? Check it before launch day.", "A free outside check for apps built with AI tools: score, worst issue and the fix in under a minute. Fix everything for $10 once, if you want to."],
      groups: ["Not sure your AI-built app is locked down?", "Paste the live address. The free check looks for exposed keys, open data and broken pages, and shows your worst issue with the fix."]
    },
    builders: {
      reddit: ["Live app built with AI? Roast it free, fix it for $10.", "Free score, your worst issue and its fix. If there is more, $10 once lists every issue with fix prompts to paste into your builder. No subscription."],
      devto: ["Built it with AI? Check the live site, then fix it for $10.", "The free roast scans from the outside and shows your worst issue with the fix. The $10 Fix it pack lists every issue with paste-ready fix prompts."],
      hashnode: ["Built it with AI? Check the live site, then fix it for $10.", "The free roast scans from the outside and shows your worst issue with the fix. The $10 Fix it pack lists every issue with paste-ready fix prompts."],
      hn: ["Outside-in scan for your live AI-built app, free.", "You get a score and the fix for the worst issue. If you want the full list, the $10 pack has every finding with fix prompts. Not a pentest, not a certification."],
      x: ["Roast your live app. Free. Then fix it for $10.", "Paste the URL, get a score and your worst issue with the fix. The $10 pack lists the rest with prompts you can paste into your builder."],
      indiehackers: ["Launching soon? Roast your app free, fix it for $10.", "A free outside check shows your score and worst issue. If there is more, $10 once gets every issue with fix prompts. No subscription."],
      groups: ["Got a live app built with AI? Roast it free.", "Paste the address, see your score and your worst issue with the fix. Want the full list? The $10 Fix it pack has every issue and fix prompts."]
    },
    agencies: {
      reddit: ["Delivering AI-built client sites? Check them free before handoff.", "Roast each client site for free, then order a $39 Launch Pack for the words: landing-page rewrite, social posts and a launch email. Written with AI, 48 hours, one revision."],
      devto: ["Shipping AI-built client sites? Roast them, then add the copy.", "A free outside check per site, plus a $39 Launch Pack: landing-page rewrite, posts and launch email, written with AI, delivered in 48 hours with one revision."],
      hashnode: ["Shipping AI-built client sites? Roast them, then add the copy.", "A free outside check per site, plus a $39 Launch Pack: landing-page rewrite, posts and launch email, written with AI, delivered in 48 hours with one revision."],
      hn: ["Check the AI-built client site before you hand it over.", "A free outside-in scan per site, and a $39 Launch Pack for launch copy (AI-written, 48 hours, one revision). Not a pentest or an audit."],
      x: ["Client site built with AI? Roast it free, add launch copy for $39.", "Free outside check per site. The Launch Pack is a landing-page rewrite, posts and a launch email, written with AI in 48 hours, one revision."],
      indiehackers: ["Building sites for clients with AI? Check, then launch.", "Roast each site free. Add a $39 Launch Pack for the copy: landing-page rewrite, posts and launch email, AI-written, 48 hours, one revision."],
      groups: ["Freelancer shipping AI-built sites? Check them before handoff.", "Free roast per client site, then a $39 Launch Pack for the launch copy. AI-written, 48 hours, one revision. One pack covers one site."]
    }
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
