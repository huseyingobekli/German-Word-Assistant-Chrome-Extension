// Almanca Kelime Asistanı — background service worker
// Tüm ağ istekleri burada yapılır; content script API anahtarını hiç görmez.

import "./i18n.js";
import { freeLookup } from "./sources.js";

const T = (...a) => globalThis.almancaT(...a);

const API_URL = "https://api.anthropic.com/v1/messages";
const API_VERSION = "2026-10-21";
const DEFAULT_SETTINGS = {
  // dil çifti: tr (Almanca–Türkçe) | en (Almanca–İngilizce); varsayılan tarayıcı diline göre
  lang: String(globalThis.navigator?.language || "").toLowerCase().startsWith("tr") ? "tr" : "en",
  source: "free", // free (Wiktionary + Tatoeba) | claude
  apiKey: "",
  model: "claude-opus-5-5",
  direction: "auto", // auto | from-de | to-de
};
// Sunucu taraflı yedek model (refusal fallback) desteği olan modeller
const FALLBACK_MODELS = new Set(["claude-opus-5-5", "claude-sonnet-5-5"]);

// ---------- Ayarlar ----------

async function getSettings() {
  const stored = await chrome.storage.local.get("settings");
  const s = { ...DEFAULT_SETTINGS, ...(stored.settings || {}) };
  // Eski sürümlerin yön değerleri
  if (s.direction === "de-tr") s.direction = "from-de";
  if (s.direction === "tr-de") s.direction = "to-de";
  if (s.lang !== "en" && s.lang !== "tr") s.lang = DEFAULT_SETTINGS.lang;
  return s;
}

function codedError(code, message) {
  const e = new Error(message);
  e.code = code;
  return e;
}

// ---------- Sağ tık menüsü ----------

async function buildMenus() {
  const { lang } = await getSettings();
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: "almanca-selection", title: T(lang, "menuSelection"), contexts: ["selection"] });
    chrome.contextMenus.create({ id: "almanca-word", title: T(lang, "menuWord"), contexts: ["page", "link"] });
  });
}

chrome.runtime.onInstalled.addListener(buildMenus);
chrome.runtime.onStartup.addListener(buildMenus);
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.settings) buildMenus();
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab || tab.id == null) return;
  const frameId = info.frameId ?? 0;
  const { lang } = await getSettings();
  const msg = { type: "ALMANCA_SHOW", selectionText: (info.selectionText || "").trim(), lang };
  try {
    await chrome.tabs.sendMessage(tab.id, msg, { frameId });
  } catch {
    // Eklenti kurulmadan önce açılmış sekmelerde content script yoktur: enjekte et.
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id, frameIds: [frameId] },
        files: ["i18n.js", "content.js"],
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

// ---------- Sözlük araması ----------

const FREE_ERRORS = { EMPTY: "errEmpty", NETWORK: "errNetwork", RATE: "errRate", SERVER: "errServer" };

async function lookup(rawWord, context = "", { noCache = false } = {}) {
  const settings = await getSettings();
  const { lang } = settings;
  const word = String(rawWord || "").trim().slice(0, 80);
  if (!word) throw codedError("EMPTY", T(lang, "errEmpty"));

  const source = settings.source === "claude" ? "claude" : "free";
  const cacheKey = `c:v4:${source}:${lang}:${settings.direction}:${word.toLowerCase()}`;
  if (!noCache) {
    const cached = await chrome.storage.local.get(cacheKey);
    if (cached[cacheKey]) return cached[cacheKey];
  }

  let data;
  if (source === "free") {
    try {
      data = await freeLookup(word, settings.direction, lang);
    } catch (e) {
      const key = FREE_ERRORS[e.code] || "unknownError";
      throw codedError(e.code || "ERROR", T(lang, key, { s: e.status || "" }));
    }
  } else {
    data = await claudeLookup(word, context, settings);
  }

  await chrome.storage.local.set({ [cacheKey]: data });
  return data;
}

// ---------- Claude ----------

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "found", "detected_language", "lemma", "word_type", "article", "plural", "ipa",
    "meaning", "level", "verb", "compound_parts", "example_de", "example_translation", "note",
  ],
  properties: {
    found: { type: "boolean" },
    detected_language: { type: "string", enum: ["de", "tr", "en", "other"] },
    lemma: { type: "string" },
    word_type: {
      type: "string",
      enum: ["noun", "verb", "adj", "adv", "prep", "conj", "pron", "article", "interj", "num", "phrase", "other"],
    },
    article: { type: "string", enum: ["der", "die", "das", ""] },
    plural: { type: "string" },
    ipa: { type: "string" },
    meaning: { type: "string" },
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
    example_translation: { type: "string" },
    note: { type: "string" },
  },
};

