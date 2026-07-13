(function () {
  var root = document.documentElement;
  var themeButton = document.getElementById("theme-toggle");
  var rippleButton = document.getElementById("ripple-toggle");
  var waterLayer = document.querySelector(".water-layer");
  var modes = ["system", "light", "dark"];

  function applyMode(mode) {
    var dark = mode === "dark" || (mode === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
    root.dataset.theme = dark ? "dark" : "light";
    root.dataset.mode = mode;
    localStorage.setItem("usho-color-mode", mode);
  }

  if (themeButton) {
    themeButton.addEventListener("click", function () {
      var current = root.dataset.mode || "system";
      applyMode(modes[(modes.indexOf(current) + 1) % modes.length]);
    });
  }

  var rippleEnabled = localStorage.getItem("usho-ripple") !== "off";
  if (rippleButton) {
    rippleButton.setAttribute("aria-pressed", String(rippleEnabled));
    rippleButton.addEventListener("click", function () {
      rippleEnabled = !rippleEnabled;
      localStorage.setItem("usho-ripple", rippleEnabled ? "on" : "off");
      rippleButton.setAttribute("aria-pressed", String(rippleEnabled));
      if (!rippleEnabled && waterLayer) waterLayer.replaceChildren();
    });
  }

  document.addEventListener("pointerdown", function (event) {
    if (!rippleEnabled || !waterLayer) return;
    if (event.target.closest("a, button, input, textarea, select")) return;
    var ring = document.createElement("i");
    ring.style.left = event.clientX + "px";
    ring.style.top = event.clientY + "px";
    waterLayer.appendChild(ring);
    ring.addEventListener("animationend", function () { ring.remove(); });
  });
})();