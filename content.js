// Almanca Kelime Asistanı — content script
// Sağ tıklanan kelimeyi yakalar ve Shadow DOM içindeki bir kartta sonucu gösterir.

(() => {
  if (window.__almancaAsistaniLoaded) return;
  window.__almancaAsistaniLoaded = true;

  const WORD_CHAR = /[\p{L}\p{M}'’-]/u;
  let lastContext = null; // { word, context, x, y } — son sağ tık
  let host = null;
  let lookupSeq = 0;
  let lang = "tr"; // dil çifti; her komutta background'dan gelir
  const t = (key, vars) => globalThis.almancaT(lang, key, vars);

  // ---------- Kelimeyi yakala ----------

  document.addEventListener(
    "contextmenu",
    (e) => {
      const hit = wordAtPoint(e.clientX, e.clientY);
      lastContext = {
        word: hit?.word || "",
        context: hit?.context || "",
        x: e.clientX,
        y: e.clientY,
      };
    },
    true
  );

  function wordAtPoint(x, y) {
    let node, offset;
    if (document.caretRangeFromPoint) {
      const r = document.caretRangeFromPoint(x, y);
      if (!r) return null;
      node = r.startContainer;
      offset = r.startOffset;
    } else if (document.caretPositionFromPoint) {
      const p = document.caretPositionFromPoint(x, y);
      if (!p) return null;
      node = p.offsetNode;
      offset = p.offset;
    }
    if (!node || node.nodeType !== Node.TEXT_NODE) return null;

    const text = node.textContent;
    let s = offset;
    let e = offset;
    while (s > 0 && WORD_CHAR.test(text[s - 1])) s--;
    while (e < text.length && WORD_CHAR.test(text[e])) e++;
    if (s === e) return null;

    // İmleç gerçekten kelimenin üstünde mi?
    const range = document.createRange();
    range.setStart(node, s);
    range.setEnd(node, e);
    const rect = range.getBoundingClientRect();
    if (x < rect.left - 2 || x > rect.right + 2 || y < rect.top - 2 || y > rect.bottom + 2) return null;

    const word = text.slice(s, e).replace(/^['’-]+|['’-]+$/g, "");
    if (!word) return null;
    return { word, context: sentenceAround(node, word) };
  }

  function sentenceAround(node, word) {
    const block =
      node.parentElement?.closest("p, li, td, th, h1, h2, h3, h4, h5, h6, blockquote, figcaption, dd, dt, div") ||
      node.parentElement;
    const text = (block?.innerText || node.textContent || "").replace(/\s+/g, " ").trim();
    if (!text) return "";
    const sentences = text.split(/(?<=[.!?…])\s+/);
    const found = sentences.find((s) => s.includes(word)) || text;
    return found.slice(0, 300);
  }

  // ---------- Arka plandan gelen komut ----------

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type !== "ALMANCA_SHOW") return;
    lang = msg.lang === "en" ? "en" : "tr";
    const sel = window.getSelection();
    let word = msg.selectionText || "";
    let context = "";
    let anchor = null;

    if (word && sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      anchor = { x: rect.left, y: rect.bottom };
      const node = range.startContainer.nodeType === Node.TEXT_NODE ? range.startContainer : null;
      if (node) context = sentenceAround(node, word);
    }
    if (!word && lastContext?.word) {
      word = lastContext.word;
      context = lastContext.context;
    }
    if (!anchor && lastContext) anchor = { x: lastContext.x, y: lastContext.y + 12 };
    if (!anchor) anchor = { x: window.innerWidth / 2 - 170, y: 80 };

    word = word.replace(/\s+/g, " ").trim().slice(0, 80);
    if (!word) {
      showCard(anchor, renderMessage(t("notFoundTitle"), t("notFoundHint")));
      return;
    }
    runLookup(word, context, anchor);
  });

  async function runLookup(word, context, anchor) {
    const seq = ++lookupSeq;
    showCard(anchor, renderLoading(word));
    const res = await send({ type: "LOOKUP", word, context });
    if (seq !== lookupSeq) return; // daha yeni bir arama başladı
    if (!res?.ok) {
      showCard(anchor, renderError(res), { word, context });
      return;
    }
    if (!res.data.found) {
      showCard(anchor, renderMessage(word, t("noEntry")));
      return;
    }
    showCard(anchor, renderResult(word, res.data), { word, context, data: res.data });
  }

  function send(msg) {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage(msg, (res) => {
          if (chrome.runtime.lastError) resolve({ ok: false, error: t("reloaded") });
          else resolve(res);
        });
      } catch {
        resolve({ ok: false, error: t("reloaded") });
      }
    });
  }

  // ---------- Kart ----------

  const STYLE = `
    :host { all: initial; }
    .card {
      --der: #2563eb; --die: #dc2626; --das: #16a34a;
      --bg: #ffffff; --fg: #262626; --muted: #737373; --line: #e5e5e5; --chip: #f4f4f4; --accent: #2b2b2b;
      --lv-a: #15803d; --lv-b: #b45309; --lv-c: #737373;
      box-sizing: border-box; width: 340px; max-width: calc(100vw - 16px);
      font: 14px/1.45 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
      color: var(--fg); background: var(--bg); border: 1px solid var(--line);
      border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,.18); padding: 14px 16px; position: relative;
    }
    @media (prefers-color-scheme: dark) {
      .card { --der: #60a5fa; --die: #f87171; --das: #4ade80;
        --bg: #252525; --fg: #ececec; --muted: #a3a3a3; --line: #3a3a3a; --chip: #333333; --accent: #ececec;
        --lv-a: #4ade80; --lv-b: #fbbf24; --lv-c: #a3a3a3; }
    }
    * { box-sizing: border-box; }
    .close { position: absolute; top: 8px; right: 10px; border: 0; background: none; color: var(--muted);
      font-size: 18px; cursor: pointer; line-height: 1; padding: 2px 4px; }
    .close:hover { color: var(--fg); }
    .head { display: flex; align-items: center; gap: 8px; padding-right: 20px; flex-wrap: wrap; }
    .lemma { font-size: 20px; font-weight: 700; }
    .art { font-weight: 700; }
    .art.der { color: var(--der); } .art.die { color: var(--die); } .art.das { color: var(--das); }
    .lemma.der { border-bottom: 3px solid var(--der); }
    .lemma.die { border-bottom: 3px solid var(--die); }
    .lemma.das { border-bottom: 3px solid var(--das); }
    .sub { color: var(--muted); font-size: 13px; margin-top: 2px; }
    .chips { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 8px; }
    .chip { background: var(--chip); border-radius: 999px; padding: 1px 8px; font-size: 12px; color: var(--fg); }
    .meaning { font-size: 15px; margin-top: 10px; }
    .note { color: var(--muted); font-size: 12.5px; margin-top: 4px; font-style: italic; }
    .section { border-top: 1px solid var(--line); margin-top: 10px; padding-top: 10px; }
    .label { font-size: 11px; text-transform: uppercase; letter-spacing: .04em; color: var(--muted); margin-bottom: 3px; }
    .grid { display: grid; grid-template-columns: auto 1fr; gap: 2px 10px; font-size: 13px; }
    .grid dt { color: var(--muted); } .grid dd { margin: 0; }
    .ex-de { font-weight: 500; }
    .ex-tr { color: var(--muted); font-size: 13px; }
    .row { display: flex; align-items: flex-start; gap: 6px; }
    .speak { flex: none; border: 1px solid var(--line); background: var(--chip); color: var(--fg);
      border-radius: 8px; width: 28px; height: 26px; cursor: pointer; font-size: 13px; padding: 0; }
    .speak:hover { border-color: var(--muted); }
    .actions { display: flex; gap: 8px; margin-top: 12px; }
    .btn { border: 1px solid var(--accent); background: var(--accent); color: var(--bg);
      border-radius: 8px; padding: 5px 12px; cursor: pointer; font: inherit; font-size: 13px; font-weight: 600; }
    .btn.ghost { background: transparent; color: var(--fg); border-color: var(--line); }
    .btn[disabled] { opacity: .6; cursor: default; }
    .spinner { width: 16px; height: 16px; border: 2px solid var(--line); border-top-color: var(--fg);
      border-radius: 50%; animation: spin .8s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .err { color: var(--die); }
    .tag { display: inline-block; font-size: 10.5px; text-transform: uppercase; letter-spacing: .04em;
      border: 1px solid var(--line); border-radius: 4px; padding: 0 4px; margin-right: 2px; color: var(--muted); }
    .label a, .src a { color: var(--muted); }
    .actions { align-items: center; }
    .src { margin-left: auto; font-size: 11px; color: var(--muted); }
    .chip.lv { font-weight: 700; background: transparent; border: 1px solid currentColor; }
    .chip.lv-A1, .chip.lv-A2 { color: var(--lv-a); }
    .chip.lv-B1 { color: var(--lv-b); }
    .chip.lv-B2 { color: var(--lv-c); }
  `;

  function ensureHost() {
    if (host && host.isConnected) return host;
    host = document.createElement("almanca-asistani");
    host.style.cssText = "position:absolute;top:0;left:0;z-index:2147483647;";
    const root = host.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = STYLE;
    const card = document.createElement("div");
    card.className = "card";
    root.append(style, card);
    document.documentElement.appendChild(host);
    return host;
  }

  function closeCard() {
    lookupSeq++;
    if (host) host.remove();
    host = null;
    try { speechSynthesis.cancel(); } catch { /* yoksay */ }
  }

  function showCard(anchor, html, state = {}) {
    const h = ensureHost();
    const card = h.shadowRoot.querySelector(".card");
    card.innerHTML = `<button class="close" title="${esc(t("close"))}" data-act="close">×</button>${html}`;
    bindActions(card, state);
    position(h, anchor);
  }

  function position(h, anchor) {
    const card = h.shadowRoot.querySelector(".card");
    const w = card.offsetWidth;
    const ht = card.offsetHeight;
    let left = anchor.x;
    let top = anchor.y + 6;
    left = Math.max(8, Math.min(left, window.innerWidth - w - 8));
    if (top + ht > window.innerHeight - 8) top = Math.max(8, anchor.y - ht - 24);
    h.style.left = `${left + window.scrollX}px`;
    h.style.top = `${top + window.scrollY}px`;
  }

  document.addEventListener(
    "mousedown",
    (e) => {
      if (host && !e.composedPath().includes(host)) closeCard();
    },
    true
  );
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && host) closeCard();
  });

  // ---------- Etkileşim ----------

  function bindActions(card, state) {
    card.querySelectorAll("[data-act]").forEach((el) => {
      el.addEventListener("click", async (e) => {
        e.stopPropagation();
        const act = el.dataset.act;
        if (act === "close") closeCard();
        if (act === "speak") speak(el.dataset.text);
        if (act === "options") send({ type: "OPEN_OPTIONS" });
        if (act === "retry" && state.word) {
          const rect = host.getBoundingClientRect();
          runLookup(state.word, state.context, { x: rect.left, y: rect.top - 6 });
        }
        if (act === "save" && state.data) {
          el.disabled = true;
          const res = await send({ type: "SAVE_WORD", entry: makeEntry(state) });
          el.textContent = res?.ok ? t("saved") : t("saveFailed");
        }
      });
    });

    if (state.data) {
      const btn = card.querySelector('[data-act="save"]');
      send({ type: "IS_SAVED", key: entryKey(state.data) }).then((res) => {
        if (res?.ok && res.data && btn) {
          btn.textContent = t("saved");
          btn.disabled = true;
        }
      });
    }
  }

  function entryKey(d) {
    return `${d.article || ""}|${d.lemma}`.toLowerCase();
  }

  function makeEntry({ word, context, data }) {
    return {
      key: entryKey(data),
      lemma: data.lemma,
      article: data.article,
      plural: data.plural,
      word_type: data.word_type,
      ipa: data.ipa,
      level: data.level,
      lang,
      meaning: data.meaning || data.definition_de,
      example_de: data.example_de,
      example_translation: data.example_translation,
      verb: data.verb,
      original: word,
      sentence: context,
      url: location.href,
      title: document.title,
    };
  }

  let voicesReady = null;
  function getGermanVoice() {
    const pick = () => {
      const voices = speechSynthesis.getVoices();
      return voices.find((v) => v.lang === "de-DE") || voices.find((v) => v.lang?.startsWith("de")) || null;
    };
    if (speechSynthesis.getVoices().length) return Promise.resolve(pick());
    if (!voicesReady) {
      voicesReady = new Promise((resolve) => {
        speechSynthesis.addEventListener("voiceschanged", () => resolve(pick()), { once: true });
        setTimeout(() => resolve(pick()), 800);
      });
    }
    return voicesReady;
  }

  async function speak(text) {
    if (!text || !("speechSynthesis" in window)) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "de-DE";
    u.rate = 0.9;
    const voice = await getGermanVoice();
    if (voice) u.voice = voice;
    speechSynthesis.speak(u);
  }

  // ---------- Şablonlar ----------

  function esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function speakBtn(text, title) {
    return `<button class="speak" data-act="speak" data-text="${esc(text)}" title="${esc(title)}">🔊</button>`;
  }

  function renderLoading(word) {
    return `<div class="head"><div class="spinner"></div><span class="lemma" style="font-size:16px">${esc(word)}</span></div>
      <div class="sub">${esc(t("searching"))}</div>`;
  }

  function renderMessage(title, text) {
    return `<div class="head"><span class="lemma" style="font-size:16px">${esc(title)}</span></div>
      <div class="sub" style="margin-top:6px">${esc(text)}</div>`;
  }

  function renderError(res) {
    const needsKey = res?.code === "NO_KEY" || res?.code === "BAD_KEY";
    const isRate = res?.code === "RATE";
    const action = needsKey
      ? `<button class="btn" data-act="options">${esc(t("openSettings"))}</button>`
      : `<button class="btn" data-act="retry">${esc(t("retry"))}</button>`;
    return `<div class="head"><span class="lemma ${isRate ? "" : "err"}" style="font-size:16px">${esc(isRate ? t("waitTitle") : t("errorTitle"))}</span></div>
      <div class="sub" style="margin-top:6px">${esc(res?.error || t("unknownError"))}</div>
      <div class="actions">${action}</div>`;
  }

  function tag(text) {
    return text ? `<span class="tag">${esc(text)}</span> ` : "";
  }

  function renderResult(word, d) {
    const art = d.article;
    const spoken = art ? `${art} ${d.lemma}` : d.lemma;
    const typeLabel = d.word_type ? t(`type_${d.word_type}`) : "";
    const v = d.verb || {};
    const isVerb = d.word_type === "verb" && (v.praeteritum || v.perfekt);

    const chips = [
      typeLabel && typeLabel !== `type_${d.word_type}` && `<span class="chip">${esc(typeLabel)}</span>`,
      d.level && `<span class="chip lv lv-${esc(d.level.slice(0, 2))}" title="${esc(t("levelTitle"))}">${esc(d.level)}</span>`,
      d.plural && d.plural !== "—" && `<span class="chip">${esc(t("plural", { x: d.plural }))}</span>`,
      d.plural === "—" && `<span class="chip">${esc(t("noPlural"))}</span>`,
    ].filter(Boolean).join("");

    const inputNote = d.note
      ? `<div class="note">${esc(d.note)}</div>`
      : d.detected_language !== "de" && word.toLowerCase() !== String(d.lemma).toLowerCase()
        ? `<div class="note">${esc(t("germanOf", { w: word }))}</div>`
        : "";

    let meaning = "";
    if (d.meaning) meaning = `<div class="meaning">${esc(d.meaning)}</div>`;
    else if (d.definition_de) meaning = `<div class="meaning">${esc(d.definition_de)}</div><div class="sub">${esc(t("noMeaningDef"))}</div>`;
    const extraMeaning = [
      d.meaning_alt && d.meaning ? `${tag(t("tagAlt"))}${esc(d.meaning_alt)}` : "",
      d.definition_de && d.meaning ? `${tag(t("tagDef"))}${esc(d.definition_de)}` : "",
    ].filter(Boolean).map((x) => `<div class="sub">${x}</div>`).join("");

    const caseText = v.case === "intransitive" ? t("intransitive") : v.case;
    const verbSection = isVerb
      ? `<div class="section"><div class="label">${esc(t("verbInfo"))}</div><dl class="grid">
          ${v.praeteritum ? `<dt>Präteritum</dt><dd>${esc(v.praeteritum)}</dd>` : ""}
          ${v.perfekt ? `<dt>Perfekt</dt><dd>${esc(v.perfekt)}</dd>` : ""}
          ${v.separable ? `<dt>${esc(t("separable"))}</dt><dd>${esc(v.separable_example || t("yes"))}</dd>` : ""}
          ${caseText ? `<dt>${esc(t("case"))}</dt><dd>${esc(caseText)}</dd>` : ""}
        </dl></div>`
      : "";

    const compound =
      Array.isArray(d.compound_parts) && d.compound_parts.length > 1
        ? `<div class="section"><div class="label">${esc(t("compound"))}</div>${esc(d.lemma)} = ${d.compound_parts.map(esc).join(" + ")}</div>`
        : "";

    // Çeviri seçili dil çiftinden farklı bir dildeyse (ör. Türkçe yerine İngilizce) etiketlenir
    const otherLang = d.example_translation_lang && d.example_translation_lang !== lang;
    const exTr = d.example_translation
      ? `<div class="ex-tr">${otherLang ? tag(t("tagEnglish")) : ""}${esc(d.example_translation)}</div>`
      : "";
    const exSrc = d.example_url
      ? ` · <a href="${esc(d.example_url)}" target="_blank" rel="noopener">Tatoeba</a>`
      : "";
    const example = d.example_de
      ? `<div class="section"><div class="label">${esc(t("example"))}${exSrc}</div>
          <div class="row">${speakBtn(d.example_de, t("speakSentence"))}
            <div><div class="ex-de">${esc(d.example_de)}</div>${exTr}</div>
          </div></div>`
      : "";

    return `
      <div class="head">
        ${speakBtn(spoken, t("speakWord"))}
        <span class="lemma ${esc(art)}">${art ? `<span class="art ${esc(art)}">${esc(art)}</span> ` : ""}${esc(d.lemma)}</span>
      </div>
      ${d.ipa ? `<div class="sub">${esc(d.ipa)}</div>` : ""}
      ${chips ? `<div class="chips">${chips}</div>` : ""}
      ${meaning}
      ${extraMeaning}
      ${inputNote}
      ${verbSection}
      ${compound}
      ${example}
      <div class="actions"><button class="btn" data-act="save">${esc(t("save"))}</button>
        ${d.source ? `<span class="src">${esc(t("source", { s: d.source }))}</span>` : ""}</div>`;
  }
})();
