// Mobile nav: menu button below 640px. Without JS the links simply show.
(function () {
  var nav = document.querySelector(".nav"); if (!nav) return;
  var btn = nav.querySelector(".menu-btn"), list = nav.querySelector(".links"); if (!btn || !list) return;
  nav.classList.add("js");
  function set(open) { nav.classList.toggle("open", open); btn.setAttribute("aria-expanded", String(open)); btn.querySelector(".mb-l").textContent = open ? "Close" : "Menu"; }
  btn.addEventListener("click", function () { set(btn.getAttribute("aria-expanded") !== "true"); if (nav.classList.contains("open")) { var a = list.querySelector("a"); if (a) a.focus(); } });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && nav.classList.contains("open")) { set(false); btn.focus(); } });
  document.addEventListener("click", function (e) { if (nav.classList.contains("open") && (!nav.contains(e.target) || e.target.closest(".links a"))) set(false); });
  matchMedia("(min-width: 640px)").addEventListener("change", function (m) { if (m.matches) set(false); });
})();
