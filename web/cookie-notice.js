(function () {
  if (localStorage.getItem("bv_cookie_notice") === "dismissed") return;

  var banner = document.createElement("div");
  banner.id = "cookieNotice";
  banner.setAttribute("role", "status");
  banner.setAttribute("aria-live", "polite");

  banner.style.cssText =
    "position:fixed;bottom:0;left:0;right:0;z-index:9999;" +
    "background:rgba(9,8,9,0.96);backdrop-filter:blur(12px);" +
    "border-top:1px solid rgba(201,168,76,0.12);" +
    "padding:14px 20px;display:flex;align-items:center;justify-content:center;" +
    "gap:14px;flex-wrap:wrap;font-family:Manrope,system-ui,sans-serif;font-size:13px;" +
    "color:rgba(255,255,255,0.65);line-height:1.5;";

  banner.innerHTML =
    '<span>This site uses essential cookies for login and secure payments. No tracking cookies. ' +
    '<a href="/privacy" style="color:#c9a84c;text-decoration:underline;">Learn more</a></span>' +
    '<button id="cookieOk" style="background:#c9a84c;color:#090809;border:none;padding:7px 18px;' +
    "border-radius:6px;font-size:12px;font-weight:700;letter-spacing:0.04em;cursor:pointer;" +
    'text-transform:uppercase;white-space:nowrap;">Got it</button>';

  document.body.appendChild(banner);

  document.getElementById("cookieOk").addEventListener("click", function () {
    localStorage.setItem("bv_cookie_notice", "dismissed");
    banner.remove();
  });
})();
