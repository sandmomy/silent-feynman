(function () {
  if (localStorage.getItem("fv_cookie_notice") === "dismissed") return;

  var banner = document.createElement("div");
  banner.id = "cookieNotice";
  banner.setAttribute("role", "status");
  banner.setAttribute("aria-live", "polite");

  banner.style.cssText =
    "position:fixed;bottom:0;left:0;right:0;z-index:9999;" +
    "background:rgba(6,9,19,0.96);backdrop-filter:blur(12px);" +
    "border-top:1px solid rgba(212,175,55,0.15);" +
    "padding:16px 24px;display:flex;align-items:center;justify-content:center;" +
    "gap:16px;flex-wrap:wrap;font-family:Inter,system-ui,sans-serif;font-size:13px;" +
    "color:rgba(255,255,255,0.7);line-height:1.5;";

  banner.innerHTML =
    '<span>This site uses essential cookies for authentication and secure payment processing. No tracking or advertising cookies are used. ' +
    '<a href="privacy.html" style="color:#D4AF37;text-decoration:underline;">Learn more</a></span>' +
    '<button id="cookieOk" style="background:#D4AF37;color:#000;border:none;padding:8px 20px;' +
    "border-radius:6px;font-size:12px;font-weight:600;letter-spacing:0.04em;cursor:pointer;" +
    'text-transform:uppercase;white-space:nowrap;">Got it</button>';

  document.body.appendChild(banner);

  document.getElementById("cookieOk").addEventListener("click", function () {
    localStorage.setItem("fv_cookie_notice", "dismissed");
    banner.remove();
  });
})();
