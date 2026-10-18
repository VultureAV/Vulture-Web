"use strict";

/*
 * Shared between background.js, content.js and popup.js.
 * Single source of truth for defaults, validation and OS profiles, so the
 * three scripts can no longer drift apart (they used to carry three separate
 * copies of DEFAULTS with different values).
 */
const VW = (() => {
  const DEFAULT_TOGGLES = {
    cleanNone: true,
    cleanUrls: true,
    dnt: true,
    battery: true,
    data: true,
    codecs: true,
    canvas: true,
    audio: true,
    fonts: true,
    devices: true,
    webrtc: true,
    httpsUpgrade: true,
    blockPings: true,
    blockLocalNet: true,
    blockThirdPartyCookies: false,
  };
  const TOGGLES = Object.keys(DEFAULT_TOGGLES);

  // Everything that has to agree for an OS spoof to look real:
  // navigator.platform / userAgent / appVersion / oscpu, the User-Agent header,
  // the font set and the reserved taskbar area (screen.avail*).
  const OS_PROFILES = {
    windows: {
      label: "Windows",
      platform: "Win32",
      uaToken: "Windows NT 10.0; Win64; x64",
      oscpu: "Windows NT 10.0; Win64; x64",
      appVersion: "5.0 (Windows)",
      taskbar: 40,
    },
    macos: {
      label: "macOS",
      platform: "MacIntel",
      uaToken: "Macintosh; Intel Mac OS X 10.15",
      oscpu: "Intel Mac OS X 10.15",
      appVersion: "5.0 (Macintosh)",
      taskbar: 25,
    },
    linux: {
      label: "Linux",
      platform: "Linux x86_64",
      uaToken: "X11; Linux x86_64",
      oscpu: "Linux x86_64",
      appVersion: "5.0 (X11)",
      taskbar: 0,
    },
  };

  const FIRST_RUN = {
    enabled: true,
    ...DEFAULT_TOGGLES,
    screenWidth: 1920,
    screenHeight: 1080,
    referer: "https://www.google.com/",
    lang: "en-US,en;q=0.9",
    timeZone: "Europe/London",
    angle: "ANGLE (NVIDIA, NVIDIA GeForce GTX 980 Direct3D11 vs_5_0 ps_5_0), or similar",
    googleinc: "Google Inc. (NVIDIA)",
    osProfile: "windows",
    os: "",
    hardwareConcurrency: 8,
    allowlist: "",
  };

  /* ---------- small parsers / validators ---------- */

  function toInt(v, lo, hi) {
    let n = NaN;
    if (typeof v === "number") n = v;
    else if (typeof v === "string" && /^\s*\d{1,5}\s*$/.test(v)) n = Number(v);
    return Number.isInteger(n) && n >= lo && n <= hi ? n : null;
  }

  function printable(v, max) {
    return typeof v === "string" ? v.replace(/[^\x20-\x7E]/g, "").trim().slice(0, max) : "";
  }

  function normLang(v) {
    const s = typeof v === "string" ? v.trim() : "";
    if (!s || !/^[A-Za-z0-9\-,;=.\s*]{2,100}$/.test(s)) return "";
    if (!/^(?:[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*|\*)/.test(s)) return "";
    return s.replace(/\s+/g, "");
  }

  function languagesFrom(lang) {
    return normLang(lang)
      .split(",")
      .map((p) => p.split(";")[0].trim())
      .filter((p) => p && p !== "*");
  }

  function normTz(v) {
    const s = typeof v === "string" ? v.trim() : "";
    if (!s || s.length > 64) return "";
    try {
      return new Intl.DateTimeFormat("en-US", { timeZone: s }).resolvedOptions().timeZone;
    } catch (_) {
      return "";
    }
  }

  function normReferer(v) {
    const s = typeof v === "string" ? v.trim() : "";
    if (!s) return "";
    try {
      const u = new URL(s);
      if (u.protocol !== "http:" && u.protocol !== "https:") return "";
      u.username = "";
      u.password = "";
      u.hash = "";
      return u.href;
    } catch (_) {
      return "";
    }
  }

  function parseAllowlist(v) {
    const arr = Array.isArray(v) ? v : typeof v === "string" ? v.split(/[\s,;]+/) : [];
    const out = arr
      .map((s) =>
        String(s)
          .trim()
          .toLowerCase()
          .replace(/^[a-z]+:\/\//, "")
          .replace(/^\*\./, "")
          .replace(/[\/:?#].*$/, "")
      )
      .filter((h) => /^[a-z0-9]([a-z0-9.\-]*[a-z0-9])?$/.test(h));
    return [...new Set(out)].slice(0, 500);
  }

  function isAllowlisted(host, list) {
    if (!host || !list || !list.length) return false;
    host = host.toLowerCase();
    return list.some((e) => host === e || host.endsWith("." + e));
  }

  function hostOf(url) {
    try {
      return new URL(url).hostname.toLowerCase();
    } catch (_) {
      return "";
    }
  }

  // Heuristic registrable domain (no public-suffix list available offline).
  const SLD = new Set(["co", "com", "org", "net", "gov", "edu", "ac", "or", "ne", "go"]);
  function siteOf(host) {
    if (!host) return "";
    if (host.includes(":") || /^[\d.]+$/.test(host)) return host;
    const p = host.split(".");
    if (p.length <= 2) return host;
    const tld = p[p.length - 1];
    const sld = p[p.length - 2];
    return tld.length === 2 && SLD.has(sld) ? p.slice(-3).join(".") : p.slice(-2).join(".");
  }

  function isPrivateHost(h) {
    h = String(h || "").toLowerCase();
    if (!h) return false;
    if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal")) return true;
    if (h.startsWith("[")) {
      const v = h.slice(1, -1);
      return v === "::1" || v === "::" || /^f[cd]/.test(v) || /^fe[89ab]/.test(v) || /^::ffff:(7f|0a|c0a8|a9fe)/.test(v);
    }
    const m = h.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
    if (!m) return false;
    const a = +m[1];
    const b = +m[2];
    return (
      a === 0 || a === 10 || a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168)
    );
  }

  // Replace only the OS part of a real Firefox UA, keeping Firefox's own rv:/version.
  function spoofUA(ua, token) {
    if (typeof ua !== "string" || !token) return ua;
    return ua.replace(/\(([^)]*?)(rv:[\d.]+)\)/, "(" + token + "; $2)");
  }

  function validateField(name, raw) {
    const v = typeof raw === "string" ? raw.trim() : raw;
    if (v === "" || v == null) return "";
    switch (name) {
      case "screenWidth": return toInt(v, 800, 7680) === null ? "Use a number from 800 to 7680" : "";
      case "screenHeight": return toInt(v, 600, 4320) === null ? "Use a number from 600 to 4320" : "";
      case "hardwareConcurrency": return toInt(v, 1, 128) === null ? "Use a number from 1 to 128" : "";
      case "referer": return normReferer(v) ? "" : "Must be a full http(s) URL";
      case "lang": return normLang(v) ? "" : "Example: en-US,en;q=0.9";
      case "timeZone": return normTz(v) ? "" : "Unknown IANA timezone (e.g. Europe/Warsaw)";
      case "angle": return printable(v, 200) === v ? "" : "Printable ASCII only, max 200 chars";
      case "googleinc": return printable(v, 120) === v ? "" : "Printable ASCII only, max 120 chars";
      case "os": return printable(v, 40) === v ? "" : "Printable ASCII only, max 40 chars";
      default: return "";
    }
  }

  function legacyOsProfile(os) {
    const s = printable(os, 40);
    if (!s) return "";
    if (/win/i.test(s)) return "windows";
    if (/mac|darwin/i.test(s)) return "macos";
    if (/linux|x11|bsd/i.test(s)) return "linux";
    return "custom";
  }

  /* ---------- the one function everything reads config through ---------- */
  function normalizeConfig(raw) {
    raw = raw && typeof raw === "object" ? raw : {};
    const out = { enabled: raw.enabled !== false };
    for (const k of TOGGLES) out[k] = typeof raw[k] === "boolean" ? raw[k] : DEFAULT_TOGGLES[k];

    const w = toInt(raw.screenWidth, 800, 7680);
    const h = toInt(raw.screenHeight, 600, 4320);
    out.screenWidth = w && h ? w : null; // both or neither
    out.screenHeight = w && h ? h : null;

    out.referer = normReferer(raw.referer);
    out.lang = normLang(raw.lang);
    out.timeZone = normTz(raw.timeZone);
    out.angle = printable(raw.angle, 200);
    out.googleinc = printable(raw.googleinc, 120);
    out.hardwareConcurrency = toInt(raw.hardwareConcurrency, 1, 128);
    out.os = printable(raw.os, 40);

    let p = typeof raw.osProfile === "string" ? raw.osProfile : legacyOsProfile(raw.os);
    if (!["", "windows", "macos", "linux", "custom"].includes(p)) p = "";
    if (p === "custom" && !out.os) p = "";
    out.osProfile = p;

    out.allowlist = parseAllowlist(raw.allowlist);
    return out;
  }

  return {
    TOGGLES, DEFAULT_TOGGLES, FIRST_RUN, OS_PROFILES,
    normalizeConfig, validateField, languagesFrom, parseAllowlist, isAllowlisted,
    hostOf, siteOf, isPrivateHost, spoofUA,
  };
})();
