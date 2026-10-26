// Get your badge: look up the stored result for a domain and show the live badge and embed codes.
(function () {
  const B = window.DeployVetBadge; if (!B) return;
  const f = document.getElementById("bd-form"), out = document.getElementById("bd-out"), inp = document.getElementById("bd-d");
  const note = (h) => { out.innerHTML = `<div class="notice">${h}</div>`; };
  async function go(d) {
    note("Looking up the latest check…");
    try {
      const i = await B.info(d, true);
      if (!i) { note(`We have no current A or B check on record for <b>${B.esc(d)}</b>, so there is no badge yet. <a href="/#check">Run the free check</a>, and if you score a B or better the badge shows up here.`); return; }
      out.innerHTML = `<h2>${B.esc(d)}</h2><div class="bdg-box" id="bd-box"></div>${i.stale ? `<p class="notice">This check is ${B.esc(i.days_old)} days old, so the badge is shown as old. Re-check to refresh it.</p>` : ""}`;
      B.render(document.getElementById("bd-box"), d, i, { id: "pg" });
    } catch (_) { note("We could not look that up right now. Please try again in a minute."); }
  }
  f.addEventListener("submit", (e) => { e.preventDefault(); const d = B.norm(inp.value); if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(d)) { note("Enter a domain like your-site.com."); return; } inp.value = d; history.replaceState(null, "", "?d=" + encodeURIComponent(d)); go(d); });
  const q = B.norm(new URLSearchParams(location.search).get("d")); if (q) { inp.value = q; go(q); }
})();
