# Changelog

## 1.1.0

### New
- Master on/off switch, per-site pause button and domain allowlist
- HTTPS upgrade with a warning page instead of silent downgrade
- WebRTC local-IP leak protection
- Blocking of requests from public sites to localhost / private networks
- Blocking of hyperlink-auditing pings and third-party beacons
- Optional third-party cookie blocking
- OS profiles (Windows / macOS / Linux) that keep platform, UA, appVersion, oscpu, fonts and screen avail-size consistent
- `navigator.language(s)`, `document.referrer`, `navigator.doNotTrack` and `globalPrivacyControl` now match the spoofed headers
- Audio noise via `getChannelData` / analyser; canvas noise also on `toBlob` / `getImageData`
- Toolbar badge with the number of blocked requests

### Fixed
- OS spoof only changed `navigator.platform` (UA header, UA string, oscpu, fonts and GPU hints still revealed the real OS); `win32` placeholder had the wrong case
- An invalid/half-typed timezone made the injected script throw and disabled every protection after it (fonts, battery, devices, OS)
- `new Date(NaN).toString()` threw a RangeError while timezone spoofing was on; `toTimeString` printed the IANA id instead of the long zone name; formatters are now cached
- Canvas noise modified the live canvas (visible artefacts, accumulating) and could stop a later WebGL context from being created
- `canPlayType` returned `""` for every unlisted type (H.264/AAC/HLS looked unsupported, breaking video)
- Font `check()` regex failed on quoted names and weights, and the `FontFace` / iterator wrappers broke sites that load web fonts from JS
- `fbcdn.net` was blocked (broke Facebook/Instagram media); tracker blocking also cancelled top-level visits to the tracker companies' own websites
- Stripping `ref`, `source`, `campaign`, `origin`, `is` broke OAuth, search and travel sites; redirecting POST navigations dropped the body; the `#` branch was dead code; untouched params are no longer re-encoded
- Same-site `Referer` was replaced with the spoofed one (broke CSRF/hotlink checks); `document.referrer` leaked the real value
- ETag/Last-Modified were removed on all requests, disabling normal caching and resumable downloads; now third-party only
- `hardwareConcurrency` became a string after editing in the popup
- Spoofing did not run inside iframes or `about:blank` frames
- Popup lost edits made less than 400 ms before closing; invalid values were saved; defaults differed between popup, background and content script (now one shared module)
- Header listeners rewrote every request even when nothing changed
- Spoofed functions are installed on prototypes and stringify as native code

### Hardening
- Extension-page CSP, removed redundant `activeTab`, external links use `rel="noopener noreferrer"`
- All config is validated/normalised in one place; only the extension itself can talk to the background script
