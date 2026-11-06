// Almanca Kelime Asistanı — background service worker
// Tüm ağ istekleri burada yapılır; content script API anahtarını hiç görmez.

import { freeLookup } from "./sources.js";

const API_URL = "https://api.anthropic.com/v1/messages";
const API_VERSION = "2026-10-21";
const DEFAULT_SETTINGS = {
  source: "free", // free (Wiktionary + Tatoeba) | claude
  apiKey: "",
  model: "claude-opus-5-5",
  direction: "auto", // auto | de-tr | tr-de
};
// Sunucu taraflı yedek model (refusal fallback) desteği olan modeller
const FALLBACK_MODELS = new Set(["claude-opus-5-5", "claude-sonnet-5-5"]);

// ---------- Sağ tık menüsü ----------

chrome.runtime.onInstalled.addListener((details) => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "almanca-selection",
      title: 'Almancasını göster: "%s"',
      contexts: ["selection"],
    });
    chrome.contextMenus.create({
      id: "almanca-word",
      title: "Almancasını göster",
      contexts: ["page", "link"],
    });
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab || tab.id == null) return;
  const frameId = info.frameId ?? 0;
  const msg = { type: "ALMANCA_SHOW", selectionText: (info.selectionText || "").trim() };
  try {
    await chrome.tabs.sendMessage(tab.id, msg, { frameId });
  } catch {
    // Eklenti kurulmadan önce açılmış sekmelerde content script yoktur: enjekte et.
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id, frameIds: [frameId] },
        files: ["content.js"],
      });
      await chrome.tabs.sendMessage(tab.id, msg, { frameId });
    } catch (e) {
      console.warn("Bu sayfada çalışılamıyor:", e);
    }
  }
});

chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: chrome.runtime.getURL("words.html") });
});

// ---------- Mesajlar ----------

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  const handlers = {
    LOOKUP: () => lookup(msg.word, msg.context, { noCache: !!msg.noCache }),
    SAVE_WORD: () => saveWord(msg.entry),
    IS_SAVED: () => isSaved(msg.key),
    OPEN_OPTIONS: async () => chrome.runtime.openOptionsPage(),
  };
  const handler = handlers[msg?.type];
  if (!handler) return false;
  handler()
    .then((data) => sendResponse({ ok: true, data }))
    .catch((err) => sendResponse({ ok: false, error: err.message, code: err.code || "ERROR" }));
  return true; // asenkron yanıt
});

// ---------- Ayarlar ----------

async function getSettings() {
  const stored = await chrome.storage.local.get("settings");
  return { ...DEFAULT_SETTINGS, ...(stored.settings || {}) };
}

function codedError(code, message) {
  const e = new Error(message);
  e.code = code;
  return e;
}

// ---------- Sözlük araması (Claude) ----------

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "found", "detected_language", "lemma", "word_type", "article", "plural", "ipa",
    "meaning_tr", "level", "verb", "compound_parts", "example_de", "example_tr", "note",
  ],
  properties: {
    found: { type: "boolean" },
    detected_language: { type: "string", enum: ["de", "tr", "en", "other"] },
    lemma: { type: "string" },
    word_type: {
      type: "string",
      enum: ["isim", "fiil", "sıfat", "zarf", "edat", "bağlaç", "zamir", "ifade", "diğer"],
    },
    article: { type: "string", enum: ["der", "die", "das", ""] },
    plural: { type: "string" },
    ipa: { type: "string" },
    meaning_tr: { type: "string" },
    level: { type: "string", enum: ["A1", "A2", "B1", "B2", "C1", "C2", ""] },
    verb: {
      type: "object",
      additionalProperties: false,
      required: ["praeteritum", "perfekt", "separable", "separable_example", "case"],
      properties: {
        praeteritum: { type: "string" },
        perfekt: { type: "string" },
        separable: { type: "boolean" },
        separable_example: { type: "string" },
        case: { type: "string" },
      },
    },
    compound_parts: { type: "array", items: { type: "string" } },
    example_de: { type: "string" },
    example_tr: { type: "string" },
    note: { type: "string" },
  },
};

const SYSTEM_PROMPT = `Sen Türkçe konuşan Almanca öğrencileri için çalışan kısa ve doğru bir Almanca sözlüksün. Yanıtın verilen JSON şemasına uymalı.

Kurallar:
- "lemma": Kelimenin Almanca sözlük (kök) hâli. Çekimli kelimeleri köke indir: "ging" → "gehen", "Häuser" → "Haus", "schöneren" → "schön". İsimlerde lemma artikelsiz yazılır, büyük harfle başlar.
- Girdi Almanca değilse (Türkçe/İngilizce), lemma o kelimenin en yaygın Almanca karşılığıdır; "meaning_tr" yine Türkçe anlamı verir.
- "article": Sadece isimlerde der/die/das; diğer türlerde boş string.
- "plural": İsimlerde artikelli çoğul ("die Hunde"); çoğulu yoksa "—"; isim değilse boş string.
- "ipa": Almanca lemmanın IPA okunuşu, eğik çizgiler içinde ("/hʊnt/").
- "meaning_tr": En fazla 3 kısa Türkçe anlam, "; " ile ayrılmış. Bağlam cümlesi verildiyse önce o bağlamdaki anlamı yaz.
- "verb": Sadece fiillerde doldur, aksi hâlde stringler boş, separable false olsun. praeteritum "er ging" biçiminde, perfekt "er ist gegangen" biçiminde. Ayrılabilen fiilse separable true ve separable_example "ich rufe an" gibi. "case": fiilin aldığı hâl/edat ("+ Akkusativ", "+ Dativ", "auf + Akk." gibi), yoksa boş.
- "compound_parts": Birleşik isimleri parçala ("Krankenhausbesuch" → ["krank(en)", "Haus", "Besuch"]); birleşik değilse boş dizi.
- "level": Kelimenin yaklaşık CEFR seviyesi.
- "example_de": Lemmayı kullanan doğal, kısa (A2–B1 düzeyi) bir Almanca cümle. "example_tr": onun Türkçe çevirisi.
- "note": Tek cümlelik Türkçe açıklama; ör. tıklanan kelime çekimliyse "ging, gehen fiilinin Präteritum hâli". Gerek yoksa boş.
- Girdi anlamlı bir kelime/ifade değilse found=false yap, diğer alanları boş bırak.`;

