// Anahtarsız sözlük: Wiktionary (de / tr / en) + Tatoeba
// Hem service worker'da hem de Node'da (test için) çalışır.

const HEADERS = { "Api-User-Agent": "AlmancaKelimeAsistani/0.2 (Chrome extension)" };
const DE = "de.wiktionary.org";
const TR = "tr.wiktionary.org";
const EN = "en.wiktionary.org";

const FORM_TYPES = new Set([
  "Konjugierte Form", "Deklinierte Form", "Komparativ", "Superlativ",
  "Partizip I", "Partizip II", "Erweiterter Infinitiv", "Flektierte Form",
]);

export class LookupError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

// ---------- Ağ ----------

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJSON(url, attempt = 0) {
  let res;
  try {
    res = await fetch(url, { headers: HEADERS });
  } catch {
    throw new LookupError("NETWORK", "Ağ hatası: sözlüğe ulaşılamadı.");
  }
  if (res.status === 429 && attempt < 2) {
    const wait = Math.min(Number(res.headers.get("retry-after")) || 2, 5);
    await sleep(wait * 1000);
    return getJSON(url, attempt + 1);
  }
  if (res.status === 429) throw new LookupError("RATE", "Sözlük şu an çok yoğun. Birkaç saniye sonra tekrar dene.");
  if (!res.ok) throw new LookupError("SERVER", `Sözlük yanıt vermedi (${res.status}).`);
  return res.json();
}

/** Birden çok başlığın wikitext'ini tek istekte getirir. Dönen dizi istenen sırayla eşleşir. */
async function wikiPages(host, titles) {
  const unique = [...new Set(titles.filter(Boolean))].slice(0, 50);
  if (!unique.length) return [];
  const url = new URL(`https://${host}/w/api.php`);
  Object.entries({
    action: "query", prop: "revisions", rvprop: "content", rvslots: "main",
    format: "json", formatversion: "2", redirects: "1", titles: unique.join("|"),
  }).forEach(([k, v]) => url.searchParams.set(k, v));
  const d = await getJSON(url);
  const q = d.query || {};
  const byTitle = new Map();
  for (const p of q.pages || []) {
    const text = p.revisions?.[0]?.slots?.main?.content;
    if (!p.missing && text) byTitle.set(p.title, text);
  }
  const resolve = (t) => {
    for (const n of q.normalized || []) if (n.from === t) t = n.to;
    for (const r of q.redirects || []) if (r.from === t) t = r.to;
    return t;
  };
  return unique.map((t) => {
    const title = resolve(t);
    return { requested: t, title, text: byTitle.get(title) || null };
  });
}

// ---------- Wikitext yardımcıları ----------

