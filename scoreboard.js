// Scoreboard page. GET leaderboard -> { fame: [], flame: [], totals: { roasts } }. Spec: app/LEADERBOARD.md
// Rank is computed here. Ties share a rank (1, 2, 2, 4). No fake rows, ever.
(function () {
  const D = window.DeployVet; if (!D) return;
  const esc = D.esc;
  const $ = (id) => document.getElementById(id);
  const rank = (rows) => { let prev = null, rk = 0; return rows.map((r, i) => { if (r.score !== prev) { rk = i + 1; prev = r.score; } return { ...r, rank: rk }; }); };
  const roasts = (n) => Number.isFinite(n) ? `${n.toLocaleString()} app${n === 1 ? " has" : "s have"} been roasted` : "Apps are getting roasted";
  const EMPTY = {
    fame: (n) => `<div class="empty"><p class="em-big">the trophy shelf is empty. be so for real.</p><p>${esc(roasts(n))}, and not one owner was confident enough to claim a spot. think your app can take it? prove it.</p><a class="btn btn-sm btn-y" href="/#check">Roast my app</a></div>`,
    flame: (n) => `<div class="empty"><p class="em-big">nobody: <br>literally nobody: <br>this board:</p><p>${esc(roasts(n))} and every owner is hiding their score. be the first one with the guts (and a domain you own).</p><a class="btn btn-sm" href="/#check">Roast my app</a></div>`,
  };
  const list = (rows, kind, n) => {
    if (!Array.isArray(rows) || !rows.length) return EMPTY[kind](n);
    return `<ol>${rank(rows).map((r) => `<li><span class="rk">#${esc(r.rank)}</span>
      <span><span class="nm">${esc(r.display_name || r.domain)}</span>${r.display_name ? `<span class="dm">${esc(r.domain)}</span>` : ""}<span class="ln">${esc(D.roastLine(r.grade, r))}</span></span>
      <span class="sc">${esc(r.score)}<span class="gr">${esc(r.grade)}</span></span></li>`).join("")}</ol>`;
  };
  D.call("leaderboard", null, "GET").then((d) => {
    const n = d.totals ? Number(d.totals.roasts) : NaN;
    $("fame").innerHTML = list(d.fame, "fame", n);
    $("flame").innerHTML = list(d.flame, "flame", n);
    if (Number.isFinite(n)) { const t = $("sb-total"); t.hidden = false; t.textContent = `${n.toLocaleString()} app${n === 1 ? "" : "s"} roasted so far`; }
  }).catch((e) => {
    const el = $("sb-err"); el.hidden = false;
    el.textContent = e.status === 429 ? "Too many requests. Give it a minute and refresh." : "We couldn't load the scoreboard. Refresh to try again.";
    ["fame", "flame"].forEach((k) => { $(k).innerHTML = `<div class="empty"><p class="em-big">Scoreboard is taking a nap.</p><p>Refresh in a bit.</p></div>`; });
  });
})();
