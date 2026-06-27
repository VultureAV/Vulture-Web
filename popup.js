const TOGGLE_KEYS = [
  "cleanNone",
  "cleanUrls",
  "dnt",
  "battery",
  "data",
  "codecs",
  "canvas",
  "fonts",
  "devices",
];

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
  timeZone:            "Europe/London",
  angle:               "",
  googleinc:           "",
  os:                  "",
  hardwareConcurrency: "8",
};

browser.storage.local.get(DEFAULTS).then((stored) => {
  for (const key of TOGGLE_KEYS) {
    const el = document.getElementById(key);
    if (el) el.checked = stored[key];
  }
  document.getElementById("screenWidth").value  = stored.screenWidth ;
  document.getElementById("screenHeight").value = stored.screenHeight;
  document.getElementById("referer").value  = stored.referer;
  document.getElementById("lang").value = stored.lang;
  document.getElementById("timeZone").value  = stored.timeZone || "";
  document.getElementById("angle").value = stored.angle;
  document.getElementById("googleinc").value  = stored.googleinc;
  document.getElementById("os").value = stored.os;
  document.getElementById("hardwareConcurrency").value = stored.hardwareConcurrency;
});

for (const key of TOGGLE_KEYS) {
  const el = document.getElementById(key);
  if (el) el.addEventListener("change", () => browser.storage.local.set({ [key]: el.checked }));
}

function debounced(fn, ms = 400) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

document.getElementById("screenWidth").addEventListener("input", debounced(e => {
  browser.storage.local.set({ screenWidth: e.target.value.trim() });
}));

document.getElementById("screenHeight").addEventListener("input", debounced(e => {
  browser.storage.local.set({ screenHeight: e.target.value.trim() });
}));

document.getElementById("referer").addEventListener("input", debounced(e => {
  browser.storage.local.set({ referer: e.target.value.trim() });
}));

document.getElementById("lang").addEventListener("input", debounced(e => {
  browser.storage.local.set({ lang: e.target.value.trim() });
}));

document.getElementById("timeZone").addEventListener("input", debounced(e => {
  browser.storage.local.set({ timeZone: e.target.value.trim() });
}));

document.getElementById("angle").addEventListener("input", debounced(e => {
  browser.storage.local.set({ angle: e.target.value.trim() });
}));

document.getElementById("googleinc").addEventListener("input", debounced(e => {
  browser.storage.local.set({ googleinc: e.target.value.trim() });
}));

document.getElementById("os").addEventListener("input", debounced(e => {
  browser.storage.local.set({ os: e.target.value.trim() });
}));

document.getElementById("hardwareConcurrency").addEventListener("input", debounced(e => {
  browser.storage.local.set({ hardwareConcurrency: e.target.value.trim() });
}));