function cleanWiki(s) {
  let out = String(s || "")
    .replace(/<ref[^>]*\/>/g, "")
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/g, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\{\{(?:l|L)\|[^|}]+\|([^|}]+)[^}]*\}\}/g, "$1");
  for (let i = 0; i < 3; i++) out = out.replace(/\{\{[^{}]*\}\}/g, "");
  return out
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, "$1")
    .replace(/'''?/g, "")
    .replace(/\s+/g, " ")
    .replace(/^[\s,;:.]+/, "")
    .replace(/\(\s*\)/g, "")
    .trim();
}

const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const uniq = (arr) => [...new Set(arr.filter(Boolean))];
const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** "== Hund ({{Sprache|Deutsch}}) ==" bölümünü döndürür. */
function germanSection(text) {
  const m = text?.match(/^==[^=].*\{\{Sprache\|Deutsch\}\}.*==[ \t]*$/m);
  if (!m) return null;
  const rest = text.slice(m.index + m[0].length);
  const next = rest.search(/^==[^=]/m);
  return next >= 0 ? rest.slice(0, next) : rest;
}

/** Bölümü "=== {{Wortart|...|Deutsch}} ===" başlıklarına göre parçalar. */
function wortartBlocks(section) {
  const re = /^===[^=].*?\{\{Wortart\|([^|}]+)\|Deutsch\}\}(.*?)===[ \t]*$/gm;
  const marks = [];
  let m;
  while ((m = re.exec(section))) marks.push({ wortart: m[1].trim(), heading: m[0], index: m.index, end: re.lastIndex });
  return marks.map((mk, i) => ({
    wortart: mk.wortart,
    heading: mk.heading,
    body: section.slice(mk.end, i + 1 < marks.length ? marks[i + 1].index : undefined),
  }));
}

/** "{{Bedeutungen}}" gibi bir alt bölümün satırlarını getirir. */
function subSection(body, name) {
  const i = body.indexOf(`{{${name}}}`);
  if (i < 0) return [];
  const lines = body.slice(i + name.length + 4).split("\n");
  const out = [];
  for (const line of lines) {
    if (/^\{\{[^}]+\}\}\s*$/.test(line) || /^=+/.test(line)) break;
    if (line.trim()) out.push(line);
  }
  return out;
}

function tplParam(body, name) {
  const m = body.match(new RegExp(`^\\|\\s*${escRe(name)}\\s*=\\s*(.*?)\\s*$`, "m"));
  return m ? m[1].trim() : "";
}

function wordType(wortart) {
  const w = wortart.toLowerCase();
  if (["substantiv", "toponym", "vorname", "nachname", "eigenname"].includes(w)) return "isim";
  if (w.includes("verb") && !w.includes("adverb")) return "fiil";
  if (w === "adjektiv") return "sıfat";
  if (w.includes("adverb")) return "zarf";
  if (w.includes("präposition") || w === "postposition") return "edat";
  if (w.includes("konjunktion") || w === "subjunktion") return "bağlaç";
  if (w.includes("pronomen")) return "zamir";
  if (w.includes("artikel")) return "artikel";
  if (w.includes("interjektion")) return "ünlem";
  if (w.includes("numerale") || w.includes("zahl")) return "sayı";
  if (w.includes("redewendung") || w.includes("wortverbindung") || w.includes("sprichwort")) return "ifade";
  return "diğer";
}

const GENUS = { m: "der", f: "die", n: "das" };

// ---------- de.wiktionary girdisini çözümle ----------

function parseGermanBlock(block, title) {
  const { body, heading } = block;
  const type = wordType(block.wortart);

  let article = "";
  let plural = "";
  if (type === "isim") {
    const g = tplParam(body, "Genus") || tplParam(body, "Genus 1") || (heading.match(/\{\{([mfn])\}\}/) || [])[1] || "";
    article = GENUS[g] || "";
    const pl = tplParam(body, "Nominativ Plural") || tplParam(body, "Nominativ Plural 1");
    if (pl === "—" || pl === "-" || pl === "–") plural = "—";
    else if (pl) plural = `die ${pl}`;
  }

  const aussprache = body.slice(Math.max(0, body.indexOf("{{Aussprache}}")));
  const ipaRaw = (aussprache.match(/\{\{Lautschrift\|([^}|]+)/) || [])[1] || "";
  const ipa = ipaRaw && ipaRaw !== "…" ? `/${ipaRaw}/` : "";

  const defLines = subSection(body, "Bedeutungen").filter((l) => /^:\[/.test(l));
  const definitions = defLines.map((l) => cleanWiki(l.replace(/^:\[[^\]]*\]/, ""))).filter(Boolean);

  const verb = { praeteritum: "", perfekt: "", separable: false, separable_example: "", case: "" };
  if (type === "fiil") {
    const praet = tplParam(body, "Präteritum_ich");
    const part = tplParam(body, "Partizip II");
    const aux = tplParam(body, "Hilfsverb");
    const praes = tplParam(body, "Präsens_ich");
    if (praet) verb.praeteritum = `ich ${praet}`;
    if (part) verb.perfekt = `ich ${aux.startsWith("sein") ? "bin" : "habe"} ${part}`;
    verb.separable = (/trennbar/.test(heading) && !/untrennbar/.test(heading)) || / /.test(praes);
    if (verb.separable && praes) verb.separable_example = `ich ${praes}`;
    const firstDef = defLines[0] || "";
    if (/mit Dativ|\+\s*Dat/.test(firstDef)) verb.case = "+ Dativ";
    else if (/mit Akkusativ|\+\s*Akk|\{\{K\|[^}]*\btrans\./.test(firstDef)) verb.case = "+ Akkusativ";
    else if (/intrans\./.test(firstDef)) verb.case = "geçişsiz (nesne almaz)";
  }

  // Örnekler (Almanca, çevirisiz)
  const examples = subSection(body, "Beispiele")
    .filter((l) => /^:\[1/.test(l))
    .map((l) => cleanWiki(l.replace(/^:\[[^\]]*\]/, "")).replace(/^„|“$/g, ""))
    .filter((s) => s && s.length <= 140);

  // Çeviriler
  const transTR = [];
  const transEN = [];
  for (const line of body.split("\n")) {
    const lm = line.match(/^\*\{\{(tr|en)\}\}:(.*)$/);
    if (!lm) continue;
    const words = [...lm[2].matchAll(/\{\{Üt?\|(?:tr|en)\|([^|}]+)/g)].map((x) => x[1].trim());
    if (lm[1] === "tr") transTR.push(...words);
    else if (!transEN.length) transEN.push(...words); // İngilizcede sadece ilk anlamın çevirileri
  }

  // Birleşik kelime
  let compound = [];
  const herkunft = subSection(body, "Herkunft").join(" ");
  if (/kompositum/i.test(herkunft)) {
    // Parçalar italik (''...'') yazılır; italik aralıklardaki ilk bağlantıyı al
    const parts = [...herkunft.replace(/'''/g, "").matchAll(/''(.*?)''/g)]
      .map((x) => x[1].match(/\[\[([^\]|]+)(?:\|([^\]]*))?\]\]/))
      .filter(Boolean)
      .map((x) => (x[2] || x[1]).trim());
    const out = [];
    for (const p of parts) {
      if (p.startsWith("-") && out.length) out[out.length - 1] += ` (+${p.slice(1)})`;
      else if (!p.startsWith("-")) out.push(p);
    }
    if (out.length > 1) compound = out;
  }

  return {
    lemma: title,
    word_type: type,
    article,
    plural,
    ipa,
    verb,
    definitions,
    examples,
    translations_tr: uniq(transTR),
    translations_en: uniq(transEN),
    compound_parts: compound,
  };
}

