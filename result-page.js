// Public result page: shows only what the badge endpoint returns (A and B results from our stored scans).
(function () {
  const B = window.DeployVetBadge; if (!B) return;
  const out = document.getElementById("rs-out"), h = document.getElementById("rs-h"), esc = B.esc;
  const d = B.norm(new URLSearchParams(location.search).get("d"));
  if (!d) { out.innerHTML = `<p>Enter a site on the <a href="/badge.html">badge page</a> to see its result.</p>`; return; }
  document.title = `${d} result | DeployVet`; h.textContent = `Outside-in check: ${d}`;
  B.info(d, true).then((i) => {
    if (!i) { out.innerHTML = `<p>We have no public A or B result for <b>${esc(d)}</b>. We only show results that score a B or better, and only for the latest check.</p>`; return; }
    const u = B.urls(d);
    out.innerHTML = `<p class="rs-grade"><span class="rs-g rs-${esc(i.grade)}${i.stale ? " rs-old" : ""}">${esc(i.grade)}</span> <span><b>${esc(i.score)}/100</b><br><span class="small">Checked ${esc(i.date_label)}${i.stale ? ` (${esc(i.days_old)} days ago, so this result is old)` : ""}</span></span></p>
      <p><img src="${esc(u.img)}" alt="DeployVet badge: ${esc(i.grade)}, ${esc(i.score)} out of 100, ${esc(i.date_label)}" height="24"></p>
      ${i.before ? `<h2>Before and after</h2><p class="small">${esc(i.before.score)}/100 on ${esc(String(i.before.at).slice(0, 10))}, now ${esc(i.score)}/100.</p><img class="ba-img" src="${esc(u.card)}" alt="Score before and after for ${esc(d)}" width="600" height="315" loading="lazy">` : ""}
      <p class="small">Own this site? <a href="/badge.html?d=${encodeURIComponent(d)}">Get the badge and embed code</a>.</p>`;
  }).catch(() => { out.innerHTML = `<p>We could not load this result right now. Please try again in a minute.</p>`; });
})();
