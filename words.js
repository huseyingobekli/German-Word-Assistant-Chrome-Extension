const $ = (id) => document.getElementById(id);
let words = [];
let lang = "tr";
const t = (key, vars) => almancaT(lang, key, vars);

// Eski kayıtlardaki Türkçe tür adları
const LEGACY_TYPES = { isim: "noun", fiil: "verb", "sıfat": "adj", zarf: "adv", edat: "prep", "bağlaç": "conj", zamir: "pron" };

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function headword(w) {
  return w.article ? `${w.article} ${w.lemma}` : w.lemma;
}

const meaningOf = (w) => w.meaning ?? w.meaning_tr ?? "";
const exampleTrOf = (w) => w.example_translation ?? w.example_tr ?? "";

function typeLabel(code) {
  const c = LEGACY_TYPES[code] || code;
  if (!c) return "";
  const label = t(`type_${c}`);
  return label === `type_${c}` ? "" : label;
}

async function load() {
  const res = await chrome.storage.local.get(["words", "settings"]);
  words = Array.isArray(res.words) ? res.words : [];
  lang = res.settings?.lang === "en" ? "en" : "tr";
  almancaApplyI18n(lang);
  render();
}

function render() {
  const q = $("search").value.trim().toLowerCase();
  const shown = q
    ? words.filter((w) => [w.lemma, meaningOf(w), w.original, w.example_de].some((f) => String(f || "").toLowerCase().includes(q)))
    : words;

  $("count").textContent = t("wordsCount", { n: words.length });
  const list = $("list");
  if (!shown.length) {
    list.innerHTML = `<div class="empty">${esc(words.length ? t("wordsNoMatch") : t("wordsEmpty"))}</div>`;
    return;
  }

  const locale = lang === "en" ? "en-GB" : "tr-TR";
  list.innerHTML = shown.map((w) => {
    const art = ["der", "die", "das"].includes(w.article) ? w.article : "";
    const plural = w.plural && w.plural !== "—" ? t("wordsPlural", { x: w.plural }) : "";
    const meta = [typeLabel(w.word_type), plural, w.ipa].filter(Boolean).join(" · ");
    const v = w.verb || {};
    const caseText = v.case === "intransitive" ? t("intransitive") : v.case;
    const verb = v.praeteritum || v.perfekt
      ? `<div class="meta">${esc([v.praeteritum, v.perfekt, v.separable_example, caseText].filter(Boolean).join(" · "))}</div>`
      : "";
    let host = "";
    try { host = new URL(w.url).hostname; } catch { /* yoksay */ }
    const level = w.level ? `<span class="lv lv-${esc(w.level.slice(0, 2))}">${esc(w.level)}</span>` : "";
    return `<div class="item" data-key="${esc(w.key)}">
      <div>
        <div class="word">${art ? `<span class="${art}">${art}</span> ` : ""}${esc(w.lemma)}${level}</div>
        ${meta ? `<div class="meta">${esc(meta)}</div>` : ""}
        ${verb}
        <div class="meaning">${esc(meaningOf(w))}</div>
        ${w.example_de ? `<div class="ex">${esc(w.example_de)}<br><span class="tr">${esc(exampleTrOf(w))}</span></div>` : ""}
        ${w.sentence ? `<div class="seen">${esc(t("wordsSeen"))}: “${esc(w.sentence)}” — ${w.url ? `<a href="${esc(w.url)}" target="_blank" rel="noopener">${esc(host || w.title || t("wordsPage"))}</a>` : ""}</div>` : ""}
      </div>
      <div class="side">
        <button class="icon" data-act="speak" title="${esc(t("wordsSpeak"))}">🔊</button>
        <button class="icon del" data-act="delete">${esc(t("wordsDelete"))}</button>
        <span class="meta">${new Date(w.savedAt).toLocaleDateString(locale)}</span>
      </div>
    </div>`;
  }).join("");
}

$("list").addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-act]");
  if (!btn) return;
  const key = btn.closest(".item").dataset.key;
  const w = words.find((x) => x.key === key);
  if (!w) return;
  if (btn.dataset.act === "speak") {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(headword(w));
    u.lang = "de-DE";
    u.rate = 0.9;
    speechSynthesis.speak(u);
  }
  if (btn.dataset.act === "delete") {
    words = words.filter((x) => x.key !== key);
    await chrome.storage.local.set({ words });
  }
});

$("search").addEventListener("input", render);

$("clear").addEventListener("click", async () => {
  if (!words.length) return;
  const btn = $("clear");
  if (btn.dataset.confirm !== "1") {
    btn.dataset.confirm = "1";
    btn.textContent = t("wordsConfirm");
    setTimeout(() => { btn.dataset.confirm = ""; btn.textContent = t("wordsClear"); }, 3000);
    return;
  }
  words = [];
  await chrome.storage.local.set({ words });
});

function csvCell(v) {
  const s = String(v ?? "");
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

$("export").addEventListener("click", () => {
  const header = ["Front", "Back", "Plural", "IPA", "Example", "ExampleTranslation", "SeenIn", "URL"];
  const rows = words.map((w) => [
    headword(w), meaningOf(w), w.plural, w.ipa, w.example_de, exampleTrOf(w), w.sentence, w.url,
  ]);
  const csv = "﻿" + [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${lang === "en" ? "german-words" : "almanca-kelimeler"}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (changes.words) words = Array.isArray(changes.words.newValue) ? changes.words.newValue : [];
  if (changes.settings) {
    lang = changes.settings.newValue?.lang === "en" ? "en" : "tr";
    almancaApplyI18n(lang);
  }
  if (changes.words || changes.settings) render();
});

load();