/** Bir sayfa metninden Almanca girdiyi çıkarır; çekimli biçimse kök sayfasına yönlendirir. */
function analyzeGermanPage(text, title) {
  const section = germanSection(text);
  if (!section) return null;
  const blocks = wortartBlocks(section);
  if (!blocks.length) return null;
  const main = blocks.find((b) => !FORM_TYPES.has(b.wortart));
  if (main) return { entry: parseGermanBlock(main, title) };

  // Sadece çekimli biçim: kök hâline git
  const base =
    (section.match(/\{\{Grundformverweis[^|}]*\|([^|}]+)/) || [])[1] ||
    (section.match(/'''\[\[([^\]|]+)/) || [])[1];
  const merkmal = cleanWiki((section.match(/\{\{Grammatische Merkmale\}\}\s*\n\*([^\n]+)/) || [])[1] || "");
  const ipa = (section.match(/\{\{Lautschrift\|([^}|]+)/) || [])[1] || "";
  return { redirectTo: base?.trim() || null, merkmal: merkmal.replace(/\s+(des|der|von)\s+\S+.*$/, ""), formIpa: ipa };
}

async function fetchGerman(word) {
  const variants = uniq([word, word.toLowerCase(), cap(word.toLowerCase()), cap(word)]);
  const pages = await wikiPages(DE, variants);
  for (const p of pages) {
    if (!p.text) continue;
    const a = analyzeGermanPage(p.text, p.title);
    if (!a) continue;
    if (a.entry) return { entry: a.entry, note: "" };
    if (a.redirectTo) {
      const [lp] = await wikiPages(DE, [a.redirectTo]);
      const la = lp?.text && analyzeGermanPage(lp.text, lp.title);
      if (la?.entry) {
        const note = `"${p.title}", ${la.entry.lemma} kelimesinin çekimli hâli${a.merkmal ? ` (${a.merkmal})` : ""}.`;
        return { entry: la.entry, note };
      }
    }
  }
  return null;
}

// ---------- tr.wiktionary: Almanca kelimelerin Türkçe anlamı ----------

const TR_POS = /^(Ad|Eylem|Sıfat|Zarf|Edat|Bağlaç|Zamir|Ünlem|Özel ad|Sayı|Deyim|Atasözü|Ön ek|Son ek|Artikel|Tanımlık)$/;

function parseTrGerman(text) {
  const m = text?.match(/^==\s*Almanca\s*==[ \t]*$/m);
  if (!m) return null;
  const rest = text.slice(m.index + m[0].length);
  const next = rest.search(/^==[^=]/m);
  const sec = next >= 0 ? rest.slice(0, next) : rest;

  const defs = [];
  const examples = [];
  let collecting = false;
  let inExamples = false;
  for (const line of sec.split("\n")) {
    const h = line.match(/^(=+)\s*([^=]+?)\s*=+\s*$/);
    if (h) {
      const name = h[2];
      collecting = TR_POS.test(name);
      inExamples = /Örnek/.test(name);
      continue;
    }
    if (/^#\*/.test(line)) {
      const [de, tr] = line.replace(/^#\*\s*/, "").split(/\s+[–—-]\s+/);
      if (de && tr) examples.push({ de: cleanWiki(de), tr: cleanWiki(tr) });
    } else if (/^#(?![*:#])/.test(line) && inExamples) {
      const ex = line.replace(/^#\s*/, "").match(/^(.*?)\s*\((.+)\)\s*\.?$/);
      if (ex) examples.push({ de: cleanWiki(ex[1]), tr: cleanWiki(ex[2]) });
    } else if (/^#(?![*:#])/.test(line) && collecting) {
      const d = cleanWiki(line.replace(/^#\s*/, ""));
      // İlk anlam her zaman; sonrakiler sadece kısaysa
      if (d && (!defs.length || d.length <= 60)) defs.push(d.length > 90 ? `${d.slice(0, 87)}…` : d);
    }
  }
  return { defs, examples: examples.filter((e) => e.de && e.tr) };
}

async function fetchTurkishMeaning(lemma) {
  try {
    const pages = await wikiPages(TR, uniq([lemma, cap(lemma), lemma.toLowerCase()]));
    for (const p of pages) {
      const r = p.text && parseTrGerman(p.text);
      if (r && (r.defs.length || r.examples.length)) return r;
    }
  } catch { /* isteğe bağlı kaynak */ }
  return { defs: [], examples: [] };
}

// ---------- Ters yön: Türkçe / İngilizce → Almanca ----------

async function reverseLookup(word) {
  const lower = word.toLowerCase();
  // Türkçe
  try {
    const pages = await wikiPages(TR, uniq([lower, word]));
    for (const p of pages) {
      const line = p.text?.match(/^\*\s*Almanca:\s*(.*)$/m);
      const cands = line ? [...line[1].matchAll(/\{\{ç\|de\|([^|}]+)/g)].map((x) => x[1].trim()) : [];
      if (cands.length) return { lang: "tr", candidates: uniq(cands) };
    }
  } catch { /* devam */ }
  // İngilizce
  try {
    // Büyük çeviri tabloları "kelime/translations" alt sayfasındadır; önce ona bak.
    const pages = await wikiPages(EN, uniq([`${lower}/translations`, lower, word]));
    for (const p of pages) {
      const line = p.text?.match(/^\*\s*German:\s*(.*)$/m);
      const cands = line ? [...line[1].matchAll(/\{\{tt?\+?\|de\|([^|}]+)/g)].map((x) => x[1].trim()) : [];
      if (cands.length) return { lang: "en", candidates: uniq(cands) };
    }
  } catch { /* devam */ }
  return null;
}

// ---------- Tatoeba: örnek cümleler ----------

async function tatoebaExample(lemma, alsoMatch = []) {
  const forms = uniq([lemma, ...alsoMatch]).map((f) => f.toLowerCase());
  for (const lang of ["tur", "eng"]) {
    try {
      const url = new URL("https://api.tatoeba.org/unstable/sentences");
      url.searchParams.set("lang", "deu");
      url.searchParams.set("q", `=${lemma}`);
      url.searchParams.set("trans:lang", lang);
      url.searchParams.set("sort", "words");
      url.searchParams.set("limit", "30");
      const d = await getJSON(url);
      const rows = (d.data || [])
        .map((r) => ({ id: r.id, de: r.text, tr: r.translations?.find((t) => t.lang === lang)?.text }))
        .filter((r) => r.tr && r.de.split(/\s+/).length >= 3 && r.de.length <= 100);
      if (!rows.length) continue;
      const withForm = rows.find((r) => forms.some((f) => r.de.toLowerCase().includes(f)));
      const pick = withForm || rows[0];
      return { ...pick, lang: lang === "tur" ? "tr" : "en", url: `https://tatoeba.org/de/sentences/show/${pick.id}` };
    } catch { /* isteğe bağlı kaynak */ }
  }
  return null;
}

// ---------- Birleşik kelime tahmini (sözlükte olmayanlar için) ----------

async function guessCompound(word) {
  const W = cap(word);
  // Sadece büyük harfle yazılmış (isim) uzun kelimeler
  if (word !== W || W.length < 7 || !/^\p{L}+$/u.test(W)) return null;
  const suffixes = [];
  for (let i = 2; i <= W.length - 3; i++) suffixes.push(cap(W.slice(i)));
  // 1) Sözlükte olan son parçaları (isim) bul — uzundan kısaya
  const pages = await wikiPages(DE, suffixes);
  const heads = [];
  for (const p of pages) {
    const a = p.text && analyzeGermanPage(p.text, p.title);
    if (a?.entry?.word_type === "isim") {
      const prefix = W.slice(0, W.length - p.requested.length);
      const stripped = prefix.replace(/(es|en|er|s|n|e)$/, "");
      heads.push({ head: a.entry, prefix, variants: uniq([prefix, stripped, prefix.toLowerCase(), stripped.toLowerCase()]) });
    }
  }
  if (!heads.length) return null;

  // 2) Tüm ön parça adaylarını tek istekte sorgula
  const prefixPages = await wikiPages(DE, heads.flatMap((h) => h.variants));
  const entryOf = new Map();
  for (const pp of prefixPages) {
    const pa = pp.text && analyzeGermanPage(pp.text, pp.title);
    if (pa?.entry) entryOf.set(pp.requested, pa.entry);
  }

  // 3) Ön parçası da isim olan bölmeyi tercih et (Krankenhaus + Besuch), yoksa herhangi bir kayıt, yoksa ilki
  const pickFor = (h) => h.variants.map((v) => entryOf.get(v)).find(Boolean) || null;
  const choice =
    heads.find((h) => pickFor(h)?.word_type === "isim") ||
    heads.find((h) => pickFor(h)) ||
    heads[0];
  const prefixEntry = pickFor(choice);
  const prefixParts = prefixEntry?.compound_parts?.length ? prefixEntry.compound_parts : [prefixEntry?.lemma || choice.prefix];
  return { head: choice.head, prefix: choice.prefix, prefixEntry, parts: [...prefixParts, choice.head.lemma] };
}

function firstMeaning(entry) {
  return entry?.translations_tr?.[0] || entry?.translations_en?.[0] || "";
}

// ---------- Ana fonksiyon ----------

export async function freeLookup(rawWord, direction = "auto") {
  const word = String(rawWord || "").trim().replace(/^[„“"'(]+|[.,;:!?"“”')]+$/g, "");
  if (!word) throw new LookupError("EMPTY", "Kelime bulunamadı.");

  let detected = "de";
  let found = null;
  let reverseNote = "";

  if (direction !== "tr-de") found = await fetchGerman(word);

  if (!found && direction !== "de-tr") {
    const rev = await reverseLookup(word);
    if (rev) {
      for (const cand of rev.candidates.slice(0, 3)) {
        found = await fetchGerman(cand);
        if (found) {
          detected = rev.lang;
          const others = rev.candidates.filter((c) => c !== found.entry.lemma).slice(0, 3);
          reverseNote = `"${word}" kelimesinin Almancası${others.length ? ` (diğer karşılıklar: ${others.join(", ")})` : ""}.`;
          break;
        }
      }
    }
  }

  // Sözlükte yoksa: birleşik kelime tahmini
  if (!found && direction !== "tr-de") {
    const comp = await guessCompound(word);
    if (comp) {
      const { head, prefix, prefixEntry, parts } = comp;
      const headPl = head.plural.startsWith("die ") ? head.plural.slice(4) : "";
      const lemma = cap(word);
      const ex = await tatoebaExample(lemma);
      const partMeanings = [
        `${prefixEntry?.lemma || prefix}${firstMeaning(prefixEntry) ? ` (${firstMeaning(prefixEntry)})` : ""}`,
        `${head.lemma}${firstMeaning(head) ? ` (${firstMeaning(head)})` : ""}`,
      ];
      return {
        found: true,
        detected_language: "de",
        lemma,
        word_type: "isim",
        article: head.article,
        plural: headPl ? `die ${prefix}${headPl.toLowerCase()}` : "",
        ipa: "",
        meaning_tr: partMeanings.join(" + "),
        meaning_en: "",
        definition_de: "",
        level: "",
        verb: { praeteritum: "", perfekt: "", separable: false, separable_example: "", case: "" },
        compound_parts: parts,
        example_de: ex?.de || "",
        example_tr: ex?.tr || "",
        example_lang: ex?.lang || "",
        example_url: ex?.url || "",
        note: "Sözlükte ayrı kaydı yok; anlam parçalarından tahmin edildi. Artikel son parçadan gelir.",
        source: "Wiktionary · Tatoeba",
      };
    }
  }

  if (!found) return { found: false };

  const e = found.entry;
  const [trw, ex] = await Promise.all([fetchTurkishMeaning(e.lemma), tatoebaExample(e.lemma, [word])]);

  const meaningTR = trw.defs.length ? trw.defs.slice(0, 3).join("; ") : e.translations_tr.slice(0, 5).join(", ");
  let example = ex;
  if (!example || example.lang !== "tr") {
    const trEx = trw.examples[0];
    if (trEx) example = { de: trEx.de, tr: trEx.tr, lang: "tr", url: "" };
  }
  if (!example && e.examples[0]) example = { de: e.examples[0], tr: "", lang: "", url: "" };

  return {
    found: true,
    detected_language: detected,
    lemma: e.lemma,
    word_type: e.word_type,
    article: e.article,
    plural: e.plural,
    ipa: e.ipa,
    meaning_tr: meaningTR,
    meaning_en: e.translations_en.slice(0, 5).join(", "),
    definition_de: e.definitions[0] || "",
    level: "",
    verb: e.verb,
    compound_parts: e.compound_parts,
    example_de: example?.de || "",
    example_tr: example?.tr || "",
    example_lang: example?.lang || "",
    example_url: example?.url || "",
    note: reverseNote || found.note,
    source: "Wiktionary · Tatoeba",
  };
}
