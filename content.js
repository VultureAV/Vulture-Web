(async function () {
  "use strict";

  /* ---------- 1. get config (background first, storage as fallback) ---------- */
  let cfg = null;
  let allowlisted = false;

  try {
    const resp = await browser.runtime.sendMessage({ type: "vw:config" });
    if (resp && resp.cfg) {
      cfg = VW.normalizeConfig(resp.cfg);
      allowlisted = !!resp.allowlisted;
    }
  } catch (_) {
    /* background not ready yet (browser start-up) */
  }
  if (!cfg) {
    try {
      cfg = VW.normalizeConfig(await browser.storage.local.get(null));
      allowlisted = VW.isAllowlisted(location.hostname, cfg.allowlist);
    } catch (_) {
      return;
    }
  }
  if (!cfg.enabled || allowlisted) return;

  /* ---------- 2. derive everything the page-world code needs ---------- */
  const FONT_SETS = {
    windows: [
      "Arial","Arial Black","Arial Bold","Arial Bold Italic","Arial Italic",
      "Bahnschrift","Calibri","Calibri Bold","Calibri Bold Italic","Calibri Italic",
      "Calibri Light","Calibri Light Italic",
      "Cambria","Cambria Bold","Cambria Bold Italic","Cambria Italic","Cambria Math",
      "Candara","Candara Bold","Candara Bold Italic","Candara Italic","Candara Light","Candara Light Italic",
      "Comic Sans MS","Comic Sans MS Bold","Comic Sans MS Bold Italic","Comic Sans MS Italic",
      "Consolas","Consolas Bold","Consolas Bold Italic","Consolas Italic",
      "Constantia","Constantia Bold","Constantia Bold Italic","Constantia Italic",
      "Corbel","Corbel Bold","Corbel Bold Italic","Corbel Italic","Corbel Light","Corbel Light Italic",
      "Courier New","Courier New Bold","Courier New Bold Italic","Courier New Italic",
      "Ebrima","Ebrima Bold","Franklin Gothic Medium","Franklin Gothic Medium Italic",
      "Gabriola","Gadugi","Gadugi Bold",
      "Georgia","Georgia Bold","Georgia Bold Italic","Georgia Italic",
      "HoloLens MDL2 Assets","Impact","Ink Free","Javanese Text",
      "Leelawadee UI","Leelawadee UI Bold","Leelawadee UI Semilight",
      "Lucida Console","Lucida Sans Unicode",
      "Malgun Gothic","Malgun Gothic Bold","Malgun Gothic Semilight","Marlett",
      "Microsoft Himalaya",
      "Microsoft JhengHei","Microsoft JhengHei Bold","Microsoft JhengHei Light",
      "Microsoft JhengHei UI","Microsoft JhengHei UI Bold","Microsoft JhengHei UI Light",
      "Microsoft New Tai Lue","Microsoft New Tai Lue Bold",
      "Microsoft PhagsPa","Microsoft PhagsPa Bold","Microsoft Sans Serif",
      "Microsoft Tai Le","Microsoft Tai Le Bold",
      "Microsoft YaHei","Microsoft YaHei Bold","Microsoft YaHei Light",
      "Microsoft YaHei UI","Microsoft YaHei UI Bold","Microsoft YaHei UI Light",
      "Microsoft Yi Baiti","MingLiU_HKSCS-ExtB","MingLiU-ExtB","Mongolian Baiti",
      "MS Gothic","MS PGothic","MS UI Gothic","MV Boli",
      "Myanmar Text","Myanmar Text Bold",
      "Nirmala UI","Nirmala UI Bold","Nirmala UI Semilight","NSimSun",
      "Palatino Linotype","Palatino Linotype Bold","Palatino Linotype Bold Italic","Palatino Linotype Italic",
      "PMingLiU-ExtB","Segoe MDL2 Assets",
      "Segoe Print","Segoe Print Bold","Segoe Script","Segoe Script Bold",
      "Segoe UI","Segoe UI Black","Segoe UI Bold","Segoe UI Bold Italic","Segoe UI Emoji",
      "Segoe UI Historic","Segoe UI Italic","Segoe UI Light","Segoe UI Light Italic",
      "Segoe UI Semibold","Segoe UI Semibold Italic","Segoe UI Semilight","Segoe UI Semilight Italic",
      "Segoe UI Symbol","SimSun","SimSun-ExtB",
      "Sitka Banner","Sitka Display","Sitka Heading","Sitka Small","Sitka Subheading","Sitka Text",
      "Sylfaen","Symbol","Tahoma","Tahoma Bold",
      "Times New Roman","Times New Roman Bold","Times New Roman Bold Italic","Times New Roman Italic",
      "Trebuchet MS","Trebuchet MS Bold","Trebuchet MS Bold Italic","Trebuchet MS Italic",
      "Verdana","Verdana Bold","Verdana Bold Italic","Verdana Italic",
      "Webdings","Wingdings",
      "Yu Gothic","Yu Gothic Bold","Yu Gothic Light","Yu Gothic Medium",
      "Yu Gothic UI","Yu Gothic UI Bold","Yu Gothic UI Light",
      "Yu Gothic UI Regular","Yu Gothic UI Semibold","Yu Gothic UI Semilight",
    ],
    macos: [
      "American Typewriter","Andale Mono","Apple Braille","Apple Chancery","Apple Color Emoji",
      "Apple SD Gothic Neo","Arial","Arial Black","Arial Narrow","Arial Rounded MT Bold","Avenir",
      "Avenir Next","Baskerville","Big Caslon","Brush Script MT","Chalkboard","Chalkboard SE",
      "Cochin","Copperplate","Courier","Courier New","Didot","Futura","Geneva","Georgia",
      "Gill Sans","Helvetica","Helvetica Neue","Herculanum","Hoefler Text","Impact","Lucida Grande",
      "Luminari","Marker Felt","Menlo","Monaco","Noteworthy","Optima","Palatino","Papyrus",
      "Phosphate","Rockwell","SF Mono","Skia","Snell Roundhand","Tahoma","Times","Times New Roman",
      "Trebuchet MS","Verdana","Zapfino",
    ],
    linux: [
      "Cantarell","DejaVu Sans","DejaVu Sans Mono","DejaVu Serif","Droid Sans","Droid Sans Mono",
      "Droid Serif","FreeMono","FreeSans","FreeSerif","Liberation Mono","Liberation Sans",
      "Liberation Serif","Noto Color Emoji","Noto Mono","Noto Sans","Noto Sans Mono","Noto Serif",
      "Ubuntu","Ubuntu Mono",
    ],
  };

  const profile = VW.OS_PROFILES[cfg.osProfile] || null;
  const seedBuf = new Uint32Array(1);
  crypto.getRandomValues(seedBuf);

  const pageCfg = {
    canvas: cfg.canvas,
    audio: cfg.audio,
    battery: cfg.battery,
    data: cfg.data,
    devices: cfg.devices,
    codecs: cfg.codecs,
    dnt: cfg.dnt,
    seed: seedBuf[0],
    screen: cfg.screenWidth && cfg.screenHeight ? { w: cfg.screenWidth, h: cfg.screenHeight } : null,
    taskbar: profile ? profile.taskbar : 0,
    hardwareConcurrency: cfg.hardwareConcurrency,
    timeZone: cfg.timeZone,
    languages: VW.languagesFrom(cfg.lang),
    referer: cfg.referer,
    angle: cfg.angle,
    googleinc: cfg.googleinc,
    platform: profile ? profile.platform : cfg.osProfile === "custom" ? cfg.os : "",
    uaToken: profile ? profile.uaToken : "",
    oscpu: profile ? profile.oscpu : "",
    appVersion: profile ? profile.appVersion : "",
    fontList: cfg.fonts ? FONT_SETS[cfg.osProfile] || FONT_SETS.windows : null,
  };

  /* ---------- 3. page-world code (serialised and injected as a script) ---------- */
  function fpProtection(cfg) {
    "use strict";
    // Every module is isolated: one failing (or unsupported) API can no longer
    // abort the rest, which is what used to happen with an invalid timezone.
    const safe = (fn) => { try { fn(); } catch (_) {} };

    /* ----- make overridden functions look native ----- */
    const nativeSrc = new WeakMap();
    const fnToString = Function.prototype.toString;
    safe(() => {
      const patched = function toString() {
        const s = nativeSrc.get(this);
        return s !== undefined ? s : fnToString.call(this);
      };
      nativeSrc.set(patched, fnToString.call(fnToString));
      Object.defineProperty(Function.prototype, "toString", { value: patched, writable: true, configurable: true });
    });
    const mask = (fn, name) => {
      nativeSrc.set(fn, "function " + name + "() {\n    [native code]\n}");
      return fn;
    };
    const setName = (fn, name, length) => {
      try { Object.defineProperty(fn, "name", { value: name, configurable: true }); } catch (_) {}
      if (length !== undefined) { try { Object.defineProperty(fn, "length", { value: length, configurable: true }); } catch (_) {} }
    };
    const ownerOf = (obj, prop) => {
      while (obj && !Object.prototype.hasOwnProperty.call(obj, prop)) obj = Object.getPrototypeOf(obj);
      return obj;
    };

    // Redefine an accessor on the prototype that really owns it (not on the instance,
    // which would be trivially detectable via Object.getOwnPropertyDescriptor(navigator, ...)).
    const defGetter = (proto, prop, compute) => {
      const owner = ownerOf(proto, prop) || proto;
      const old = Object.getOwnPropertyDescriptor(owner, prop);
      const origGet = old && old.get;
      const g = function () { return compute(origGet ? origGet.call(this) : undefined); };
      setName(g, "get " + prop, 0);
      mask(g, "get " + prop);
      Object.defineProperty(owner, prop, { get: g, set: undefined, enumerable: old ? old.enumerable : true, configurable: true });
    };

    const defMethod = (proto, name, make) => {
      const owner = ownerOf(proto, name);
      if (!owner) return;
      const d = Object.getOwnPropertyDescriptor(owner, name);
      const orig = d && d.value;
      if (typeof orig !== "function") return;
      const replacement = make(orig);
      setName(replacement, name, orig.length);
      mask(replacement, name);
      Object.defineProperty(owner, name, { value: replacement, writable: d.writable, enumerable: d.enumerable, configurable: true });
    };

    /* ----- deterministic per-session noise (same input -> same output within one page load) ----- */
    const hash = (i) => {
      let h = (cfg.seed ^ Math.imul(i + 1, 0x9e3779b1)) >>> 0;
      h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b);
      h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35);
      h ^= h >>> 16;
      return h >>> 0;
    };

    const siteOf = (host) => {
      if (!host || host.indexOf(":") !== -1 || /^[\d.]+$/.test(host)) return host;
      const p = host.split(".");
      if (p.length <= 2) return host;
      const sld = p[p.length - 2];
      return p[p.length - 1].length === 2 && /^(co|com|org|net|gov|edu|ac|or|ne|go)$/.test(sld)
        ? p.slice(-3).join(".") : p.slice(-2).join(".");
    };

    /* ----- navigator: OS / UA / language / DNT ----- */
    if (cfg.platform) safe(() => defGetter(Navigator.prototype, "platform", () => cfg.platform));

    if (cfg.uaToken) {
      safe(() => defGetter(Navigator.prototype, "userAgent", (ua) =>
        typeof ua === "string" ? ua.replace(/\(([^)]*?)(rv:[\d.]+)\)/, "(" + cfg.uaToken + "; $2)") : ua));
      safe(() => defGetter(Navigator.prototype, "appVersion", () => cfg.appVersion));
      safe(() => { if ("oscpu" in navigator) defGetter(Navigator.prototype, "oscpu", () => cfg.oscpu); });
    }

    if (cfg.languages.length) {
      const langs = Object.freeze(cfg.languages.slice());
      safe(() => defGetter(Navigator.prototype, "language", () => langs[0]));
      safe(() => defGetter(Navigator.prototype, "languages", () => langs));
    }

    if (cfg.hardwareConcurrency) {
      safe(() => defGetter(Navigator.prototype, "hardwareConcurrency", () => cfg.hardwareConcurrency));
    }

    if (cfg.dnt) {
      safe(() => defGetter(Navigator.prototype, "doNotTrack", () => "1"));
      safe(() => defGetter(Navigator.prototype, "globalPrivacyControl", () => true));
    }

    // document.referrer must agree with the Referer header the extension sends.
    if (cfg.referer) {
      safe(() => defGetter(Document.prototype, "referrer", (real) => {
        try {
          if (!real) return real;
          return siteOf(new URL(real).hostname) === siteOf(location.hostname) ? real : cfg.referer;
        } catch (_) { return real; }
      }));
    }

    /* ----- screen ----- */
    if (cfg.screen) {
      safe(() => {
        const w = cfg.screen.w, h = cfg.screen.h;
        const availH = Math.max(0, h - cfg.taskbar);
        defGetter(Screen.prototype, "width", () => w);
        defGetter(Screen.prototype, "height", () => h);
        defGetter(Screen.prototype, "availWidth", () => w);
        defGetter(Screen.prototype, "availHeight", () => availH);
        defGetter(Screen.prototype, "colorDepth", () => 24);
        defGetter(Screen.prototype, "pixelDepth", () => 24);
        if ("availLeft" in screen) defGetter(Screen.prototype, "availLeft", () => 0);
        if ("availTop" in screen) defGetter(Screen.prototype, "availTop", () => 0);
      });
    }

    /* ----- canvas ----- */
    if (cfg.canvas) {
      safe(() => {
        const origGetImageData = CanvasRenderingContext2D.prototype.getImageData;
        const origGetContext = HTMLCanvasElement.prototype.getContext;

        const applyNoise = (d) => {
          for (let p = 0, n = d.length >> 2; p < n; p++) {
            if (d[p * 4 + 3] === 0) continue;           // leave fully transparent pixels alone
            const h = hash(p);
            if ((h & 15) !== 0) continue;               // ~6% of pixels, +/-1 on one channel
            const i = p * 4 + ((h >>> 4) % 3);
            const v = d[i] + ((h >>> 8) & 1 ? 1 : -1);
            d[i] = v < 0 ? 0 : v > 255 ? 255 : v;
          }
        };

        // Work on a COPY. The old code wrote noise back into the live canvas (visible
        // artefacts, accumulating on every call) and called getContext("2d") on the
        // original, which permanently stopped a later getContext("webgl") from working.
        const noisyCopy = (canvas) => {
          const w = canvas.width, h = canvas.height;
          if (!w || !h || w * h > 16e6) return null;
          const c = document.createElement("canvas");
          c.width = w; c.height = h;
          const ctx = origGetContext.call(c, "2d");
          ctx.drawImage(canvas, 0, 0);
          const img = origGetImageData.call(ctx, 0, 0, w, h);
          applyNoise(img.data);
          ctx.putImageData(img, 0, 0);
          return c;
        };

        defMethod(HTMLCanvasElement.prototype, "toDataURL", (orig) => function (...args) {
          try { const c = noisyCopy(this); if (c) return orig.apply(c, args); } catch (_) {}
          return orig.apply(this, args);
        });
        defMethod(HTMLCanvasElement.prototype, "toBlob", (orig) => function (...args) {
          try { const c = noisyCopy(this); if (c) return orig.apply(c, args); } catch (_) {}
          return orig.apply(this, args);
        });
        defMethod(CanvasRenderingContext2D.prototype, "getImageData", (orig) => function (...args) {
          const img = orig.apply(this, args);
          try { applyNoise(img.data); } catch (_) {}
          return img;
        });
      });
    }

    /* ----- WebGL renderer strings ----- */
    if (cfg.angle && cfg.googleinc) {
      for (const Ctx of [window.WebGLRenderingContext, window.WebGL2RenderingContext]) {
        if (!Ctx) continue;
        safe(() => defMethod(Ctx.prototype, "getParameter", (orig) => function (param) {
          if (param === 37446) return cfg.angle;      // UNMASKED_RENDERER_WEBGL
          if (param === 37445) return cfg.googleinc;  // UNMASKED_VENDOR_WEBGL
          return orig.apply(this, arguments);
        }));
      }
    }

    /* ----- audio ----- */
    if (cfg.audio) {
      safe(() => {
        const noisedChannels = new WeakMap();
        const jitter = (arr, scale) => {
          for (let i = 0; i < arr.length; i += 97) arr[i] += (hash(i) / 4294967296 - 0.5) * scale;
        };
        if (window.AudioBuffer) {
          defMethod(AudioBuffer.prototype, "getChannelData", (orig) => function (ch) {
            const data = orig.apply(this, arguments);
            let done = noisedChannels.get(this);
            if (!done) { done = new Set(); noisedChannels.set(this, done); }
            if (!done.has(ch)) { done.add(ch); jitter(data, 1e-7); }
            return data;
          });
          defMethod(AudioBuffer.prototype, "copyFromChannel", (orig) => function (dest) {
            const r = orig.apply(this, arguments);
            try { jitter(dest, 1e-7); } catch (_) {}
            return r;
          });
        }
        if (window.AnalyserNode) {
          for (const m of ["getFloatFrequencyData", "getFloatTimeDomainData"]) {
            defMethod(AnalyserNode.prototype, m, (orig) => function (arr) {
              const r = orig.apply(this, arguments);
              try { jitter(arr, 1e-4); } catch (_) {}
              return r;
            });
          }
        }
      });
    }

    /* ----- codecs: only the well-known probe strings are answered; everything else is
           passed through. Previously every unlisted type returned "", which made sites
           believe H.264/AAC/HLS were unsupported and broke video playback. ----- */
    if (cfg.codecs) {
      safe(() => {
        const CODEC_MAP = {
          'video/mp4; codecs="flac"': "probably",
          'video/ogg; codecs="opus"': "probably",
          'video/webm; codecs="vp9, opus"': "probably",
          'video/webm; codecs="vp8, vorbis"': "probably",
          "audio/aac": "probably",
          "audio/flac": "probably",
          "audio/mpeg": "probably",
          'audio/ogg; codecs="flac"': "probably",
          'audio/ogg; codecs="vorbis"': "probably",
          'audio/ogg; codecs="opus"': "probably",
          'audio/wav; codecs="1"': "probably",
          'audio/webm; codecs="vorbis"': "probably",
          'audio/webm; codecs="opus"': "probably",
          "audio/x-mpegurl": "maybe",
          'audio/mp4; codecs="mp4a.40.2"': "probably",
        };
        defMethod(HTMLMediaElement.prototype, "canPlayType", (orig) => function (type) {
          const norm = typeof type === "string" ? type.replace(/\s+/g, " ").trim() : "";
          if (Object.prototype.hasOwnProperty.call(CODEC_MAP, norm)) return CODEC_MAP[norm];
          return orig.apply(this, arguments);
        });
      });
    }

    /* ----- timezone / locale (best effort - see README "Known limitations") ----- */
    if (cfg.timeZone || cfg.languages.length) {
      safe(() => {
        const tz = cfg.timeZone;
        const lang0 = cfg.languages[0];
        const OrigDTF = Intl.DateTimeFormat;
        const origGetTime = Date.prototype.getTime;

        // A Proxy keeps name/length/static methods intact and needs no prototype juggling.
        const DTF = new Proxy(OrigDTF, {
          construct(target, args, newTarget) {
            const loc = args[0] === undefined && lang0 ? lang0 : args[0];
            const opts = Object.assign({}, args[1]);
            if (tz && !opts.timeZone) opts.timeZone = tz;
            return Reflect.construct(target, [loc, opts], newTarget);
          },
          apply(target, thisArg, args) {
            const loc = args[0] === undefined && lang0 ? lang0 : args[0];
            const opts = Object.assign({}, args[1]);
            if (tz && !opts.timeZone) opts.timeZone = tz;
            return Reflect.apply(target, thisArg, [loc, opts]);
          },
        });
        Object.defineProperty(Intl, "DateTimeFormat", { value: DTF, writable: true, configurable: true });

        if (!tz) return;

        const offsetFmt = new OrigDTF("en-US", {
          timeZone: tz, hourCycle: "h23",
          year: "numeric", month: "2-digit", day: "2-digit",
          hour: "2-digit", minute: "2-digit", second: "2-digit",
        });
        const nameFmt = new OrigDTF("en-US", { timeZone: tz, timeZoneName: "long" });

        // Cached formatters: the old code built a new DateTimeFormat on every call.
        const offsetMinutes = (utc) => {
          const parts = {};
          offsetFmt.formatToParts(new Date(utc)).forEach((p) => { parts[p.type] = p.value; });
          const asUTC = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour % 24, +parts.minute, +parts.second);
          return Math.round((asUTC - Math.floor(utc / 1000) * 1000) / 60000);
        };
        const longName = (utc) => {
          const p = nameFmt.formatToParts(new Date(utc)).find((x) => x.type === "timeZoneName");
          return p ? p.value : tz;
        };
        const gmt = (min) => {
          const a = Math.abs(min);
          return "GMT" + (min >= 0 ? "+" : "-") + String(Math.floor(a / 60)).padStart(2, "0") + String(a % 60).padStart(2, "0");
        };
        const DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
        const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
        const p2 = (n) => String(n).padStart(2, "0");
        const parts = (t) => {
          const off = offsetMinutes(t);
          const s = new Date(t + off * 60000);
          return { y: s.getUTCFullYear(), mo: s.getUTCMonth(), d: s.getUTCDate(), wd: s.getUTCDay(),
                   h: s.getUTCHours(), mi: s.getUTCMinutes(), s: s.getUTCSeconds(), off };
        };

        // Invalid dates must still give "Invalid Date" / NaN instead of throwing a RangeError.
        const guarded = (fmt) => (orig) => function () {
          const t = origGetTime.call(this);
          if (t !== t) return orig.apply(this, arguments);
          return fmt(t);
        };
        defMethod(Date.prototype, "getTimezoneOffset", (orig) => function () {
          const t = origGetTime.call(this);
          return t !== t ? NaN : -offsetMinutes(t);
        });
        const dateStr = (t) => { const q = parts(t); return DAYS[q.wd] + " " + MONTHS[q.mo] + " " + p2(q.d) + " " + q.y; };
        const timeStr = (t) => { const q = parts(t); return p2(q.h) + ":" + p2(q.mi) + ":" + p2(q.s) + " " + gmt(q.off) + " (" + longName(t) + ")"; };
        defMethod(Date.prototype, "toDateString", guarded(dateStr));
        defMethod(Date.prototype, "toTimeString", guarded(timeStr));
        defMethod(Date.prototype, "toString", guarded((t) => dateStr(t) + " " + timeStr(t)));

        for (const m of ["toLocaleString", "toLocaleDateString", "toLocaleTimeString"]) {
          defMethod(Date.prototype, m, (orig) => function (l, o) {
            const opts = Object.assign({}, o);
            if (!opts.timeZone) opts.timeZone = tz;
            return orig.call(this, l === undefined && lang0 ? lang0 : l, opts);
          });
        }
      });
    }

    /* ----- fonts: answer document.fonts.check() for a fixed per-OS set ----- */
    if (cfg.fontList) {
      safe(() => {
        const allowed = new Set(cfg.fontList);
        const generic = new Set(["serif","sans-serif","monospace","cursive","fantasy","system-ui",
          "ui-serif","ui-sans-serif","ui-monospace","ui-rounded","emoji","math","fangsong"]);
        const LEAD = /^(?:normal|italic|oblique|small-caps|bold|bolder|lighter|[1-9]00|(?:xx?-)?(?:small|large)|medium|smaller|larger|\d*\.?\d+(?:px|pt|em|rem|ex|ch|vw|vh|vmin|vmax|%|cm|mm|in|pc|q)(?:\/\S+)?)$/i;

        // The old regex could not parse `12px "Segoe UI"` or `bold 12px Arial` at all,
        // so check() returned false even for fonts that really are on the whitelist.
        const families = (spec) => {
          const tokens = String(spec).trim().split(/\s+/);
          while (tokens.length > 1 && LEAD.test(tokens[0])) tokens.shift();
          return tokens.join(" ").split(",")
            .map((s) => s.trim().replace(/^["']|["']$/g, "").trim()).filter(Boolean);
        };
        const pageFaces = () => {
          const s = new Set();
          try { for (const f of document.fonts) s.add(String(f.family).replace(/^["']|["']$/g, "")); } catch (_) {}
          return s;
        };
        const proto = (window.FontFaceSet && FontFaceSet.prototype) || Object.getPrototypeOf(document.fonts);

        // Web fonts the page declares itself (and the FontFace constructor / iteration) are
        // left untouched; wrapping those broke every site that loads fonts from JavaScript.
        defMethod(proto, "check", (orig) => function (spec) {
          let list;
          try { list = families(spec); } catch (_) { return orig.apply(this, arguments); }
          if (!list.length) return orig.apply(this, arguments);
          const faces = pageFaces();
          const ok = list.some((f) => generic.has(f.toLowerCase()) || allowed.has(f) || faces.has(f));
          return ok ? orig.apply(this, arguments) : false;
        });
      });
    }

    /* ----- battery / connection / devices ----- */
    if (cfg.battery) {
      safe(() => defMethod(Navigator.prototype, "getBattery", () => function () {
        return Promise.reject(new DOMException("The operation is not allowed.", "NotAllowedError"));
      }));
    }

    if (cfg.data) {
      safe(() => {
        if (!("connection" in navigator)) return;
        const fake = { effectiveType: "4g", downlink: 10, rtt: 50, saveData: false };
        defGetter(Navigator.prototype, "connection", () => fake);   // same object every time
      });
    }

    if (cfg.devices) {
      safe(() => {
        if (window.MediaDevices) {
          const P = MediaDevices.prototype;
          defMethod(P, "enumerateDevices", () => function () { return Promise.resolve([]); });
          defMethod(P, "getSupportedConstraints", () => function () { return {}; });
          const reject = () => function () {
            return Promise.reject(new DOMException("Requested device not found", "NotFoundError"));
          };
          defMethod(P, "getUserMedia", reject);
          defMethod(P, "getDisplayMedia", reject);
        }
        for (const key of ["getUserMedia", "webkitGetUserMedia", "mozGetUserMedia", "msGetUserMedia"]) {
          defMethod(Navigator.prototype, key, () => function (_c, _ok, err) {
            if (typeof err === "function") err(new DOMException("Requested device not found", "NotFoundError"));
          });
        }
      });
    }
  }

  /* ---------- 4. inject ---------- */
  function inject() {
    const root = document.documentElement;
    if (!root) {
      document.addEventListener("readystatechange", inject, { once: true });
      return;
    }
    const script = document.createElement("script");
    script.textContent = "(" + fpProtection.toString() + ")(" + JSON.stringify(pageCfg) + ");";
    (document.head || root).appendChild(script);
    script.remove();
  }
  inject();
})();
