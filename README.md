# Almanca Kelime Asistanı

Web sayfalarında okuduğunuz Almanca kelimeleri, sayfadan ayrılmadan öğrenmenizi sağlayan bir Chrome eklentisi.
Bir kelimeye sağ tıklayıp **Almancasını göster** seçeneğini seçtiğinizde, kelimenin yanında açılan kartta
anlamı, artikeli, çoğulu, okunuşu ve örnek bir cümle gösterilir.

Eklenti varsayılan olarak tamamen ücretsiz ve açık kaynaklardan (Wiktionary, Tatoeba) beslenir;
API anahtarı veya hesap gerektirmez.

*A Chrome extension for Turkish speakers learning German: right-click any word to see its lemma, article,
plural, pronunciation, Turkish meaning and an example sentence. Powered by Wiktionary and Tatoeba.*

## Özellikler

**Kelime kartı**

- Kök hâli bulma: çekimli kelimeler sözlük biçimine indirilir (`ging` → `gehen`, `Häuser` → `das Haus`, `schöneren` → `schön`)
- Artikel renklendirme: *der* mavi, *die* kırmızı, *das* yeşil; çoğul hâli ile birlikte
- IPA okunuşu ve tarayıcının yerleşik ses sentezi ile kelimeyi ve örnek cümleyi dinleme
- Fiil bilgisi: Präteritum, Perfekt (yardımcı fiil ile), ayrılabilen fiiller (`anrufen` → `ich rufe an`)
- Birleşik kelime parçalama (`Krankenhausbesuch` → `Krankenhaus + Besuch`); sözlükte bulunmayan birleşik kelimelerde artikel ve anlam parçalardan tahmin edilir
- Türkçe çevirili, gerçek kişilerce yazılmış örnek cümleler

**Çeviri yönü**

- Otomatik algılama: Almanca bir kelime için Türkçe anlam, Türkçe veya İngilizce bir kelime için Almanca karşılık gösterilir
- Ayarlardan tek bir yöne sabitlenebilir

**Kelime defteri**

- Tek tıkla kaydetme; kelimenin görüldüğü cümle ve sayfa da saklanır
- Arama, silme ve Anki'ye aktarmaya uygun CSV dışa aktarma

## Kurulum

Eklenti henüz Chrome Web Store'da yayımlanmadığı için geliştirici modunda yüklenir.

1. Depoyu klonlayın veya ZIP olarak indirip bir klasöre açın:
   ```
   git clone https://github.com/<kullanici-adi>/almanca-kelime-asistani.git
   ```
2. Chrome'da `chrome://extensions` adresini açın.
3. Sağ üstteki **Geliştirici modu** anahtarını etkinleştirin.
4. **Paketlenmemiş öğe yükle** düğmesine tıklayın ve proje klasörünü seçin.

Kurulumdan önce açık olan sekmelerin yenilenmesi önerilir. Eklenti Chromium tabanlı diğer tarayıcılarda
(Edge, Brave, Opera) da aynı şekilde çalışır.

## Kullanım

- Herhangi bir kelimenin üzerine gelip sağ tıklayın ve **Almancasını göster** seçeneğini seçin. Kelimeyi önceden seçmek gerekmez.
- Birden fazla kelimelik bir ifade için ifadeyi seçip sağ tıklayın.
- Kartı kapatmak için `Esc` tuşuna basın veya kartın dışına tıklayın.
- Eklenti simgesine tıklayarak kelime defterini açabilirsiniz.
- Ayarlar için eklenti simgesine sağ tıklayıp **Seçenekler**'i seçin.

## Veri kaynakları

