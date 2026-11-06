# Almanca Kelime Asistanı

A Chrome extension for learning German while you read. Right-click any word on a web page to see its
base form, article, plural, pronunciation, meaning and a translated example sentence.

Supports **German–English** and **German–Turkish**, with a fully localized interface.
Works out of the box with free, open data sources. No account or API key required.

## Features

- **Base forms:** inflected words are reduced to their dictionary form (`ging` → `gehen`, `Häuser` → `das Haus`)
- **Articles:** color-coded (*der* blue, *die* red, *das* green) and shown with the plural
- **Pronunciation:** IPA, plus audio for the word and the example sentence via the browser's speech synthesis
- **Verb forms:** Präteritum and Perfekt, and separable verbs (`anrufen` → `ich rufe an`)
- **Compounds:** split into their parts (`Krankenhausbesuch` → `Krankenhaus + Besuch`)
- **Example sentences:** real, human-written sentences with translations
- **Both directions:** look up German words, or find the German for English and Turkish words
- **Word list:** save words together with the sentence and page where you found them, then export to CSV for Anki

## Installation

1. Clone the repository or download it as a ZIP:
   ```
   git clone https://github.com/<username>/almanca-kelime-asistani.git
   ```
2. Open `chrome://extensions` and enable **Developer mode**.
3. Click **Load unpacked** and select the project folder.

The extension also runs in other Chromium-based browsers such as Edge and Brave.

## Usage

- Right-click a word and choose **Look up in German**. To look up a phrase, select it first.
- The interface follows your browser language (English or Turkish) and can be changed in the options.
- Press `Esc` or click outside the card to close it.
- Click the toolbar icon to open your word list.
- Open the extension's options to choose the language pair, the dictionary source and the lookup direction.

## Data sources

| Source | Used for | License |
| --- | --- | --- |
| [Wiktionary](https://www.wiktionary.org) (de, en, tr) | Grammar, pronunciation, meanings, translations | CC BY-SA 4.0 |
| [Tatoeba](https://tatoeba.org) | Translated example sentences | CC BY 2.0 FR |

The extension does not bundle any dictionary data. All data is fetched from these public APIs at lookup
time, and each result shows where it came from.

As an optional alternative, the [Claude API](https://platform.claude.com) can be selected as the dictionary
source in the settings. This mode adds approximate CEFR level labels. It requires your own API key and is billed
to your account.

## Privacy

- Only the word you look up is sent to the selected dictionary source. In Claude mode, the surrounding sentence is sent too.
- Saved words, settings and the lookup cache are kept in your browser (`chrome.storage.local`).
- An API key, if you set one, is stored locally and sent only to `api.anthropic.com`.
- The extension contains no analytics or tracking.

## Development

The project has no build step or dependencies. After changing code, reload the extension on
`chrome://extensions` and refresh any open tabs.

| File | Purpose |
| --- | --- |
| `background.js` | Service worker: context menu, lookups, cache, word list |
| `sources.js` | Wiktionary and Tatoeba client; runs in Node.js 18+ for testing |
| `content.js` | Finds the word under the cursor and renders the card |
| `i18n.js` | Interface strings (English, Turkish) |
| `options.*`, `words.*` | Settings page and word list |

Contributions are welcome. Please open an issue to discuss larger changes before submitting a pull request.

## License

Released under the [MIT License](LICENSE). Dictionary data retrieved at runtime remains subject to the
licenses of its sources.
