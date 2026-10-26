// Public scores renderer, used on scoreboard.html (top 20) and the homepage block (top 5 + ticker).
// GET leaderboard -> { fame, flame, latest, totals: { roasts } }. Spec: app/LEADERBOARD.md
// Unverified rows have no domain: show nickname or masked domain. Rank is computed here (ties share). No fake rows, ever.
(function () {
  const D = window.DeployVet; if (!D) return;
  const esc = D.esc, $ = (id) => document.getElementById(id);
  if (!$("fame") && !$("flame")) return;
  const FAME_MIN = 70;
  const LIMIT = Number(document.body.dataset.boardLimit || 20);
  // Free-text display names only show once the owner verified the domain, so nobody can put a brand or adult site name on the public board.
  const name = (r) => (r.verified && r.display_name) || r.domain || r.masked || "anonymous app";
  const rank = (rows) => { let prev = null, rk = 0; return rows.map((r, i) => { if (r.score !== prev) { rk = i + 1; prev = r.score; } return { ...r, rank: rk }; }); };
  const checked = (n) => Number.isFinite(n) ? `${n.toLocaleString()} site${n === 1 ? " has" : "s have"} been checked` : "Sites are being checked";
  const EMPTY = {
    fame: (n) => `<div class="empty"><p class="em-big">No public high scores yet.</p><p>${esc(checked(n))}. Listing is opt-in: after a check, the owner can choose to show their score here.</p><a class="btn btn-line btn-sm" href="/#check">Check my site</a></div>`,
    flame: (n) => `<div class="empty"><p class="em-big">No public low scores yet.</p><p>${esc(checked(n))}. Owners decide whether to list a score, and most do not.</p><a class="btn btn-line btn-sm" href="/#check">Check my site</a></div>`
  };
  const key = (r) => r.id || r.domain || `${r.masked}|${r.display_name}|${r.score}|${r.joined_at}`;
  const dedupe = (rows) => { const seen = new Set(); return (Array.isArray(rows) ? rows : []).filter((r) => { const k = key(r); if (seen.has(k)) return false; seen.add(k); return true; }); };
  const list = (rows, kind, n) => {
    if (!rows.length) return EMPTY[kind](n);
        return `<ol>${rank(rows.slice(0, LIMIT)).map((r) => { return `<li><span class="rk">#${esc(r.rank)}</span>
      <span><span class="nm">${esc(name(r))}</span>${r.verified ? '<span class="vbadge" title="Owner verified this domain">Verified</span>' : ""}${r.display_name && r.domain ? `<span class="dm">${esc(r.domain)}</span>` : ""}</span>
      <span class="sc">${esc(r.score)}<span class="gr">${esc(r.grade)}</span></span></li>`; }).join("")}</ol>`;
  };
  const ticker = (rows) => {
    const el = $("ticker"); if (!el) return;
    if (!Array.isArray(rows) || !rows.length) { el.hidden = true; return; }
    const items = rows.map((r) => `<li><b>${esc(name(r))}</b> scored ${esc(r.score)}/100 (${esc(r.grade)})</li>`).join("");
    el.hidden = false; el.innerHTML = `<p class="sr">Latest checks</p><ul>${items}${rows.length > 2 ? items.replace(/<li>/g, '<li aria-hidden="true">') : ""}</ul>`;
  };
  D.call("leaderboard", null, "GET").then((d) => {
    const n = d.totals ? Number(d.totals.roasts) : NaN;
    // One site, one spot: dedupe, and never show a site in both halls (Fame = 70+, Flame = lowest of the rest, same as the server).
    const fame = dedupe(d.fame).filter((r) => Number(r.score) >= FAME_MIN);
    const inFame = new Set(fame.map(key));
    const flame = dedupe(d.flame).filter((r) => !inFame.has(key(r))); // lowest entries not in Fame (server picks them)
    $("fame").innerHTML = list(fame, "fame", n);
    $("flame").innerHTML = list(flame, "flame", n);
    const wall = $("wall");
    if (wall) {
      const a = fame.filter((r) => String(r.grade).toUpperCase() === "A" && Number(r.score) >= 90).slice(0, 40);
      const CHK = '<svg class="vchk" viewBox="0 0 16 16" width="14" height="14" role="img" aria-label="Verified owner"><title>Owner verified this domain</title><path d="M3 8.5l3.2 3L13 4.8" fill="none" stroke="currentColor" stroke-width="2"/></svg>';
      wall.innerHTML = a.length ? a.map((r) => { const nm = esc(name(r)); const inner = r.verified && r.domain ? `<a href="/result.html?d=${encodeURIComponent(r.domain)}">${nm}</a>${CHK}` : `<span>${nm}</span>`; return `<li>${inner}<span class="wg">A ${esc(r.score)}</span></li>`; }).join("")
        : '<li class="empty">No A grades listed yet. After a check, owners can choose to list their score.</li>';
      if (a.length > 12) {
        const lis = [...wall.children]; lis.slice(12).forEach((li) => { li.hidden = true; });
        const more = document.createElement("button"); more.type = "button"; more.className = "btn btn-sm btn-line"; more.textContent = `Show ${a.length - 12} more`;
        more.addEventListener("click", () => { lis.forEach((li) => { li.hidden = false; }); more.remove(); });
        wall.after(more);
      }
    }
    ticker(dedupe(d.latest));
    if (Number.isFinite(n)) { const t = $("sb-total"); t.hidden = false; t.textContent = `${n.toLocaleString()} site${n === 1 ? "" : "s"} checked so far`; }
  }).catch((e) => {
    const el = $("sb-err"); el.hidden = false;
    el.textContent = e.status === 429 ? "Too many requests. Give it a minute and refresh." : "We could not load the public scores. Refresh to try again.";
    ["fame", "flame", "wall"].forEach((k) => { if ($(k)) $(k).innerHTML = k === "wall" ? "" : `<div class="empty"><p class="em-big">Public scores are unavailable right now.</p><p>Please refresh in a minute.</p></div>`; });
  });
})();
