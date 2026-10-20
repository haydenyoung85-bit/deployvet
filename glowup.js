// Pro glow-up tracker on the report page: score history, levels, shareable before/after card.
(function () {
  const LV = ["cooked", "medium rare", "well done", "survived"];
  const COL = { "cooked": "#ff3d8b", "medium rare": "#ff8a3d", "well done": "#ffd23d", "survived": "#3ddc84" };
  document.addEventListener("dv:report", async (ev) => {
    const D = window.DeployVet, esc = D.esc, t = ev.detail.t, extra = document.getElementById("r-extra");
    let x; try { x = await D.call("history", null, "GET", "?t=" + encodeURIComponent(t)); } catch (e) { return; }
    const sec = document.createElement("section"); sec.className = "box no-print"; sec.id = "glowup";
    if (!x.pro) { sec.innerHTML = "<h2>Glow-up tracker</h2><p class='small'>Track your score from cooked to survived, every scan. Part of <a href='/#pricing'>Pro</a>.</p>"; extra.prepend(sec); return; }
    const pts = x.points || [], last = pts.at(-1) || { score: 0, level: "cooked" };
    const W = 600, H = 160, P = 20, n = Math.max(1, pts.length - 1);
    const xy = pts.map((p, i) => [P + (W - 2 * P) * (pts.length === 1 ? 0.5 : i / n), H - P - (H - 2 * P) * (p.score / 100)]);
    const bands = [[0, 40, "cooked"], [40, 70, "medium rare"], [70, 90, "well done"], [90, 100, "survived"]].map(([a, b, l]) =>
      `<rect x="${P}" width="${W - 2 * P}" y="${H - P - (H - 2 * P) * b / 100}" height="${(H - 2 * P) * (b - a) / 100}" fill="${COL[l]}" opacity=".12"/>`).join("");
    const chart = `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Score history chart">${bands}
      <polyline fill="none" stroke="#111" stroke-width="3" points="${xy.map((p) => p.join(",")).join(" ")}"/>
      ${xy.map((p, i) => `<circle cx="${p[0]}" cy="${p[1]}" r="5" fill="${COL[pts[i].level]}" stroke="#111" stroke-width="2"><title>${esc(new Date(pts[i].at).toLocaleDateString())}: ${pts[i].score}/100 (${pts[i].kind})</title></circle>`).join("")}</svg>`;
    const g = x.glowup;
    sec.innerHTML = "<h2>Glow-up tracker</h2>" +
      "<p class='levels'>" + LV.map((l) => `<span class="lvl${l === last.level ? " on" : ""}" style="--c:${COL[l]}">${l}</span>`).join(" → ") + "</p>" +
      (g ? `<p><b>${g.from} → ${g.to}</b> (${g.delta >= 0 ? "+" : ""}${g.delta}) · ${esc(g.fromLevel)} → ${esc(g.toLevel)} over ${pts.length} scan(s)</p>` : "") + chart +
      "<ul class='small hist'>" + pts.slice().reverse().map((p) => `<li>${esc(new Date(p.at).toLocaleString())} · ${esc(p.kind)} · <b>${p.score}/100 ${esc(p.grade)}</b> · ${esc(p.level)} · ${p.issues} issue(s)${p.t !== t ? ` · <a href="/report.html?t=${esc(p.t)}">open</a>` : ""}</li>`).join("") + "</ul>" +
      `<h3>Share your glow-up</h3><p><img src="${esc(x.share_url)}" alt="Before and after score card for ${esc(x.domain)}" width="600" height="315" style="max-width:100%;border-radius:12px"></p>
       <p><button type="button" class="btn btn-sm" id="gl-copy">Copy card link</button> <a class="btn btn-sm btn-line" target="_blank" rel="noopener" href="https://x.com/intent/post?text=${encodeURIComponent(`went from ${g ? g.fromLevel : "cooked"} to ${g ? g.toLevel : last.level} on @deployvet`)}&url=${encodeURIComponent(x.share_url)}">Post it</a></p>
       <p class='small'>The card shows your domain and scores, nothing else. Anyone with the link can see it.</p>`;
    extra.prepend(sec);
    document.getElementById("gl-copy").addEventListener("click", async (e) => { await navigator.clipboard.writeText(x.share_url); e.target.textContent = "Copied ✓"; });
  });
})();
