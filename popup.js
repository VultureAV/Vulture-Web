"use strict";

(async function () {
  const $ = (id) => document.getElementById(id);
  const TEXT_FIELDS = ["screenWidth", "screenHeight", "hardwareConcurrency", "referer", "lang", "timeZone", "angle", "googleinc", "os"];
  const NUMERIC = new Set(["screenWidth", "screenHeight", "hardwareConcurrency"]);

  const stored = await browser.storage.local.get(null);
  const cfg = VW.normalizeConfig(stored);

  /* ---------- toggles ---------- */
  $("enabled").checked = cfg.enabled;
  $("enabled").addEventListener("change", () => browser.storage.local.set({ enabled: $("enabled").checked }));

  for (const key of VW.TOGGLES) {
    const el = $(key);
    if (!el) continue;
    el.checked = cfg[key];
    el.addEventListener("change", () => {
      browser.storage.local.set({ [key]: el.checked });
      updateWarnings();
    });
  }

  /* ---------- text fields ---------- */
  // Raw stored values are shown (not the normalised ones) so a value that is invalid
  // is visible and fixable instead of silently turning into a blank field.
  for (const f of TEXT_FIELDS) $(f).value = stored[f] === undefined || stored[f] === null ? "" : String(stored[f]);
  $("osProfile").value = cfg.osProfile;
  $("allowlist").value = cfg.allowlist.join("\n");

  const timers = new Map();

  function showErr(id, msg) {
    const el = $("err-" + id);
    if (el) el.textContent = msg;
  }

  // Only valid (or empty) values are written. Invalid input used to be stored as typed -
  // a half-typed timezone made the page script throw on every site.
  function saveField(id) {
    clearTimeout(timers.get(id));
    timers.delete(id);
    const v = $(id).value.trim();
    const err = VW.validateField(id, v);
    showErr(id, err);
    if (err) return Promise.resolve();
    return browser.storage.local.set({ [id]: NUMERIC.has(id) && v !== "" ? Number(v) : v });
  }

  function saveAllowlist() {
    clearTimeout(timers.get("allowlist"));
    timers.delete("allowlist");
    return browser.storage.local.set({ allowlist: VW.parseAllowlist($("allowlist").value).join("\n") });
  }

  function schedule(id, fn) {
    clearTimeout(timers.get(id));
    timers.set(id, setTimeout(fn, 400));
  }

  for (const id of TEXT_FIELDS) {
    const el = $(id);
    el.addEventListener("input", () => {
      showErr(id, VW.validateField(id, el.value));
      schedule(id, () => saveField(id));
      updateWarnings();
    });
    el.addEventListener("change", () => saveField(id)); // blur: don't wait for the debounce
  }
  $("allowlist").addEventListener("input", () => schedule("allowlist", saveAllowlist));
  $("allowlist").addEventListener("change", saveAllowlist);

  // The popup is destroyed the moment it loses focus - flush anything still pending.
  window.addEventListener("pagehide", () => {
    for (const id of [...timers.keys()]) id === "allowlist" ? saveAllowlist() : saveField(id);
  });

  /* ---------- OS profile ---------- */
  function syncOsRow() {
    $("osCustomRow").hidden = $("osProfile").value !== "custom";
  }
  $("osProfile").addEventListener("change", () => {
    syncOsRow();
    browser.storage.local.set({ osProfile: $("osProfile").value });
    updateWarnings();
  });
  syncOsRow();

  // Mismatches between the selected OS and the other spoofed values are themselves a fingerprint.
  function updateWarnings() {
    const prof = $("osProfile").value;
    const gpu = $("angle").value;
    const msgs = [];
    if ((prof === "macos" || prof === "linux") && /Direct3D|D3D11/i.test(gpu)) {
      msgs.push("The graphics string is Windows-specific (Direct3D) but the OS is " + VW.OS_PROFILES[prof].label + ".");
    }
    if (prof === "windows" && /Metal|Mesa/i.test(gpu)) {
      msgs.push("The graphics string doesn't look like a Windows GPU.");
    }
    if (prof && !$("fonts").checked) {
      msgs.push("Font spoofing is off, so your real fonts can still reveal your actual OS.");
    }
    $("warn").textContent = msgs.join(" ");
  }
  updateWarnings();

  /* ---------- per-site pause ---------- */
  let siteHost = "";
  try {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (tab && /^https?:/i.test(tab.url || "")) siteHost = VW.hostOf(tab.url);
  } catch (_) {}

  function renderSite(list) {
    $("siteHost").textContent = siteHost || "No website in this tab";
    const btn = $("siteBtn");
    if (!siteHost) { $("siteState").textContent = ""; btn.disabled = true; return; }
    const exact = list.includes(siteHost);
    const parent = !exact && VW.isAllowlisted(siteHost, list);
    $("siteState").textContent = exact
      ? "Protections are paused on this site"
      : parent ? "Paused through a parent domain (edit the allowlist below)" : "Protections are active";
    btn.textContent = exact ? "Resume here" : "Pause here";
    btn.disabled = parent;
  }
  renderSite(cfg.allowlist);

  $("siteBtn").addEventListener("click", async () => {
    const list = VW.parseAllowlist($("allowlist").value);
    const next = list.includes(siteHost) ? list.filter((h) => h !== siteHost) : [...list, siteHost];
    $("allowlist").value = next.join("\n");
    await browser.storage.local.set({ allowlist: next.join("\n") });
    renderSite(next);
  });

  /* ---------- reset (two clicks, window.confirm is unreliable in popups) ---------- */
  let resetArmed = false;
  $("resetBtn").addEventListener("click", async () => {
    const btn = $("resetBtn");
    if (!resetArmed) {
      resetArmed = true;
      btn.textContent = "Click again to confirm";
      setTimeout(() => { resetArmed = false; btn.textContent = "Reset to defaults"; }, 3000);
      return;
    }
    await browser.storage.local.clear();
    await browser.storage.local.set(VW.FIRST_RUN);
    window.location.reload();
  });

  $("version").textContent = "v" + browser.runtime.getManifest().version;
})();
