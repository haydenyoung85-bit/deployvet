// Compact newsletter signup at the bottom of each guide. Uses the existing double opt-in `newsletter` function.
(function () {
  var C = window.DEPLOYVET_CONFIG || {}, main = document.querySelector("main .guide") || document.querySelector("main");
  if (!main || !C.SUPABASE_URL) return;
  var box = document.createElement("form");
  box.className = "notice gsign"; box.setAttribute("novalidate", "");
  box.innerHTML = '<p><strong>Want the next guide when it drops?</strong> Occasional emails, no schedule. One confirm email, unsubscribe any time. <a href="/privacy.html">Privacy</a>.</p>' +
    '<input class="hp" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">' +
    '<div class="rr-row"><label class="sr" for="gs-email">Email</label><input id="gs-email" type="email" placeholder="you@email.com" required autocomplete="email">' +
    '<button type="submit" class="btn btn-y" data-track="newsletter-guide">Email me</button></div><p class="gs-res small" hidden aria-live="polite"></p>';
  main.appendChild(box);
  var res = box.querySelector(".gs-res"), btn = box.querySelector("button");
  box.addEventListener("submit", function (e) {
    e.preventDefault();
    var em = box.querySelector("#gs-email").value.trim();
    if (!/^\S+@\S+\.\S+$/.test(em)) { res.hidden = false; res.textContent = "That email doesn't look right."; return; }
    btn.disabled = true; res.hidden = false; res.textContent = "Sending…";
    fetch(C.SUPABASE_URL + "/functions/v1/newsletter", {
      method: "POST",
      headers: { "content-type": "application/json", apikey: C.SUPABASE_ANON_KEY, authorization: "Bearer " + C.SUPABASE_ANON_KEY },
      body: JSON.stringify({ email: em, source: "guide", website: box.querySelector("[name=website]").value })
    }).then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { if (!r.ok || d.error) throw new Error(d.error || "Something went wrong. Try again."); }); })
      .then(function () { res.textContent = "Almost done: we sent a confirm link. If you don't see it in a minute, check spam or promotions."; box.querySelector("#gs-email").value = ""; })
      .catch(function (err) { res.textContent = err.message; })
      .then(function () { btn.disabled = false; });
  });
})();
