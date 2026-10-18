"use strict";

/* ------------------------------------------------------------------ *
 *  Config
 * ------------------------------------------------------------------ */
let cfg = VW.normalizeConfig({});
let lastWebrtcApplied = null;

async function loadConfig() {
  try {
    cfg = VW.normalizeConfig(await browser.storage.local.get(null));
  } catch (_) {}
  applyPrivacySettings();
}
const ready = loadConfig();

browser.storage.onChanged.addListener((_changes, area) => {
  if (area === "local") loadConfig();
});

browser.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === "install") {
    await browser.storage.local.set(VW.FIRST_RUN);
    await loadConfig();
    browser.tabs.create({ url: browser.runtime.getURL("welcome.html") });
  } else if (details.reason === "update") {
    // Upgrade path from 1.0.x: the old free-text "os" field becomes a real profile.
    const stored = await browser.storage.local.get(null);
    if (stored.osProfile === undefined) {
      await browser.storage.local.set({ osProfile: VW.normalizeConfig(stored).osProfile });
    }
  }
});

/* ------------------------------------------------------------------ *
 *  WebRTC IP-leak protection (browser-wide privacy setting)
 *  default_public_interface_only: hides local/LAN addresses but keeps calls working.
 * ------------------------------------------------------------------ */
async function applyPrivacySettings() {
  const pref = browser.privacy && browser.privacy.network && browser.privacy.network.webRTCIPHandlingPolicy;
  if (!pref) return;
  const want = cfg.enabled && cfg.webrtc;
  if (want === lastWebrtcApplied) return;
  try {
    if (want) await pref.set({ value: "default_public_interface_only" });
    else await pref.clear({});
    lastWebrtcApplied = want;
  } catch (_) {}
}

/* ------------------------------------------------------------------ *
 *  Tracker domains / params
 * ------------------------------------------------------------------ */
// NOTE: fbcdn.net was removed - it is Facebook/Instagram's image+video CDN and
// blocking it broke those sites entirely.
const TRACKER_DOMAINS = new Set([
  "google-analytics.com", "googletagmanager.com", "doubleclick.net",
  "googlesyndication.com", "googleadservices.com", "adservice.google.com",
  "facebook.net", "connect.facebook.net",
  "ads.twitter.com", "analytics.twitter.com", "static.ads-twitter.com",
  "bat.bing.com", "ads.linkedin.com", "px.ads.linkedin.com", "analytics.tiktok.com",
  "analytics.yahoo.com",
  "hotjar.com", "fullstory.com", "mouseflow.com",
  "mixpanel.com", "segment.io", "segment.com",
  "amplitude.com", "heap.io", "clarity.ms",
  "scorecardresearch.com", "quantserve.com", "comscore.com",
  "outbrain.com", "taboola.com", "criteo.com", "criteo.net",
  "adnxs.com", "rubiconproject.com", "pubmatic.com", "openx.net", "casalemedia.com",
  "adsrvr.org", "bidswitch.net", "smartadserver.com", "tapad.com", "bluekai.com",
  "krxd.net", "agkn.com",
  "adsafeprotected.com", "moatads.com", "doubleverify.com",
  "advertising.com", "2mdn.net", "rlcdn.com",
  "omtrdc.net", "demdex.net", "everesttech.net",
  "matomo.cloud", "piwik.pro",
  "newrelic.com", "nr-data.net",
  "pingdom.net", "pingdom.com",
  "cdn.speedcurve.com", "lux.speedcurve.com",
]);

function isTrackerHost(host) {
  host = host.replace(/^www\./, "");
  while (host) {
    if (TRACKER_DOMAINS.has(host)) return true;
    const i = host.indexOf(".");
    if (i === -1) return false;
    host = host.slice(i + 1);
  }
  return false;
}