const LANG_NAMES = { tr: "Turkish", en: "English" };

function systemPrompt(lang) {
  const L = LANG_NAMES[lang];
  return `You are a concise, accurate German dictionary for ${L}-speaking learners of German. Your answer must follow the given JSON schema.

Rules:
- "lemma": the German dictionary (base) form. Reduce inflected forms: "ging" → "gehen", "Häuser" → "Haus", "schöneren" → "schön". Nouns are written without the article and capitalized.
- If the input is not German (e.g. ${L}), "lemma" is its most common German equivalent; "meaning" still gives the ${L} meaning.
- "word_type": one of the schema codes (noun, verb, adj, ...).
- "article": der/die/das for nouns only; empty string otherwise.
- "plural": for nouns the plural with article ("die Hunde"); "—" if there is no plural; empty string for non-nouns.
- "ipa": IPA of the German lemma between slashes ("/hʊnt/").
- "meaning": at most 3 short ${L} meanings separated by "; ". If a context sentence is given, put the meaning used in that context first.
- "verb": only for verbs; otherwise empty strings and separable false. praeteritum like "er ging", perfekt like "er ist gegangen". For separable verbs set separable true and separable_example like "ich rufe an". "case": the case or preposition the verb governs ("+ Akkusativ", "+ Dativ", "auf + Akk."), or empty.
- "compound_parts": split compound nouns ("Krankenhausbesuch" → ["Krankenhaus", "Besuch"]); empty array if not a compound.
- "level": approximate CEFR level of the word.
- "example_de": a natural, short German sentence (A2–B1) using the lemma. "example_translation": its ${L} translation.
- "note": one short sentence in ${L}, e.g. if the clicked word is inflected, which form of the lemma it is. Empty if not needed.
- If the input is not a meaningful word or phrase, set found=false and leave the other fields empty.`;
}

function userPrompt(word, context, direction, lang) {
  const L = LANG_NAMES[lang];
  let dir = "Detect the input language yourself.";
  if (direction === "from-de") dir = `The input is German; give its ${L} meaning.`;
  if (direction === "to-de") dir = `The input is ${L}; give its German equivalent.`;
  const ctx = context ? `\nContext sentence: "${context}"` : "";
  return `Word: "${word}"${ctx}\n${dir}`;
}

async function claudeLookup(word, context, settings) {
  const { lang } = settings;
  if (!settings.apiKey) throw codedError("NO_KEY", T(lang, "errNoKey"));

  const body = {
    model: settings.model,
    max_tokens: 4000,
    system: systemPrompt(lang),
    output_config: {
      effort: "low",
      format: { type: "json_schema", schema: SCHEMA },
    },
    messages: [
      { role: "user", content: userPrompt(word, String(context || "").slice(0, 400), settings.direction, lang) },
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
    throw codedError("NETWORK", T(lang, "errApiNetwork"));
  }

  if (!res.ok) {
    let detail = "";
    try {
      detail = (await res.json())?.error?.message || "";
    } catch { /* yoksay */ }
    if (res.status === 401) throw codedError("BAD_KEY", T(lang, "errBadKey"));
    if (res.status === 429) throw codedError("RATE", T(lang, "errApiRate"));
    if (res.status >= 500) throw codedError("SERVER", T(lang, "errApiServer", { s: res.status }));
    throw codedError("API", T(lang, "errApi", { s: res.status, d: detail }));
  }

  const msg = await res.json();
  if (msg.stop_reason === "refusal") throw codedError("REFUSAL", T(lang, "errRefusal"));
  if (msg.stop_reason === "max_tokens") throw codedError("TRUNCATED", T(lang, "errTruncated"));

  const text = (msg.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw codedError("PARSE", T(lang, "errParse"));
  }

  return {
    ...data,
    meaning_alt: "",
    definition_de: "",
    example_translation_lang: data.example_translation ? lang : "",
    example_url: "",
    source: "Claude",
  };
}

// ---------- Kelime defteri ----------

async function getWords() {
  const { words } = await chrome.storage.local.get("words");
  return Array.isArray(words) ? words : [];
}

async function saveWord(entry) {
  if (!entry?.key) {
    const { lang } = await getSettings();
    throw codedError("BAD_ENTRY", T(lang, "errBadEntry"));
  }
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
