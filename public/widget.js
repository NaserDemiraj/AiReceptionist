/**
 * AI Receptionist — embeddable chat widget loader.
 *
 * Usage (one line on any website):
 *   <script src="https://YOUR-APP-DOMAIN/widget.js" data-key="WIDGET_KEY" async></script>
 */
(function () {
  var script = document.currentScript;
  if (!script) return;
  var key = script.getAttribute("data-key");
  if (!key) {
    console.error("[ai-receptionist] widget.js: missing data-key attribute");
    return;
  }
  var origin = new URL(script.src).origin;
  var ACCENT = script.getAttribute("data-color") || "#5B57D4";

  // ---- launcher button ----
  var btn = document.createElement("button");
  btn.setAttribute("aria-label", "Open chat");
  btn.style.cssText =
    "position:fixed;bottom:22px;right:22px;width:58px;height:58px;border-radius:50%;" +
    "background:" + ACCENT + ";border:none;cursor:pointer;z-index:2147483000;" +
    "box-shadow:0 8px 30px rgba(0,0,0,0.25);display:flex;align-items:center;justify-content:center;" +
    "transition:transform .15s ease";
  btn.onmouseenter = function () { btn.style.transform = "scale(1.06)"; };
  btn.onmouseleave = function () { btn.style.transform = "scale(1)"; };

  var chatIcon =
    '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2M20 14h2M15 13v2M9 13v2"/></svg>';
  var closeIcon =
    '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>';
  btn.innerHTML = chatIcon;

  // ---- iframe panel ----
  var frame = document.createElement("iframe");
  frame.src = origin + "/widget/chat?key=" + encodeURIComponent(key);
  frame.title = "Chat";
  frame.style.cssText =
    "position:fixed;bottom:92px;right:22px;width:380px;height:600px;max-height:calc(100vh - 120px);" +
    "max-width:calc(100vw - 44px);border:none;border-radius:18px;z-index:2147483000;" +
    "box-shadow:0 20px 60px rgba(0,0,0,0.3);background:#fff;display:none;overflow:hidden";

  var open = false;
  btn.addEventListener("click", function () {
    open = !open;
    frame.style.display = open ? "block" : "none";
    btn.innerHTML = open ? closeIcon : chatIcon;
  });

  function mount() {
    document.body.appendChild(frame);
    document.body.appendChild(btn);
  }
  if (document.body) mount();
  else document.addEventListener("DOMContentLoaded", mount);
})();