| Kaynak | Kullanım | Lisans |
| --- | --- | --- |
| [de.wiktionary.org](https://de.wiktionary.org) | Artikel, çoğul, IPA, fiil çekimleri, kök hâli, birleşik kelime bilgisi | CC BY-SA 4.0 |
| [tr.wiktionary.org](https://tr.wiktionary.org) | Almanca kelimelerin Türkçe anlamları, Türkçe kelimelerin Almanca karşılıkları | CC BY-SA 4.0 |
| [en.wiktionary.org](https://en.wiktionary.org) | İngilizce kelimelerin Almanca karşılıkları | CC BY-SA 4.0 |
| [Tatoeba](https://tatoeba.org) | Türkçe (bulunamazsa İngilizce) çevirili örnek cümleler | CC BY 2.0 FR |

Veriler eklentiyle birlikte dağıtılmaz; her arama sırasında ilgili kaynağın herkese açık API'sinden alınır.
Kartta her sonucun kaynağı belirtilir ve Tatoeba cümleleri orijinal sayfalarına bağlanır.

### İsteğe bağlı: Claude API

Ayarlardan sözlük kaynağı olarak Claude API seçilebilir. Bu modda anlam, artikel, çekim, örnek cümle ve
yaklaşık CEFR seviyesi tek istekte bir dil modelinden alınır. Kendi [Anthropic API anahtarınızı](https://platform.claude.com/settings/keys)
girmeniz gerekir ve kullanım hesabınızdan ücretlendirilir.

## Gizlilik

- Eklenti, yalnızca sağ tıkladığınız kelimeyi ve (Claude modunda) geçtiği cümleyi seçili sözlük kaynağına gönderir. Sayfa içeriğinin geri kalanı hiçbir yere gönderilmez.
- Kelime defteri, ayarlar ve arama önbelleği yalnızca tarayıcınızda (`chrome.storage.local`) tutulur.
- Claude API anahtarı yalnızca yerel olarak saklanır ve sadece `api.anthropic.com` adresine gönderilir; sayfalarda çalışan betikler anahtara erişemez.
- Eklenti analitik veya izleme kodu içermez.

## Proje yapısı

```
manifest.json    Manifest V3 tanımı
background.js    Service worker: sağ tık menüsü, kaynak seçimi, Claude API isteği, önbellek, kelime defteri
sources.js       Ücretsiz sözlük: Wiktionary (de/tr/en) wikitext ayrıştırma ve Tatoeba örnek cümleleri
content.js       Sayfada çalışan betik: imlecin altındaki kelimeyi bulma, Shadow DOM içinde kart, seslendirme
options.html/js  Ayarlar sayfası
words.html/js    Kelime defteri ve CSV dışa aktarma
pages.css        Ayarlar ve kelime defteri sayfalarının ortak stilleri
icons/           Eklenti simgeleri
```

Proje herhangi bir derleme adımı veya bağımlılık gerektirmez; dosyalar doğrudan tarayıcıda çalışır.

## Geliştirme

1. Kodda değişiklik yaptıktan sonra `chrome://extensions` sayfasında eklentinin yenileme düğmesine tıklayın.
2. İçerik betiğinde (`content.js`) yapılan değişikliklerin etkili olması için açık sekmeleri yenileyin.
3. Service worker kayıtlarını görmek için eklenti kartındaki **service worker** bağlantısına tıklayın.

`sources.js` tarayıcıdan bağımsızdır ve Node.js 18+ ile doğrudan test edilebilir:

```js
// test.mjs
import { freeLookup } from "./sources.js";
console.log(await freeLookup("Häuser"));
```

Wikimedia sunucuları kısa sürede çok sayıda istek gönderen istemcileri geçici olarak sınırlar (HTTP 429).
Toplu testlerde istekler arasına bekleme eklenmesi önerilir.

## Yol haritası

- Aralıklı tekrar (SRS) ile kayıtlı kelimeleri çalışma
- Kayıtlı kelimelerin diğer sayfalarda vurgulanması
- Günlük kısa kelime testi
- Klavye kısayolu ve fareyle üzerine gelince açılan mod
- YouTube ve Netflix altyazılarında kelimeye tıklayarak arama
- Açık lisanslı bir kelime listesiyle CEFR seviye etiketi

## Katkıda bulunma

Hata bildirimleri ve öneriler için bir issue açabilir, değişiklikler için pull request gönderebilirsiniz.
Büyük değişikliklerden önce bir issue üzerinden tartışılması önerilir.

## Lisans

Bu proje [MIT Lisansı](LICENSE) ile lisanslanmıştır. Eklentinin çalışma sırasında aldığı sözlük verileri
kendi kaynaklarının lisanslarına tabidir (bkz. [Veri kaynakları](#veri-kaynakları)).