// Removed from the old list because they are used functionally by many sites
// (search filters, OAuth, travel searches, GitHub...): ref, source, campaign, origin, is.
const TRACKING_PARAMS = new Set([
  "fbclid", "fb_action_ids", "fb_action_types", "fb_source", "fb_ref", "mibextid",
  "mc_eid", "mc_cid",
  "gclid", "gclsrc", "dclid", "gbraid", "wbraid",
  "twclid", "msclkid", "ttclid", "li_fat_id", "yclid",
  "_ga", "_gid", "_gl",
  "_hsenc", "_hsmi", "__hssc", "__hstc", "__hsfp", "hsctatracking",
  "igshid", "mkt_tok", "vero_id", "trk", "trkcampaign",
  "sc_campaign", "sc_channel", "sc_content", "sc_medium",
  "zanpid", "oly_enc_id", "oly_anon_id", "wickedid", "rb_clickid", "s_cid", "epik", "_openstat",
]);
const TRACKING_PREFIXES = ["utm_", "pk_", "mtm_", "hsa_"];

// Filters the raw query string so untouched params keep their exact encoding
// (re-serialising with URLSearchParams can break signed URLs).
function stripTracking(url) {
  if (!url.search) return false;
  const parts = url.search.slice(1).split("&");
  const kept = parts.filter((seg) => {
    let name = seg.split("=", 1)[0];
    try { name = decodeURIComponent(name.replace(/\+/g, " ")); } catch (_) {}
    name = name.toLowerCase();
    return !(TRACKING_PARAMS.has(name) || TRACKING_PREFIXES.some((p) => name.startsWith(p)));
  });
  if (kept.length === parts.length) return false;
  url.search = kept.length ? "?" + kept.join("&") : "";
  return true;
}

/* ------------------------------------------------------------------ *
 *  Helpers
 * ------------------------------------------------------------------ */
function topHost(d) {
  if (d.type === "main_frame") return VW.hostOf(d.url);
  if (d.frameAncestors && d.frameAncestors.length) {
    return VW.hostOf(d.frameAncestors[d.frameAncestors.length - 1].url);
  }
  return VW.hostOf(d.documentUrl || d.originUrl || "");
}

function isExempt(d) {
  return VW.isAllowlisted(topHost(d), cfg.allowlist);
}

function isThirdParty(d) {
  if (typeof d.thirdParty === "boolean") return d.thirdParty;
  const top = topHost(d);
  return !!top && VW.siteOf(top) !== VW.siteOf(VW.hostOf(d.url));
}

function initiatorIsPublicWeb(d) {
  const src = d.documentUrl || d.originUrl || "";
  if (!/^https?:/i.test(src)) return false;
  return !VW.isPrivateHost(VW.hostOf(src));
}

/* ---- blocked-request badge ---- */
const blocked = new Map();
const badgeTimers = new Map();
try {
  browser.browserAction.setBadgeBackgroundColor({ color: "#4fffb0" });
  if (browser.browserAction.setBadgeTextColor) browser.browserAction.setBadgeTextColor({ color: "#070707" });
} catch (_) {}

function block(d) {
  const id = d.tabId;
  if (id >= 0) {
    blocked.set(id, (blocked.get(id) || 0) + 1);
    if (!badgeTimers.has(id)) {
      badgeTimers.set(id, setTimeout(() => {
        badgeTimers.delete(id);
        const n = blocked.get(id) || 0;
        browser.browserAction.setBadgeText({ tabId: id, text: n ? (n > 999 ? "999+" : String(n)) : "" }).catch(() => {});
      }, 250));
    }
  }
  return { cancel: true };
}
browser.tabs.onRemoved.addListener((id) => { blocked.delete(id); badgeTimers.delete(id); });

/* ---- HTTPS upgrade state ---- */
const httpAllowed = new Set();     // hosts the user chose to open over plain HTTP (this session)
const recentUpgrades = new Map();  // http url -> timestamp (redirect-loop detection)
const upgradedMain = new Map();    // requestId -> original http url

function showHttpWarning(tabId, httpUrl) {
  if (tabId < 0) return;
  browser.tabs.update(tabId, {
    url: browser.runtime.getURL("warning.html") + "?u=" + encodeURIComponent(httpUrl),
  }).catch(() => {});
}

