// Scoreboard renderer, used on scoreboard.html (top 20) and the homepage block (top 5 + ticker).
// GET leaderboard -> { fame, flame, latest, totals: { roasts } }. Spec: app/LEADERBOARD.md
// Unverified rows have no domain: show nickname or masked domain. Rank is computed here (ties share). No fake rows, ever.
(function () {
  const D = window.DeployVet; if (!D) return;
  const esc = D.esc, $ = (id) => document.getElementById(id);
  if (!$("fame") && !$("flame")) return;
  const LIMIT = Number(document.body.dataset.boardLimit || 20);
  const name = (r) => r.display_name || r.domain || r.masked || "anonymous app";
  const rank = (rows) => { let prev = null, rk = 0; return rows.map((r, i) => { if (r.score !== prev) { rk = i + 1; prev = r.score; } return { ...r, rank: rk }; }); };
  const roasts = (n) => Number.isFinite(n) ? `${n.toLocaleString()} app${n === 1 ? " has" : "s have"} been roasted` : "apps are getting roasted";
  const EMPTY = {
    fame: (n) => `<div class="empty"><p class="em-big">the trophy shelf is empty. be so for real.</p><p>${esc(roasts(n))}, and not one owner was confident enough to claim a spot. think your app can take it? prove it.</p><a class="btn btn-sm btn-y" href="/#check">Roast my app</a></div>`,
    flame: (n) => `<div class="empty"><p class="em-big">nobody: <br>literally nobody: <br>this board:</p><p>${esc(roasts(n))} and every owner is hiding their score. be the first one with the guts. it's one click after your roast.</p><a class="btn btn-sm" href="/#check">Roast my app</a></div>`,
  };
  const list = (rows, kind, n) => {
    if (!Array.isArray(rows) || !rows.length) return EMPTY[kind](n);
    return `<ol>${rank(rows.slice(0, LIMIT)).map((r) => `<li><span class="rk">#${esc(r.rank)}</span>
      <span><span class="nm">${esc(name(r))}</span>${r.verified ? '<span class="vbadge" title="Owner verified this domain">✔ verified</span>' : ""}${r.display_name && r.domain ? `<span class="dm">${esc(r.domain)}</span>` : ""}<span class="ln">${esc(D.roastLine(r.grade, r))}</span></span>
      <span class="sc">${esc(r.score)}<span class="gr">${esc(r.grade)}</span></span></li>`).join("")}</ol>`;
  };
  const ticker = (rows) => {
    const el = $("ticker"); if (!el) return;
    if (!Array.isArray(rows) || !rows.length) { el.hidden = true; return; }
    const items = rows.map((r) => `<li><b>${esc(name(r))}</b> got ${esc(r.score)}/100 (${esc(r.grade)})</li>`).join("");
    el.hidden = false; el.innerHTML = `<p class="sr">Latest roasts</p><ul>${items}${rows.length > 2 ? items.replace(/<li>/g, '<li aria-hidden="true">') : ""}</ul>`;
  };
  D.call("leaderboard", null, "GET").then((d) => {
    const n = d.totals ? Number(d.totals.roasts) : NaN;
    $("fame").innerHTML = list(d.fame, "fame", n);
    $("flame").innerHTML = list(d.flame, "flame", n);
    ticker(d.latest);
    if (Number.isFinite(n)) { const t = $("sb-total"); t.hidden = false; t.textContent = `${n.toLocaleString()} app${n === 1 ? "" : "s"} roasted so far`; }
  }).catch((e) => {
    const el = $("sb-err"); el.hidden = false;
    el.textContent = e.status === 429 ? "Too many requests. Give it a minute and refresh." : "We couldn't load the scoreboard. Refresh to try again.";
    ["fame", "flame"].forEach((k) => { $(k).innerHTML = `<div class="empty"><p class="em-big">scoreboard is taking a nap.</p><p>refresh in a bit.</p></div>`; });
  });
})();
