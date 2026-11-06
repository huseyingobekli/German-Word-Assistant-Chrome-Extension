const $ = (id) => document.getElementById(id);
const BROWSER_LANG = navigator.language.toLowerCase().startsWith("tr") ? "tr" : "en";
const DEFAULTS = { lang: BROWSER_LANG, source: "free", apiKey: "", model: "claude-opus-5-5", direction: "auto" };

const lang = () => $("lang").value;
const t = (key, vars) => almancaT(lang(), key, vars);

function setStatus(text, kind = "") {
  const el = $("status");
  el.textContent = text;
  el.className = `status ${kind}`;
}

function refreshUi() {
  almancaApplyI18n(lang());
  $("claudeFields").hidden = $("source").value !== "claude";
}

async function load() {
  const { settings } = await chrome.storage.local.get("settings");
  const s = { ...DEFAULTS, ...(settings || {}) };
  if (s.direction === "de-tr") s.direction = "from-de";
  if (s.direction === "tr-de") s.direction = "to-de";
  $("lang").value = s.lang === "en" || s.lang === "tr" ? s.lang : BROWSER_LANG;
  $("source").value = s.source;
  $("apiKey").value = s.apiKey;
  $("model").value = s.model;
  $("direction").value = s.direction;
  refreshUi();
}

async function save() {
  const settings = {
    lang: lang(),
    source: $("source").value,
    apiKey: $("apiKey").value.trim(),
    model: $("model").value,
    direction: $("direction").value,
  };
  await chrome.storage.local.set({ settings });
  return settings;
}

$("lang").addEventListener("change", async () => {
  refreshUi();
  await save(); // menü başlıkları da dile göre güncellensin
  setStatus(t("optSaved"), "ok");
});
$("source").addEventListener("change", refreshUi);

$("form").addEventListener("submit", async (e) => {
  e.preventDefault();
  await save();
  setStatus(t("optSaved"), "ok");
});

$("test").addEventListener("click", async () => {
  const btn = $("test");
  btn.disabled = true;
  setStatus(t("optTesting"));
  await save();
  const res = await chrome.runtime.sendMessage({ type: "LOOKUP", word: "Häuser", context: "", noCache: true });
  btn.disabled = false;
  if (res?.ok && res.data?.found) {
    const d = res.data;
    setStatus(t("optWorks", { r: `Häuser → ${d.article} ${d.lemma}: ${d.meaning || d.definition_de}` }), "ok");
  } else {
    setStatus(res?.error || t("unknownError"), "err");
  }
});

$("clearCache").addEventListener("click", async () => {
  const all = await chrome.storage.local.get(null);
  const keys = Object.keys(all).filter((k) => k.startsWith("c:"));
  await chrome.storage.local.remove(keys);
  $("clearCache").textContent = t("optCleared", { n: keys.length });
});

load();
