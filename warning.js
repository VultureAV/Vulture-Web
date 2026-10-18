"use strict";

(function () {
  let target = "";
  try {
    const u = new URL(new URLSearchParams(location.search).get("u"));
    if (u.protocol === "http:") target = u.href;
  } catch (_) {}

  const go = document.getElementById("go");
  document.getElementById("target").textContent = target || "(invalid address)";
  if (!target) go.disabled = true;

  document.getElementById("back").addEventListener("click", () => {
    if (history.length > 1) history.back();
    else window.close();
  });
  go.addEventListener("click", () => {
    browser.runtime.sendMessage({ type: "vw:allowHttp", url: target });
  });
})();
