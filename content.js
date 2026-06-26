(function () {
  const STORAGE_DEFAULTS = {
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
    os:                  ""
  };

  browser.storage.local.get(STORAGE_DEFAULTS).then((cfg) => {
    injectFingerprintProtection(cfg);
  });

  function injectFingerprintProtection(cfg) {
    const script = document.createElement("script");
    script.textContent = `(${fpProtection.toString()})(${JSON.stringify(cfg)});`;
    (document.head || document.documentElement).appendChild(script);
    script.remove();
  }

  function fpProtection(cfg) {
    const SW          = parseInt(cfg.screenWidth,  10) || 1920;
    const SH          = parseInt(cfg.screenHeight, 10) || 1080;

    if (cfg.canvas) {
      const origToDataURL  = HTMLCanvasElement.prototype.toDataURL;

      HTMLCanvasElement.prototype.toDataURL = function (...args) {
        const ctx = this.getContext("2d");
        if (ctx) {
          const idata = CanvasRenderingContext2D.prototype.getImageData.call(ctx, 0, 0, this.width, this.height);
          const d = idata.data;
          for (let i = 0; i < d.length; i += 64) {
            d[i] = Math.max(0, Math.min(255, d[i] + (Math.random() > 0.5 ? 1 : -1)));
          }
          ctx.putImageData(idata, 0, 0);
        }
        return origToDataURL.apply(this, args);
      };
    }

    if (cfg.angle !== "" && cfg.googleinc !== "") {
      const getParameter = WebGLRenderingContext.prototype.getParameter;
      WebGLRenderingContext.prototype.getParameter = function(param) {
        if (param === 37446) return cfg.angle;
        if (param === 37445) return cfg.googleinc;
        return getParameter.call(this, param);
      };

      const getParameter2 = WebGL2RenderingContext.prototype.getParameter;
      WebGL2RenderingContext.prototype.getParameter = function(param) {
        if (param === 37446) return cfg.angle;
        if (param === 37445) return cfg.googleinc;
        return getParameter2.call(this, param);
      };
    }

    if (window.AudioContext || window.webkitAudioContext) {
      const AC = window.AudioContext || window.webkitAudioContext;
      const origCreateOscillator = AC.prototype.createOscillator;
      AC.prototype.createOscillator = function () {
        const osc = origCreateOscillator.call(this);
        const origConnect = osc.connect.bind(osc);
        osc.connect = function (dest) {
          osc.detune.value = (Math.random() * 0.01) - 0.005;
          return origConnect(dest);
        };
        return osc;
      };
    }

    try {
      Object.defineProperty(screen, "width",       { get: () => SW,       configurable: true });
      Object.defineProperty(screen, "height",      { get: () => SH,       configurable: true });
      Object.defineProperty(screen, "availWidth",  { get: () => SW,       configurable: true });
      Object.defineProperty(screen, "availHeight", { get: () => SH,       configurable: true });
      Object.defineProperty(screen, "colorDepth",  { get: () => 24,       configurable: true });
      Object.defineProperty(screen, "pixelDepth",  { get: () => 24,       configurable: true });
    } catch (_) {}

    try {
      Object.defineProperty(navigator, "hardwareConcurrency", { get: () => 8, configurable: true });
    } catch (_) {}

    if (cfg.codecs) {
      const CODEC_MAP = {
        'video/mp4; codecs="flac"':         "probably",
        'video/ogg; codecs="opus"':         "probably",
        'video/webm; codecs="vp9, opus"':   "probably",
        'video/webm; codecs="vp8, vorbis"': "probably",
        "audio/aac":                        "probably",
        "audio/flac":                       "probably",
        "audio/mpeg":                       "probably",
        'audio/ogg; codecs="flac"':         "probably",
        'audio/ogg; codecs="vorbis"':       "probably",
        'audio/ogg; codecs="opus"':         "probably",
        'audio/wav; codecs="1"':            "probably",
        'audio/webm; codecs="vorbis"':      "probably",
        'audio/webm; codecs="opus"':        "probably",
        "audio/x-mpegurl":                  "maybe",
        'audio/mp4; codecs="mp4a.40.2"':    "probably",
      };
      

      const origCanPlayType = HTMLMediaElement.prototype.canPlayType;
      HTMLMediaElement.prototype.canPlayType = function (type) {
        if (!type) return "";
        const normalized = type.replace(/\s+/g, " ").trim();
        return Object.prototype.hasOwnProperty.call(CODEC_MAP, normalized) ? CODEC_MAP[normalized] : "";
      };
    }

    if (cfg.timeZone !== "") {
        const offset = parseInt(cfg.timeZone, 10);

        if (!Number.isInteger(offset) || offset < -12 || offset > 12)
            throw new Error("Invalid timezone. Expected integer from -12 to 12.");

        const tzName =
            offset === 0
                ? "Etc/GMT"
                : offset > 0
                    ? `Etc/GMT-${offset}`
                    : `Etc/GMT+${Math.abs(offset)}`;

        const tzOffset = -offset * 60;

        const zoneLabel =
            offset === 0
                ? "Coordinated Universal Time"
                : `UTC${offset >= 0 ? "+" : ""}${offset}`;

        const gmtLabel =
            `GMT${offset >= 0 ? "+" : "-"}${String(Math.abs(offset)).padStart(2, "0")}00`;

        const OrigDateTimeFormat = Intl.DateTimeFormat;

        function PatchedDateTimeFormat(locales, options) {
            return new OrigDateTimeFormat(
                locales,
                Object.assign({}, options, { timeZone: tzName })
            );
        }

        PatchedDateTimeFormat.prototype = OrigDateTimeFormat.prototype;
        PatchedDateTimeFormat.supportedLocalesOf =
            OrigDateTimeFormat.supportedLocalesOf.bind(OrigDateTimeFormat);

        try {
            Object.defineProperty(Intl, "DateTimeFormat", {
                value: PatchedDateTimeFormat,
                configurable: true,
                writable: true
            });
        } catch (_) {}

        const origResolvedOptions = OrigDateTimeFormat.prototype.resolvedOptions;

        OrigDateTimeFormat.prototype.resolvedOptions = function () {
            return Object.assign(origResolvedOptions.call(this), {
                timeZone: tzName
            });
        };

        Date.prototype.getTimezoneOffset = function () {
            return tzOffset;
        };

        const _dts = Date.prototype.toString;
        const _tts = Date.prototype.toTimeString;
        const _ls  = Date.prototype.toLocaleString;
        const _lds = Date.prototype.toLocaleDateString;
        const _lts = Date.prototype.toLocaleTimeString;

        Date.prototype.toString = function () {
            return _dts.call(this)
                .replace(/GMT[+-]\d{4}/, gmtLabel)
                .replace(/\(.*?\)/, `(${zoneLabel})`);
        };

        Date.prototype.toTimeString = function () {
            return _tts.call(this)
                .replace(/GMT[+-]\d{4}/, gmtLabel)
                .replace(/\(.*?\)/, `(${zoneLabel})`);
        };

        Date.prototype.toLocaleString = function (l, o) {
            return _ls.call(this, l, Object.assign({}, o, {
                timeZone: tzName
            }));
        };

        Date.prototype.toLocaleDateString = function (l, o) {
            return _lds.call(this, l, Object.assign({}, o, {
                timeZone: tzName
            }));
        };

        Date.prototype.toLocaleTimeString = function (l, o) {
            return _lts.call(this, l, Object.assign({}, o, {
                timeZone: tzName
            }));
        };
    }

    if (cfg.fonts) {
      const WIN10_FONTS = new Set([
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
        "Yu Gothic UI Regular","Yu Gothic UI Semibold","Yu Gothic UI Semilight"
      ]);

      if (document.fonts && document.fonts.check) {
        const origCheck = document.fonts.check.bind(document.fonts);
        document.fonts.check = function (fontSpec, text) {
          const m = fontSpec.match(/(?:^|\s)([\w\s]+)$/);
          const family = m ? m[1].trim().replace(/['"]/g, "") : "";
          return WIN10_FONTS.has(family) ? origCheck(fontSpec, text) : false;
        };
      }

      if (document.fonts && document.fonts[Symbol.iterator]) {
        const origIter = document.fonts[Symbol.iterator].bind(document.fonts);
        document.fonts[Symbol.iterator] = function* () {
          for (const face of origIter()) {
            if (WIN10_FONTS.has(face.family.replace(/['"]/g, ""))) yield face;
          }
        };
      }

      const OrigFontFace = window.FontFace;
      window.FontFace = function (family, source, descriptors) {
        if (!WIN10_FONTS.has(family.replace(/['"]/g, ""))) {
          const dummy = new OrigFontFace(family, source, descriptors);
          dummy.load = () => Promise.reject(new DOMException("Font not available", "NotFoundError"));
          return dummy;
        }
        return new OrigFontFace(family, source, descriptors);
      };
      window.FontFace.prototype = OrigFontFace.prototype;
    }

    if (cfg.battery) {
      if (navigator.getBattery) {
        navigator.getBattery = () => Promise.reject(new Error("Blocked by PrivacyGuard"));
      }
    }

    if (cfg.data) {
      if ("connection" in navigator) {
        try {
          Object.defineProperty(navigator, "connection", {
            get: () => ({ effectiveType: "4g", downlink: 10, rtt: 50 }),
            configurable: true
          });
        } catch (_) {}
      }
    }

    if (cfg.devices) {
      if (navigator.mediaDevices) {
        navigator.mediaDevices.enumerateDevices    = () => Promise.resolve([]);
        navigator.mediaDevices.getUserMedia        = () => Promise.reject(new DOMException("Requested device not found", "NotFoundError"));
        navigator.mediaDevices.getSupportedConstraints = () => ({});
        if (navigator.mediaDevices.getDisplayMedia)
          navigator.mediaDevices.getDisplayMedia   = () => Promise.reject(new DOMException("Requested device not found", "NotFoundError"));
      }

      for (const key of ["getUserMedia", "webkitGetUserMedia", "mozGetUserMedia", "msGetUserMedia"]) {
        if (navigator[key]) {
          navigator[key] = (_c, _ok, err) => {
            if (typeof err === "function") err(new DOMException("Requested device not found", "NotFoundError"));
          };
        }
      }
    }
  }
})();