/* ------------------------------------------------------------------ *
 *  Request blocking / URL cleaning / HTTPS upgrade
 * ------------------------------------------------------------------ */
browser.webRequest.onBeforeRequest.addListener(
  (details) => {
    if (!cfg.enabled) return {};
    const isMain = details.type === "main_frame";
    if (isMain && details.tabId >= 0) blocked.delete(details.tabId);
    if (isExempt(details)) return {};

    let url;
    try { url = new URL(details.url); } catch (_) { return {}; }
    const host = url.hostname;

    // 1. Hyperlink auditing pings + third-party beacons are pure tracking.
    if (cfg.blockPings && (details.type === "ping" || (details.type === "beacon" && isThirdParty(details)))) {
      return block(details);
    }

    // 2. Public sites probing localhost / the LAN (port scans, local-service attacks).
    if (cfg.blockLocalNet && !isMain && VW.isPrivateHost(host) && initiatorIsPublicWeb(details)) {
      return block(details);
    }

    // 3. Known tracker domains. Never block top-level navigation: that made the
    //    trackers' own websites (newrelic.com, mixpanel.com...) unreachable.
    if (cfg.cleanUrls && !isMain && isTrackerHost(host)) {
      return block(details);
    }

    // 4. HTTPS upgrade (default ports only; failures go to an interstitial, never a silent downgrade).
    if (cfg.httpsUpgrade && url.protocol === "http:" && url.port === "" &&
        !VW.isPrivateHost(host) && !host.endsWith(".onion") && !httpAllowed.has(host)) {
      if (isMain) {
        const last = recentUpgrades.get(details.url);
        if (last && Date.now() - last < 10000) {
          // The site bounced us from https back to http: don't loop, ask the user.
          recentUpgrades.delete(details.url);
          showHttpWarning(details.tabId, details.url);
          return { cancel: true };
        }
        if (recentUpgrades.size > 200) recentUpgrades.clear();
        recentUpgrades.set(details.url, Date.now());
        if (upgradedMain.size > 200) upgradedMain.clear();
        upgradedMain.set(details.requestId, details.url);
      }
      url.protocol = "https:";
      return { redirectUrl: url.href };
    }

    // 5. Strip tracking params from top-level GET navigations only
    //    (redirecting a POST would silently turn it into a GET and drop the body).
    if (cfg.cleanUrls && isMain && details.method === "GET" && stripTracking(url)) {
      return { redirectUrl: url.href };
    }
    return {};
  },
  { urls: ["<all_urls>"] },
  ["blocking"]
);

browser.webRequest.onCompleted.addListener(
  (d) => { upgradedMain.delete(d.requestId); },
  { urls: ["https://*/*"], types: ["main_frame"] }
);

browser.webRequest.onErrorOccurred.addListener(
  (d) => {
    const original = upgradedMain.get(d.requestId);
    if (!original) return;
    upgradedMain.delete(d.requestId);
    // Real TLS/certificate problems keep Firefox's own error page (with its details);
    // user aborts and DNS failures wouldn't be fixed by HTTP either.
    if (/^(NS_BINDING_ABORTED|NS_ERROR_UNKNOWN_HOST|SEC_ERROR_|MOZILLA_PKIX_ERROR_|SSL_ERROR_BAD_CERT)/.test(d.error || "")) return;
    showHttpWarning(d.tabId, original);
  },
  { urls: ["https://*/*"], types: ["main_frame"] }
);

/* ------------------------------------------------------------------ *
 *  Request headers
 * ------------------------------------------------------------------ */
function refererIsCrossSite(value, requestUrl) {
  try {
    return VW.siteOf(new URL(value).hostname) !== VW.siteOf(requestUrl.hostname);
  } catch (_) {
    return true;
  }
}

