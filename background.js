const DEFAULTS = {
  cleanNone:         true,
  cleanUrls:         true,
  dnt:               true,
  battery:           true,
  data:              true,
  codecs:            true,
  canvas:            true,
  fonts:             true,
  devices:           true,
  screenWidth:         "",
  screenHeight:        "",
  referer:             "",
  lang:                "",
  timeZone:            "",
  angle:               "",
  googleinc:           "",
  os:                  "",
  hardwareConcurrency: "",
};

let settings = { ...DEFAULTS };

browser.storage.local.get(DEFAULTS).then(stored => {
  settings = { ...DEFAULTS, ...stored };
});

browser.storage.onChanged.addListener((changes) => {
  for (const [key, { newValue }] of Object.entries(changes)) {
    settings[key] = newValue;
  }
});

browser.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    runFirstTimeSetup();
  }
});

async function runFirstTimeSetup() {
  await browser.storage.local.set({
    cleanNone:           true,
    cleanUrls:           true,
    dnt:                 true,
    battery:             true,
    data:                true,
    codecs:              true,
    canvas:              true,
    fonts:               true,
    devices:             true,
    screenWidth:         1920,
    screenHeight:        1080,
    referer:             "https://www.google.com",
    lang:                "en-US,en;q=0.9",
    timeZone:            "0",
    angle:               "ANGLE (NVIDIA, NVIDIA GeForce GTX 980 Direct3D11 vs_5_0 ps_5_0), or similar ",
    googleinc:           "Google Inc. (NVIDIA)",
    os:                  "win32",
    hardwareConcurrency: 8
  });

  browser.tabs.create({ url: browser.runtime.getURL('welcome.html') });
}

const TRACKER_DOMAINS = [
  "google-analytics.com", "googletagmanager.com", "doubleclick.net",
  "facebook.net", "connect.facebook.net", "fbcdn.net",
  "ads.twitter.com", "analytics.twitter.com",
  "hotjar.com", "fullstory.com", "mouseflow.com",
  "mixpanel.com", "segment.io", "segment.com",
  "amplitude.com", "heap.io", "clarity.ms",
  "scorecardresearch.com", "quantserve.com", "comscore.com",
  "outbrain.com", "taboola.com", "criteo.com",
  "adnxs.com", "rubiconproject.com", "pubmatic.com",
  "adsafeprotected.com", "moatads.com", "doubleverify.com",
  "advertising.com", "2mdn.net", "rlcdn.com",
  "omtrdc.net", "demdex.net", "everesttech.net",
  "matomo.cloud", "piwik.pro",
  "newrelic.com", "nr-data.net",
  "pingdom.net", "pingdom.com",
  "cdn.speedcurve.com", "lux.speedcurve.com"
];

function isDomainBlocked(url) {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "");
    return TRACKER_DOMAINS.some(d => hostname === d || hostname.endsWith("." + d));
  } catch {
    return false;
  }
}

const TRACKING_PARAMS = [
  "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
  "utm_id", "utm_reader", "utm_name", "utm_social", "utm_social-type",
  "fbclid", "fb_action_ids", "fb_action_types", "fb_source", "fb_ref",
  "mc_eid", "mc_cid",
  "gclid", "gclsrc", "dclid",
  "twclid",
  "msclkid",
  "_ga", "_gid", "_gl",
  "ref", "source", "campaign",
  "trk", "trkCampaign",
  "sc_campaign", "sc_channel", "sc_content", "sc_medium",
  "zanpid", "origin", "igshid",
  "mkt_tok"
];

function cleanUrl(urlStr) {
  try {
    const url = new URL(urlStr);
    let changed = false;
    for (const param of TRACKING_PARAMS) {
      if (url.searchParams.has(param)) {
        url.searchParams.delete(param);
        changed = true;
      }
    }
    if (url.hash === "#") {
      url.hash = "";
      changed = true;
    }
    return changed ? { redirectUrl: url.href } : {};
  } catch {
    return {};
  }
}

browser.webRequest.onBeforeRequest.addListener(
  (details) => {
    if (settings.cleanUrls && isDomainBlocked(details.url)) {
      return { cancel: true };
    }
    if (settings.cleanUrls && details.type === "main_frame") {
      return cleanUrl(details.url);
    }
    return {};
  },
  { urls: ["<all_urls>"] },
  ["blocking"]
);

browser.webRequest.onBeforeSendHeaders.addListener(
  (details) => {
    const headers = details.requestHeaders || [];
    const result = [];

    for (const header of headers) {
      const name = header.name.toLowerCase();

      if (name === "referer" && settings.referer !== "") {
        try {
          const tabUrl = details.documentUrl || details.originUrl || "";
          const reqOrigin = new URL(details.url).origin;
          const docOrigin = tabUrl ? new URL(tabUrl).origin : "";
          if (reqOrigin !== docOrigin) {
            // Replace with google.com for all cross-origin requests
            result.push({ name: "Referer", value: settings.referer });
            continue;
          }
        } catch {
          result.push({ name: "Referer", value: settings.referer });
          continue;
        }
      }

      if (name === "accept-language" && settings.lang !== "") {
        result.push({ name: "Accept-Language", value: settings.lang });
        continue;
      }

      if (settings.cleanNone) {
        if (name === "x-forwarded-for" || name === "via" || name === "x-real-ip") {
            continue;
        }
        if (name === "if-none-match" || name === "if-modified-since") {
            continue;
        }
      }

      result.push(header);
    }

    if (settings.dnt) {
        if (!result.find(h => h.name.toLowerCase() === "dnt")) {
        result.push({ name: "DNT", value: "1" });
        }

        if (!result.find(h => h.name.toLowerCase() === "sec-gpc")) {
        result.push({ name: "Sec-GPC", value: "1" });
        }
    }

    return { requestHeaders: result };
  },
  { urls: ["<all_urls>"] },
  ["blocking", "requestHeaders"]
);

browser.webRequest.onHeadersReceived.addListener(
  (details) => {
    const headers = details.responseHeaders || [];
    let filtered = headers;
    if (settings.cleanNone) {
        filtered = headers.filter(h => {
            const name = h.name.toLowerCase();
            return name !== "etag" && name !== "last-modified";
        });
    }
    return { responseHeaders: filtered };
  },
  { urls: ["<all_urls>"] },
  ["blocking", "responseHeaders"]
);