const $ = (id) => document.getElementById(id);
const DEFAULTS = { source: "free", apiKey: "", model: "claude-opus-5-5", direction: "auto" };

function toggleClaude() {
  $("claudeFields").hidden = $("source").value !== "claude";
}
$("source").addEventListener("change", toggleClaude);

function setStatus(text, kind = "") {
  const el = $("status");
  el.textContent = text;
  el.className = `status ${kind}`;
}

async function load() {
  const { settings } = await chrome.storage.local.get("settings");
  const s = { ...DEFAULTS, ...(settings || {}) };
  $("source").value = s.source;
  $("apiKey").value = s.apiKey;
  toggleClaude();
  $("model").value = s.model;
  $("direction").value = s.direction;
}

async function save() {
  const settings = {
    source: $("source").value,
    apiKey: $("apiKey").value.trim(),
    model: $("model").value,
    direction: $("direction").value,
  };
  await chrome.storage.local.set({ settings });
  return settings;
}

$("form").addEventListener("submit", async (e) => {
  e.preventDefault();
  await save();
  setStatus("Kaydedildi ✓", "ok");
});

$("test").addEventListener("click", async () => {
  const btn = $("test");
  btn.disabled = true;
  setStatus("Test ediliyor…");
  await save();
  const res = await chrome.runtime.sendMessage({ type: "LOOKUP", word: "Häuser", context: "", noCache: true });
  btn.disabled = false;
  if (res?.ok) {
    const d = res.data;
    setStatus(`Çalışıyor ✓  Häuser → ${d.article} ${d.lemma}: ${d.meaning_tr || d.meaning_en}`, "ok");
  } else {
    setStatus(res?.error || "Bilinmeyen hata", "err");
  }
});

$("clearCache").addEventListener("click", async () => {
  const all = await chrome.storage.local.get(null);
  const keys = Object.keys(all).filter((k) => k.startsWith("c:"));
  await chrome.storage.local.remove(keys);
  $("clearCache").textContent = `Temizlendi (${keys.length})`;
});

load();