browser.webRequest.onBeforeSendHeaders.addListener(
  (details) => {
    if (!cfg.enabled || isExempt(details)) return {};

    const profile = VW.OS_PROFILES[cfg.osProfile];
    const thirdParty = isThirdParty(details);
    const stripCookie = cfg.blockThirdPartyCookies && thirdParty;
    let reqUrl = null;
    try { reqUrl = new URL(details.url); } catch (_) {}

    const out = [];
    let changed = false;
    let hasDnt = false;
    let hasGpc = false;

    for (const header of details.requestHeaders || []) {
      const name = header.name.toLowerCase();

      if (name === "referer" && cfg.referer) {
        // Only cross-site referrers are masked. Same-site ones stay intact, otherwise
        // CSRF / hotlink checks and "return to previous page" flows break.
        if (!reqUrl || refererIsCrossSite(header.value, reqUrl)) {
          if (header.value !== cfg.referer) changed = true;
          out.push({ name: "Referer", value: cfg.referer });
          continue;
        }
      } else if (name === "accept-language" && cfg.lang) {
        if (header.value !== cfg.lang) changed = true;
        out.push({ name: "Accept-Language", value: cfg.lang });
        continue;
      } else if (name === "user-agent" && profile) {
        // Keep the User-Agent header consistent with navigator.userAgent.
        const ua = VW.spoofUA(header.value, profile.uaToken);
        if (ua !== header.value) changed = true;
        out.push({ name: header.name, value: ua });
        continue;
      } else if (name === "cookie" && stripCookie) {
        changed = true;
        continue;
      } else if (cfg.cleanNone) {
        if (name === "x-forwarded-for" || name === "via" || name === "x-real-ip") { changed = true; continue; }
        // Conditional-request validators are an ETag-tracking vector mainly when third party;
        // dropping them everywhere disabled caching for the sites you actually use.
        if (thirdParty && (name === "if-none-match" || name === "if-modified-since")) { changed = true; continue; }
      }

      if (name === "dnt") hasDnt = true;
      if (name === "sec-gpc") hasGpc = true;
      out.push(header);
    }

    if (cfg.dnt) {
      if (!hasDnt) { out.push({ name: "DNT", value: "1" }); changed = true; }
      if (!hasGpc) { out.push({ name: "Sec-GPC", value: "1" }); changed = true; }
    }
    return changed ? { requestHeaders: out } : {};
  },
  { urls: ["<all_urls>"] },
  ["blocking", "requestHeaders"]
);

browser.webRequest.onHeadersReceived.addListener(
  (details) => {
    if (!cfg.enabled || isExempt(details)) return {};
    const tp = isThirdParty(details);
    if (!tp) return {};
    const drop = new Set();
    if (cfg.cleanNone) { drop.add("etag"); drop.add("last-modified"); }
    if (cfg.blockThirdPartyCookies) drop.add("set-cookie");
    if (!drop.size) return {};
    const all = details.responseHeaders || [];
    const kept = all.filter((h) => !drop.has(h.name.toLowerCase()));
    return kept.length !== all.length ? { responseHeaders: kept } : {};
  },
  { urls: ["<all_urls>"] },
  ["blocking", "responseHeaders"]
);

/* ------------------------------------------------------------------ *
 *  Messages from content scripts / the HTTP warning page
 * ------------------------------------------------------------------ */
browser.runtime.onMessage.addListener((msg, sender) => {
  if (!msg || sender.id !== browser.runtime.id) return;

  if (msg.type === "vw:config") {
    return ready.then(() => {
      const tabHost = VW.hostOf((sender.tab && sender.tab.url) || sender.url || "");
      const frameHost = VW.hostOf(sender.url || "");
      return {
        cfg,
        allowlisted: VW.isAllowlisted(tabHost, cfg.allowlist) || VW.isAllowlisted(frameHost, cfg.allowlist),
      };
    });
  }

  if (msg.type === "vw:allowHttp") {
    // Only our own interstitial may ask for this.
    if (!sender.url || !sender.url.startsWith(browser.runtime.getURL("warning.html"))) return;
    let target;
    try { target = new URL(msg.url); } catch (_) { return; }
    if (target.protocol !== "http:" || !sender.tab) return;
    httpAllowed.add(target.hostname);
    return browser.tabs.update(sender.tab.id, { url: target.href });
  }
});
