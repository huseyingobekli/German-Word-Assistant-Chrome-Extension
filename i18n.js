// Arayüz metinleri (Türkçe / English).
// Klasik betik olarak yüklenir; content script, sayfalar ve service worker ortak kullanır.
// Kullanım: almancaT(lang, "key", { değişken: değer })

(() => {
  const STRINGS = {
    tr: {
      // Sağ tık menüsü
      menuSelection: 'Almancasını göster: "%s"',
      menuWord: "Almancasını göster",

      // Kart
      close: "Kapat",
      searching: "Aranıyor…",
      notFoundTitle: "Kelime bulunamadı",
      notFoundHint: "İmleci bir kelimenin üstüne getirip sağ tıkla ya da kelimeyi seç.",
      noEntry: "Bu kelime için sözlük kaydı bulunamadı.",
      reloaded: "Eklenti yeniden yüklenmiş; sayfayı yenile.",
      waitTitle: "Biraz bekle",
      errorTitle: "Bir sorun oluştu",
      unknownError: "Bilinmeyen hata.",
      retry: "Tekrar dene",
      openSettings: "Ayarları aç",
      save: "Kaydet",
      saved: "Kaydedildi ✓",
      saveFailed: "Kaydedilemedi",
      levelTitle: "Yaklaşık CEFR seviyesi (Claude tahmini)",
      plural: "Çoğul: {x}",
      noPlural: "Çoğulu yok",
      germanOf: '"{w}" kelimesinin Almancası',
      noMeaningDef: "Türkçe anlam bulunamadı; Almanca tanım gösteriliyor.",
      tagAlt: "İng.",
      tagDef: "Tanım",
      tagEnglish: "İng.",
      verbInfo: "Fiil bilgisi",
      separable: "Ayrılabilen",
      yes: "evet",
      case: "Hâl",
      intransitive: "geçişsiz (nesne almaz)",
      compound: "Birleşik kelime",
      example: "Örnek cümle",
      speakWord: "Kelimeyi seslendir",
      speakSentence: "Cümleyi seslendir",
      source: "Kaynak: {s}",

      // Kelime türleri
      type_noun: "isim", type_verb: "fiil", type_adj: "sıfat", type_adv: "zarf", type_prep: "edat",
      type_conj: "bağlaç", type_pron: "zamir", type_article: "artikel", type_interj: "ünlem",
      type_num: "sayı", type_phrase: "ifade", type_other: "",

      // Sözlük notları
      inflectedNote: '"{form}", {lemma} kelimesinin çekimli hâli{m}.',
      reverseNote: '"{w}" kelimesinin Almancası{others}.',
      reverseOthers: " (diğer karşılıklar: {list})",
      compoundNote: "Sözlükte ayrı kaydı yok; anlam parçalarından tahmin edildi. Artikel son parçadan gelir.",

      // Hatalar
      errEmpty: "Kelime bulunamadı.",
      errNetwork: "Ağ hatası: sözlüğe ulaşılamadı.",
      errRate: "Sözlük şu an çok yoğun. Birkaç saniye sonra tekrar dene.",
      errServer: "Sözlük yanıt vermedi ({s}).",
      errNoKey: "Claude seçili ama API anahtarı girilmemiş. Ayarlardan anahtar ekle ya da ücretsiz sözlüğe geç.",
      errBadKey: "API anahtarı geçersiz. Ayarlardan kontrol et.",
      errApiRate: "Çok fazla istek. Biraz bekleyip tekrar dene.",
      errApiServer: "Claude API şu an yanıt vermiyor ({s}).",
      errApi: "API hatası ({s}): {d}",
      errApiNetwork: "Ağ hatası: Claude API'sine ulaşılamadı.",
      errRefusal: "Bu kelime için yanıt alınamadı.",
      errTruncated: "Yanıt yarıda kesildi, tekrar dene.",
      errParse: "Yanıt çözümlenemedi.",
      errBadEntry: "Kaydedilecek kelime yok.",

      // Ayarlar sayfası
      optTitle: "Ayarlar",
      optLead: "Bir sayfada kelimeye sağ tıklayıp “Almancasını göster” seçeneğini kullan.",
      optLang: "Dil çifti",
      optLangHint: "Anlamlar, örnek cümle çevirileri ve arayüz bu dilde gösterilir.",
      optSource: "Sözlük kaynağı",
      optSourceFree: "Ücretsiz — Wiktionary + Tatoeba (anahtar gerekmez)",
      optSourceClaude: "Claude API (anahtar gerekir, ücretli)",
      optSourceHint:
        "Ücretsiz mod; artikel, çoğul, IPA, fiil çekimi ve kök bulmayı Wiktionary'den, çevirili örnek cümleleri Tatoeba'dan alır. Bazı kelimelerde Türkçe anlam olmayabilir; o zaman İngilizce anlam veya Almanca tanım gösterilir. Seviye etiketi (A1–C2) sadece Claude modunda gösterilir.",
      optKey: "Claude API anahtarı",
      optKeyHint: "Anahtar yalnızca bu tarayıcıda (chrome.storage.local) saklanır ve sadece api.anthropic.com'a gönderilir. Anahtar almak için:",
      optModel: "Model",
      optModelOpus: "Claude Opus 5.5 — en doğru",
      optModelSonnet: "Claude Sonnet 5.5 — dengeli",
      optModelHaiku: "Claude Haiku 5.5 — en hızlı ve ucuz",
      optDirection: "Çeviri yönü",
      optDirAuto: "Otomatik algıla",
      optDirFromDe: "Almanca → Türkçe",
      optDirToDe: "Türkçe / İngilizce → Almanca",
      optDirHint: "Otomatikte, Almanca kelimelerin Türkçe anlamı; Türkçe/İngilizce kelimelerin Almanca karşılığı gösterilir.",
      optSave: "Kaydet",
      optTest: "Bağlantıyı test et",
      optSaved: "Kaydedildi ✓",
      optTesting: "Test ediliyor…",
      optWorks: "Çalışıyor ✓  {r}",
      optCache: "Önbellekteki arama sonuçları",
      optClearCache: "Önbelleği temizle",
      optCleared: "Temizlendi ({n})",
      optToWords: "Kelime defterine git →",

      // Kelime defteri
      wordsTitle: "Kelime Defteri",
      wordsCount: "{n} kelime",
      wordsSettings: "Ayarlar",
      wordsSearch: "Ara (Almanca veya Türkçe)…",
      wordsExport: "CSV indir (Anki)",
      wordsClear: "Tümünü sil",
      wordsConfirm: "Emin misin? Tekrar tıkla",
      wordsNoMatch: "Eşleşen kelime yok.",
      wordsEmpty: "Henüz kelime kaydetmedin. Bir sayfada kelimeye sağ tıkla → “Almancasını göster” → Kaydet.",
      wordsSeen: "Görüldüğü yer",
      wordsPage: "sayfa",
      wordsSpeak: "Seslendir",
      wordsDelete: "Sil",
      wordsPlural: "Çoğul: {x}",
    },

    en: {
      menuSelection: 'Look up in German: "%s"',
      menuWord: "Look up in German",

      close: "Close",
      searching: "Looking up…",
      notFoundTitle: "No word found",
      notFoundHint: "Right-click directly on a word, or select it first.",
      noEntry: "No dictionary entry was found for this word.",
      reloaded: "The extension was reloaded; please refresh the page.",
      waitTitle: "Please wait",
      errorTitle: "Something went wrong",
      unknownError: "Unknown error.",
      retry: "Try again",
      openSettings: "Open settings",
      save: "Save",
      saved: "Saved ✓",
      saveFailed: "Could not save",
      levelTitle: "Approximate CEFR level (estimated by Claude)",
      plural: "Plural: {x}",
      noPlural: "No plural",
      germanOf: 'German for "{w}"',
      noMeaningDef: "No English translation found; showing the German definition.",
      tagAlt: "",
      tagDef: "Definition",
      tagEnglish: "",
      verbInfo: "Verb forms",
      separable: "Separable",
      yes: "yes",
      case: "Case",
      intransitive: "intransitive (no object)",
      compound: "Compound",
      example: "Example",
      speakWord: "Play word",
      speakSentence: "Play sentence",
      source: "Source: {s}",

      type_noun: "noun", type_verb: "verb", type_adj: "adjective", type_adv: "adverb", type_prep: "preposition",
      type_conj: "conjunction", type_pron: "pronoun", type_article: "article", type_interj: "interjection",
      type_num: "numeral", type_phrase: "phrase", type_other: "",

      inflectedNote: '"{form}" is an inflected form of {lemma}{m}.',
      reverseNote: 'German for "{w}"{others}.',
      reverseOthers: " (also: {list})",
      compoundNote: "Not listed in the dictionary; the meaning is inferred from its parts. The article comes from the last part.",

      errEmpty: "No word given.",
      errNetwork: "Network error: could not reach the dictionary.",
      errRate: "The dictionary is busy right now. Try again in a few seconds.",
      errServer: "The dictionary did not respond ({s}).",
      errNoKey: "Claude is selected but no API key is set. Add a key in the settings or switch to the free dictionary.",
      errBadKey: "The API key is invalid. Please check it in the settings.",
      errApiRate: "Too many requests. Wait a moment and try again.",
      errApiServer: "The Claude API is not responding right now ({s}).",
      errApi: "API error ({s}): {d}",
      errApiNetwork: "Network error: could not reach the Claude API.",
      errRefusal: "No answer could be generated for this word.",
      errTruncated: "The response was cut off; please try again.",
      errParse: "The response could not be parsed.",
      errBadEntry: "Nothing to save.",

      optTitle: "Settings",
      optLead: "Right-click a word on any page and choose “Look up in German”.",
      optLang: "Language pair",
      optLangHint: "Meanings, example translations and the interface are shown in this language.",
      optSource: "Dictionary source",
      optSourceFree: "Free — Wiktionary + Tatoeba (no key needed)",
      optSourceClaude: "Claude API (requires a key, paid)",
      optSourceHint:
        "Free mode gets articles, plurals, IPA, verb forms and base forms from Wiktionary, and translated example sentences from Tatoeba. CEFR level labels (A1–C2) are only shown in Claude mode.",
      optKey: "Claude API key",
      optKeyHint: "The key is stored only in this browser (chrome.storage.local) and is sent only to api.anthropic.com. Get a key at:",
      optModel: "Model",
      optModelOpus: "Claude Opus 5.5 — most accurate",
      optModelSonnet: "Claude Sonnet 5.5 — balanced",
      optModelHaiku: "Claude Haiku 5.5 — fastest and cheapest",
      optDirection: "Direction",
      optDirAuto: "Detect automatically",
      optDirFromDe: "German → English",
      optDirToDe: "English → German",
      optDirHint: "In automatic mode, German words get an English meaning and English words get their German equivalent.",
      optSave: "Save",
      optTest: "Test connection",
      optSaved: "Saved ✓",
      optTesting: "Testing…",
      optWorks: "Working ✓  {r}",
      optCache: "Cached lookup results",
      optClearCache: "Clear cache",
      optCleared: "Cleared ({n})",
      optToWords: "Go to word list →",

      wordsTitle: "Word List",
      wordsCount: "{n} words",
      wordsSettings: "Settings",
      wordsSearch: "Search (German or English)…",
      wordsExport: "Download CSV (Anki)",
      wordsClear: "Delete all",
      wordsConfirm: "Are you sure? Click again",
      wordsNoMatch: "No matching words.",
      wordsEmpty: "No saved words yet. Right-click a word on any page → “Look up in German” → Save.",
      wordsSeen: "Seen in",
      wordsPage: "page",
      wordsSpeak: "Play",
      wordsDelete: "Delete",
      wordsPlural: "Plural: {x}",
    },
  };

  function t(lang, key, vars = {}) {
    const table = STRINGS[lang] || STRINGS.tr;
    let s = table[key] ?? STRINGS.tr[key] ?? key;
    for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
    return s;
  }

  /** Sayfadaki [data-i18n], [data-i18n-placeholder] ve [data-i18n-title] öğelerini çevirir. */
  function apply(lang, root = document) {
    root.querySelectorAll("[data-i18n]").forEach((el) => { el.textContent = t(lang, el.dataset.i18n); });
    root.querySelectorAll("[data-i18n-placeholder]").forEach((el) => { el.placeholder = t(lang, el.dataset.i18nPlaceholder); });
    root.querySelectorAll("[data-i18n-title]").forEach((el) => { el.title = t(lang, el.dataset.i18nTitle); });
    if (root.documentElement) root.documentElement.lang = lang;
  }

  globalThis.almancaT = t;
  globalThis.almancaApplyI18n = apply;
})();
