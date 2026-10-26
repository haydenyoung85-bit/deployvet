// Badge helper: reads the stored result for a domain from our badge endpoint and renders the embed codes.
// The image itself is drawn by DeployVet from the stored scan. Nothing here can change the grade, score or date.
(function () {
  const C = window.DEPLOYVET_CONFIG || {};
  const FN = (C.SUPABASE_URL || "") + "/functions/v1/badge", SITE = "https://deployvet.com";
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const norm = (v) => String(v || "").trim().toLowerCase().replace(/^[a-z]+:\/\//, "").replace(/[\/?#].*$/, "").replace(/:\d+$/, "").replace(/^www\./, "").replace(/\.$/, "");
  const urls = (d) => { const q = encodeURIComponent(d); return { img: `${FN}?d=${q}`, result: `${SITE}/result.html?d=${q}`, card: `${FN}?d=${q}&view=before-after` }; };
  async function info(d, fresh) {
    const r = await fetch(`${FN}?d=${encodeURIComponent(d)}&format=json${fresh ? "&t=" + Date.now() : ""}`);
    if (r.status === 404) return null;
    if (!r.ok) throw new Error("badge " + r.status);
    return r.json();
  }
  const codes = (d, i) => { const u = urls(d), alt = `DeployVet outside-in check result for ${d}`;
    return { html: `<a href="${u.result}" title="DeployVet outside-in check. Not a certification."><img src="${u.img}" alt="${alt}" height="24"></a>`, md: `[![${alt}](${u.img})](${u.result})` }; };
  const shareText = (d, i) => `${d} scored ${i.grade} (${i.score}/100) on a DeployVet outside-in check on ${i.date_label}.`;
  async function copy(btn, text, ta) {
    const old = btn.textContent;
    try { await navigator.clipboard.writeText(text); btn.textContent = "Copied"; setTimeout(() => { btn.textContent = old; }, 1600); }
    catch (_) { if (ta) { ta.focus(); ta.select(); } }
  }
  // opts.compact hides the long explanation (used in the result popup).
  function render(el, d, i, opts) {
    opts = opts || {}; const u = urls(d), c = codes(d, i);
    el.innerHTML = `
      <p class="bdg-prev"><img src="${esc(u.img)}" alt="Badge preview: ${esc(i.grade)}, ${esc(i.score)} out of 100, ${esc(i.date_label)}" height="24"></p>
      <p class="small">${opts.compact ? "Shows the grade, score and date of our stored check, and links to the public result." : "The badge shows the grade, score and date of our stored check for this site. It cannot be edited, and it is marked old after 30 days."} It is an outside-in check, not a certification.</p>
      <label for="bdg-html-${esc(opts.id || "x")}">HTML</label>
      <textarea id="bdg-html-${esc(opts.id || "x")}" readonly rows="5">${esc(c.html)}</textarea>
      <button type="button" class="btn btn-sm btn-line" data-copy="html" data-track="badge-copy-html">Copy HTML</button>
      <label for="bdg-md-${esc(opts.id || "x")}">Markdown</label>
      <textarea id="bdg-md-${esc(opts.id || "x")}" readonly rows="4">${esc(c.md)}</textarea>
      <button type="button" class="btn btn-sm btn-line" data-copy="md" data-track="badge-copy-md">Copy markdown</button>
      <p class="bdg-row"><button type="button" class="btn btn-sm" data-share data-track="badge-share">Share this result</button>
      <a class="btn btn-sm btn-line" href="${esc(u.result)}" target="_blank" rel="noopener">Open public result</a></p>
      <span class="small" data-note aria-live="polite"></span>
      ${i.before ? `<div class="ba"><h3>Before and after</h3><p class="small">${esc(i.before.score)}/100 on ${esc(String(i.before.at).slice(0, 10))}, now ${esc(i.score)}/100.</p>
        <img src="${esc(u.card)}" alt="Score before and after for ${esc(d)}: ${esc(i.before.score)} to ${esc(i.score)}" width="600" height="315" loading="lazy">
        <p class="bdg-row"><button type="button" class="btn btn-sm" data-share-ba data-track="badge-share-ba">Share before and after</button> <a class="btn btn-sm btn-line" href="${esc(u.card)}" target="_blank" rel="noopener">Open card image</a></p></div>` : ""}`;
    const note = el.querySelector("[data-note]");
    el.querySelectorAll("[data-copy]").forEach((b) => b.addEventListener("click", () => { const k = b.dataset.copy; copy(b, k === "html" ? c.html : c.md, b.previousElementSibling); }));
    const share = async (text) => {
      const data = { text, url: u.result };
      try { if (navigator.share) await navigator.share(data); else { await navigator.clipboard.writeText(`${text} ${u.result}`); note.textContent = "Link and text copied."; } }
      catch (e) { if (e.name !== "AbortError") note.textContent = "Could not share here. Copy the link: " + u.result; }
    };
    el.querySelector("[data-share]").addEventListener("click", () => share(shareText(d, i)));
    const ba = el.querySelector("[data-share-ba]");
    if (ba) ba.addEventListener("click", () => share(`${d}: ${i.before.score}/100 before, ${i.score}/100 now on a DeployVet outside-in check.`));
  }
  window.DeployVetBadge = { norm, info, urls, render, esc };
})();
