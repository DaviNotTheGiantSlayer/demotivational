const COUNTRY_CACHE_KEY = "demotivational:countryCode";
const COUNTRY_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 1 day

function pickRandom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function readCachedCountry() {
  try {
    const raw = localStorage.getItem(COUNTRY_CACHE_KEY);
    if (!raw) return null;
    const { code, timestamp } = JSON.parse(raw);
    if (Date.now() - timestamp > COUNTRY_CACHE_TTL_MS) return null;
    return code;
  } catch {
    return null;
  }
}

function writeCachedCountry(code) {
  try {
    localStorage.setItem(
      COUNTRY_CACHE_KEY,
      JSON.stringify({ code, timestamp: Date.now() })
    );
  } catch {
    // localStorage unavailable (e.g. private mode) — safe to ignore
  }
}

function countryFromBrowserLocale() {
  const locale = navigator.language || navigator.userLanguage || "";
  return locale.toLowerCase().startsWith("pt") ? "BR" : "";
}

async function detectCountryCode() {
  const cached = readCachedCountry();
  if (cached) return cached;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500);
    const response = await fetch("https://ipapi.co/json/", {
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!response.ok) throw new Error("geolocation request failed");
    const data = await response.json();
    const code = data.country_code || countryFromBrowserLocale();
    writeCachedCountry(code);
    return code;
  } catch {
    return countryFromBrowserLocale();
  }
}

async function loadBackgroundEntries() {
  try {
    const response = await fetch("images/manifest.json");
    if (!response.ok) throw new Error("manifest request failed");
    const files = await response.json();
    if (!Array.isArray(files) || files.length === 0) throw new Error("manifest empty");
    return files.map((name) => ({
      css: `url('images/${encodeURIComponent(name)}')`,
      filename: name,
    }));
  } catch {
    return FALLBACK_BACKGROUNDS.map((css) => ({ css, filename: null }));
  }
}

async function loadCredits() {
  try {
    const response = await fetch("images/credits.json");
    if (!response.ok) throw new Error("credits request failed");
    return await response.json();
  } catch {
    return {};
  }
}

function renderPhotoCredit(el, info, isBR) {
  el.textContent = "";
  if (!info || !info.author) return;

  const label = isBR ? "Foto" : "Photo";
  el.appendChild(document.createTextNode(`${label}: `));

  const link = document.createElement("a");
  link.href = info.photoUrl || info.authorUrl || "#";
  link.target = "_blank";
  link.rel = "noopener";
  link.textContent = info.author;
  el.appendChild(link);

  if (info.source) {
    el.appendChild(document.createTextNode(` (${info.source})`));
  }
}

async function init() {
  const stage = document.getElementById("stage");
  const phraseEl = document.getElementById("phrase");
  const photoCreditEl = document.getElementById("photo-credit");

  const backgrounds = await loadBackgroundEntries();
  const chosenBackground = pickRandom(backgrounds);
  stage.style.backgroundImage = chosenBackground.css;

  const countryCode = await detectCountryCode();
  const isBR = countryCode === "BR";
  const pool = isBR ? PHRASES.pt : PHRASES.en;
  phraseEl.textContent = pickRandom(pool);

  const font = pickRandom(FONTS);
  phraseEl.style.fontFamily = font.family;
  phraseEl.style.fontWeight = font.weight;
  phraseEl.style.fontStyle = font.style;
  phraseEl.style.letterSpacing = font.letterSpacing;

  if (chosenBackground.filename) {
    const credits = await loadCredits();
    renderPhotoCredit(photoCreditEl, credits[chosenBackground.filename], isBR);
  }
}

init();
