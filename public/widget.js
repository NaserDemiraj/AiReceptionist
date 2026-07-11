/**
 * AI Receptionist — embeddable chat widget loader.
 *
 * Usage (one line on any website):
 *   <script src="https://YOUR-APP-DOMAIN/widget.js" data-key="WIDGET_KEY" async></script>
 *
 * Appearance (color, position) is configured in the dashboard; a
 * data-color attribute on the script tag overrides it if present.
 */
(function () {
  // document.currentScript is null when the script is injected dynamically
  // (e.g. by React/Next) — fall back to finding our own tag by src.
  var script =
    document.currentScript ||
    (function () {
      var tags = document.querySelectorAll('script[src*="widget.js"][data-key]');
      return tags.length ? tags[tags.length - 1] : null;
    })();
  if (!script) {
    console.error("[ai-receptionist] widget.js: could not locate own script tag");
    return;
  }
  var key = script.getAttribute("data-key");
  if (!key) {
    console.error("[ai-receptionist] widget.js: missing data-key attribute");
    return;
  }
  var origin = new URL(script.getAttribute("src"), window.location.href).origin;

  function mount(config) {
    var accent = script.getAttribute("data-color") || config.color || "#5B57D4";
    var side = config.position === "left" ? "left" : "right";

    var btn = document.createElement("button");
    btn.setAttribute("aria-label", "Open chat");
    btn.style.cssText =
      "position:fixed;bottom:22px;" + side + ":22px;width:58px;height:58px;border-radius:50%;" +
      "background:" + accent + ";border:none;cursor:pointer;z-index:2147483000;" +
      "box-shadow:0 8px 30px rgba(0,0,0,0.25);display:flex;align-items:center;justify-content:center;" +
      "transition:transform .15s ease";
    btn.onmouseenter = function () { btn.style.transform = "scale(1.06)"; };
    btn.onmouseleave = function () { btn.style.transform = "scale(1)"; };

    var chatIcon =
      '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2M20 14h2M15 13v2M9 13v2"/></svg>';
    var closeIcon =
      '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>';
    btn.innerHTML = chatIcon;

    var frame = document.createElement("iframe");
    frame.src = origin + "/widget/chat?key=" + encodeURIComponent(key);
    frame.title = "Chat";
    frame.style.cssText =
      "position:fixed;bottom:92px;" + side + ":22px;width:380px;height:600px;max-height:calc(100vh - 120px);" +
      "max-width:calc(100vw - 44px);border:none;border-radius:18px;z-index:2147483000;" +
      "box-shadow:0 20px 60px rgba(0,0,0,0.3);background:#fff;display:none;overflow:hidden";

    var open = false;
    btn.addEventListener("click", function () {
      open = !open;
      frame.style.display = open ? "block" : "none";
      btn.innerHTML = open ? closeIcon : chatIcon;
    });

    document.body.appendChild(frame);
    document.body.appendChild(btn);
  }

  function boot() {
    fetch(origin + "/api/v1/widget/config?key=" + encodeURIComponent(key))
      .then(function (r) { return r.ok ? r.json() : {}; })
      .catch(function () { return {}; })
      .then(function (config) { mount(config || {}); });
  }

  if (document.body) boot();
  else document.addEventListener("DOMContentLoaded", boot);
})();