function buildUserPrompt(word, context, direction) {
  let dir = "Girdinin dilini kendin algıla.";
  if (direction === "de-tr") dir = "Girdi Almancadır; Türkçe anlamını ver.";
  if (direction === "tr-de") dir = "Girdi Türkçe veya İngilizcedir; Almanca karşılığını ver.";
  const ctx = context ? `\nGeçtiği cümle: "${context}"` : "";
  return `Kelime: "${word}"${ctx}\n${dir}`;
}

async function lookup(rawWord, context = "", { noCache = false } = {}) {
  const word = String(rawWord || "").trim().slice(0, 80);
  if (!word) throw codedError("EMPTY", "Kelime bulunamadı.");

  const settings = await getSettings();
  const source = settings.source === "claude" ? "claude" : "free";
  const cacheKey = `c:v3:${source}:${settings.direction}:${word.toLowerCase()}`;
  if (!noCache) {
    const cached = await chrome.storage.local.get(cacheKey);
    if (cached[cacheKey]) return cached[cacheKey];
  }

  if (source === "free") {
    let data;
    try {
      data = await freeLookup(word, settings.direction);
    } catch (e) {
      throw codedError(e.code || "ERROR", e.message || "Sözlük hatası.");
    }
    await chrome.storage.local.set({ [cacheKey]: data });
    return data;
  }

  if (!settings.apiKey) {
    throw codedError("NO_KEY", "Claude seçili ama API anahtarı girilmemiş. Ayarlardan anahtar ekle ya da ücretsiz sözlüğe geç.");
  }

  const body = {
    model: settings.model,
    max_tokens: 4000,
    system: SYSTEM_PROMPT,
    output_config: {
      effort: "low",
      format: { type: "json_schema", schema: SCHEMA },
    },
    messages: [
      { role: "user", content: buildUserPrompt(word, String(context || "").slice(0, 400), settings.direction) },
    ],
  };
  const headers = {
    "content-type": "application/json",
    "x-api-key": settings.apiKey,
    "anthropic-version": API_VERSION,
    "anthropic-dangerous-direct-browser-access": "true",
  };
  if (FALLBACK_MODELS.has(settings.model)) {
    body.fallbacks = "default";
    headers["anthropic-beta"] = "server-side-fallback-2026-07-01";
  }

  let res;
  try {
    res = await fetch(API_URL, { method: "POST", headers, body: JSON.stringify(body) });
  } catch {
    throw codedError("NETWORK", "Ağ hatası: Claude API'sine ulaşılamadı.");
  }

  if (!res.ok) {
    let detail = "";
    try {
      detail = (await res.json())?.error?.message || "";
    } catch { /* yoksay */ }
    if (res.status === 401) throw codedError("BAD_KEY", "API anahtarı geçersiz. Ayarlardan kontrol et.");
    if (res.status === 429) throw codedError("RATE", "Çok fazla istek. Biraz bekleyip tekrar dene.");
    if (res.status >= 500) throw codedError("SERVER", `Claude API şu an yanıt vermiyor (${res.status}).`);
    throw codedError("API", `API hatası (${res.status}): ${detail}`);
  }

  const msg = await res.json();
  if (msg.stop_reason === "refusal") throw codedError("REFUSAL", "Bu kelime için yanıt alınamadı.");
  if (msg.stop_reason === "max_tokens") throw codedError("TRUNCATED", "Yanıt yarıda kesildi, tekrar dene.");

  const text = (msg.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw codedError("PARSE", "Yanıt çözümlenemedi.");
  }

  data.source = "Claude";
  await chrome.storage.local.set({ [cacheKey]: data });
  return data;
}

// ---------- Kelime defteri ----------

async function getWords() {
  const { words } = await chrome.storage.local.get("words");
  return Array.isArray(words) ? words : [];
}

async function saveWord(entry) {
  if (!entry?.key) throw codedError("BAD_ENTRY", "Kaydedilecek kelime yok.");
  const words = await getWords();
  const idx = words.findIndex((w) => w.key === entry.key);
  const record = { ...entry, savedAt: Date.now() };
  if (idx >= 0) words[idx] = { ...words[idx], ...record, savedAt: words[idx].savedAt };
  else words.unshift(record);
  await chrome.storage.local.set({ words });
  return true;
}

async function isSaved(key) {
  const words = await getWords();
  return words.some((w) => w.key === key);
}
