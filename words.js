const $ = (id) => document.getElementById(id);
let words = [];

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function headword(w) {
  return w.article ? `${w.article} ${w.lemma}` : w.lemma;
}

async function load() {
  const res = await chrome.storage.local.get("words");
  words = Array.isArray(res.words) ? res.words : [];
  render();
}

function render() {
  const q = $("search").value.trim().toLowerCase();
  const shown = q
    ? words.filter((w) => [w.lemma, w.meaning_tr, w.original, w.example_de].some((f) => String(f || "").toLowerCase().includes(q)))
    : words;

  $("count").textContent = `${words.length} kelime`;
  const list = $("list");
  if (!shown.length) {
    list.innerHTML = `<div class="empty">${words.length ? "Eşleşen kelime yok." : "Henüz kelime kaydetmedin. Bir sayfada kelimeye sağ tıkla → “Almancasını göster” → Kaydet."}</div>`;
    return;
  }

  list.innerHTML = shown.map((w) => {
    const art = ["der", "die", "das"].includes(w.article) ? w.article : "";
    const meta = [w.word_type, w.plural && w.plural !== "—" ? `Çoğul: ${w.plural}` : "", w.ipa].filter(Boolean).join(" · ");
    const verb = w.verb && (w.verb.praeteritum || w.verb.perfekt)
      ? `<div class="meta">${esc([w.verb.praeteritum, w.verb.perfekt, w.verb.separable_example, w.verb.case].filter(Boolean).join(" · "))}</div>`
      : "";
    let host = "";
    try { host = new URL(w.url).hostname; } catch { /* yoksay */ }
    return `<div class="item" data-key="${esc(w.key)}">
      <div>
        <div class="word">${art ? `<span class="${art}">${art}</span> ` : ""}${esc(w.lemma)}${w.level ? `<span class="lv lv-${esc(w.level.slice(0, 2))}">${esc(w.level)}</span>` : ""}</div>
        ${meta ? `<div class="meta">${esc(meta)}</div>` : ""}
        ${verb}
        <div class="meaning">${esc(w.meaning_tr)}</div>
        ${w.example_de ? `<div class="ex">${esc(w.example_de)}<br><span class="tr">${esc(w.example_tr)}</span></div>` : ""}
        ${w.sentence ? `<div class="seen">Görüldüğü yer: “${esc(w.sentence)}” — ${w.url ? `<a href="${esc(w.url)}" target="_blank" rel="noopener">${esc(host || w.title || "sayfa")}</a>` : ""}</div>` : ""}
      </div>
      <div class="side">
        <button class="icon" data-act="speak" title="Seslendir">🔊</button>
        <button class="icon del" data-act="delete" title="Sil">Sil</button>
        <span class="meta">${new Date(w.savedAt).toLocaleDateString("tr-TR")}</span>
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
    btn.textContent = "Emin misin? Tekrar tıkla";
    setTimeout(() => { btn.dataset.confirm = ""; btn.textContent = "Tümünü sil"; }, 3000);
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
  const header = ["Front", "Back", "Plural", "IPA", "Example", "ExampleTr", "SeenIn", "URL"];
  const rows = words.map((w) => [
    headword(w), w.meaning_tr, w.plural, w.ipa, w.example_de, w.example_tr, w.sentence, w.url,
  ]);
  const csv = "﻿" + [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `almanca-kelimeler-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.words) {
    words = Array.isArray(changes.words.newValue) ? changes.words.newValue : [];
    render();
  }
});

load();
