<div align="center">
  <img
    src="https://github.com/VultureAV/Vulture-Web/blob/main/icons/VultureWeb-Text.png?raw=true"
    height="64"
    style="vertical-align: middle;"
  />
</div>


<div align="center">
A Firefox web extension that spoofs and masks your user data to enhance privacy and prevent tracking

[![buymeacoffe](https://img.shields.io/badge/buy%20me%20a%20coffee-FFDD00?logo=buymeacoffee&logoColor=black)](https://www.buymeacoffee.com/simpfey)
[![Direct Install](https://img.shields.io/badge/Install-070707)](https://addons.mozilla.org/en-US/firefox/addon/vultureweb/)

</div>

## Features

**Security & network**

- **HTTPS Upgrade**: rewrites `http://` to `https://`. If a site doesn't support it you get a warning page and must explicitly choose to continue over HTTP (no silent downgrade, no redirect loops)
- **WebRTC IP Leak Protection**: hides local/LAN addresses from WebRTC (browser-wide setting)
- **Local-Network Blocking**: public websites can't make requests to `localhost` or private LAN addresses (port scanning, attacks on local services)
- **Ping & Beacon Blocking**: cancels hyperlink-auditing pings and third-party `sendBeacon` requests
- **Third-Party Cookie Blocking** (off by default): strips `Cookie` / `Set-Cookie` on third-party requests
- **Per-site pause + allowlist**: one click to switch protections off on a site that breaks, plus a master on/off switch
- **Blocked-request counter** on the toolbar icon

**Tracking**

- 50+ tracker domains blocked (sub-requests only), click-ID parameters stripped from top-level navigations (`utm_*`, `fbclid`, `gclid`, ...)
- ETag / `If-None-Match` fingerprinting removed on third-party requests, proxy-revealing headers removed
- Do Not Track and Global Privacy Control, sent as headers **and** reported to scripts

**Fingerprinting**

- **OS profiles (Windows / macOS / Linux)**: `navigator.platform`, `userAgent` (JS *and* HTTP header), `appVersion`, `oscpu`, the font set and the taskbar size are changed together so they agree with each other. A custom platform string is still available
- Screen size, hardware concurrency, language (`Accept-Language` **and** `navigator.language(s)`), timezone, referrer (header **and** `document.referrer`)
- WebGL renderer/vendor, canvas noise, audio noise, fonts, codecs, battery, network info, camera/microphone visibility

## Usage

Click the VultureWeb icon in the Firefox toolbar to:

- Toggle everything on/off, or pause protections on the current site
- Choose the spoofed OS and the other spoofed values (invalid values are rejected with a message instead of being saved)
- Enable/disable each security and tracking feature
- Edit the site allowlist

## Notes on behaviour

- **Referrer**: only cross-site referrers are replaced; same-site ones are left alone so CSRF/hotlink checks keep working.
- **Hide Camera / Microphone** is on by default and blocks `getUserMedia`. Pause the site (or turn it off) for video calls.
- **Codecs**: only well-known fingerprinting probe strings get a fixed answer, everything else is passed through so video keeps playing.
- Allowlisted sites are exempt from request blocking/header changes and from page-level spoofing. The WebRTC setting is browser-wide.

## Known limitations

- **Timezone spoofing is partial.** `getTimezoneOffset`, `toString`, `Intl.DateTimeFormat` and `toLocale*String` follow the spoofed zone, but local-time constructors and getters (`new Date(y, m, d)`, `getHours()`, ...) still use your real zone. Sites doing date arithmetic (calendars, booking) can show off-by-hours results; pause them if so.
- Fonts are masked for `document.fonts.check()` only. Width-measurement based font detection is not covered.
- `window.innerWidth/outerWidth` are not spoofed; a window larger than the spoofed screen is itself a tell.
- The page-side code is injected by a content script at `document_start` after one async config lookup; a script that runs in the first few milliseconds can still see real values.
- Spoofing a different OS than the one you use means sites may offer the wrong downloads.

## How It Works

VultureWeb intercepts and modifies:

- **HTTP**: Referer, Accept-Language, User-Agent, DNT/Sec-GPC, cookies (optional), ETag-style validators, tracker requests, plain-HTTP requests
- **Browser APIs**: `navigator.*` (platform, userAgent, appVersion, oscpu, language(s), hardwareConcurrency, doNotTrack, battery, connection, media devices), `screen.*`, `document.referrer`, Date/Intl, `document.fonts.check`, codecs
- **WebGL / Canvas / Audio**: renderer strings, noise on a copy of the canvas output, audio buffer/analyser noise
- All overridden functions are made to stringify as native code, and are installed on the prototypes (not on the `navigator` instance)

## Privacy Policy

VultureWeb does not collect, store, or transmit any user data. All spoofing occurs locally within your browser.

## License

VultureWeb uses the All Rights Reserved license, code can only be seen, and downloaded for private use and learning purposes, do not redistribute the extension without being allowed to do so, nor re-sell it on any platform.

## Support

For issues or feature requests, please open an issue on the project repository.
