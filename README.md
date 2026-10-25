<a id="top"></a>

# paperless-pdf

A fully client-side, privacy-first PDF toolkit.

[![CI](https://github.com/IACBI/paperless-pdf/actions/workflows/ci.yml/badge.svg)](https://github.com/IACBI/paperless-pdf/actions/workflows/ci.yml) [![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE) [![Live demo](https://img.shields.io/badge/live%20demo-iacbi.github.io-0f766e.svg)](https://iacbi.github.io/paperless-pdf/)

**Read this in:** [English](#english) · [Türkçe](#turkce)

---

<a id="english"></a>

## English

### Overview

paperless-pdf merges, splits, compresses, converts, rotates and OCRs PDFs in your browser.
Every operation runs on your device with JavaScript and WebAssembly. There is no server to
upload to, and the app includes no analytics.

Try the live version at **[iacbi.github.io/paperless-pdf](https://iacbi.github.io/paperless-pdf/)**.

#### Privacy

No file ever leaves your device. PDFs, page images and extracted text are processed in
memory, and the result comes back to you as a local download. In practice:

- Nothing sends your files, page images or text over the network.
- There are no analytics, telemetry or third-party SDKs.
- The PDF engines (pdf-lib, pdf.js) and the OCR engine (tesseract.js) run in the browser.
  The OCR WebAssembly core and language data are served from the app's own origin, so OCR
  works offline and makes no third-party requests.
- The production build sends a strict Content Security Policy: `connect-src 'self'`,
  `script-src 'self' 'wasm-unsafe-eval'` and `object-src 'none'`. Scripts, workers and data
  load only from the app's own origin.
- Size limits protect your device from huge or hostile files. Inputs over 200 MB or 1,000
  pages are refused. A merge session is capped at 500 MB and 2,000 pages in total. Images
  over 50 MB or 40 million pixels are refused, and so is any page too large to render. Each
  tool shows a message instead of freezing the tab.

Built with React, Vite, TypeScript, Tailwind CSS, pdf-lib, pdf.js, tesseract.js and dnd-kit.

[⬆ Back to top](#top)

---

### Features

| Tool             | What it does                                                                                                                                  |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| **Merge**        | Combine several PDFs. Drag pages to reorder them, or delete individual pages.                                                                 |
| **Split**        | Extract page ranges such as `1-3, 5, 8-` into one PDF, or into a ZIP of separate files.                                                       |
| **Compress**     | Shrink a file by re-rendering its pages as images, with DPI and quality controls. Pages become images, so their text is no longer selectable. |
| **Images → PDF** | Turn JPG and PNG images into one PDF. Drag to set the order, and choose fit-to-image, A4 or Letter layout.                                    |
| **PDF → PNG**    | Export pages as PNG at the resolution you choose, as one file or a ZIP.                                                                       |
| **Rotate**       | Rotate any or all pages in 90° steps, with page thumbnails that update as you rotate.                                                         |
| **OCR**          | Add an invisible, searchable text layer to scanned pages. Runs on your device and works offline.                                              |

paperless-pdf is a Progressive Web App. After the first load, a service worker caches the app,
the OCR engine and the language data, so every tool works offline. You can install it from
the browser's install prompt.

[⬆ Back to top](#top)

---

### Requirements

- Node.js 20 or newer, and npm. CI and the deploy workflow run on Node 20; the project is
  developed on Node 24.
- A modern browser with WebAssembly and Web Worker support.

[⬆ Back to top](#top)

---

### Installation

```bash
git clone https://github.com/IACBI/paperless-pdf.git
cd paperless-pdf
npm install      # also vendors the OCR assets (postinstall)
npm run dev      # http://localhost:5173
```

`npm install` runs a postinstall script. It copies the OCR worker and WebAssembly core from
`node_modules` into `public/`, and downloads the English language data. The download is
checked against a pinned SHA-256 digest. If it fails on your machine, the install still
completes with a warning, and OCR stays unavailable until you run `npm run vendor:ocr`. In CI
the same failure fails the job.

The vendored files in `public/tesseract/` and `public/tessdata/` are git-ignored.

[⬆ Back to top](#top)

---

### Usage

| Command              | What it does                                           |
| -------------------- | ------------------------------------------------------ |
| `npm run dev`        | Start the Vite dev server                              |
| `npm run build`      | Type-check and build to `dist/`                        |
| `npm run preview`    | Serve the production build locally                     |
| `npm test`           | Run unit tests (Vitest)                                |
| `npm run test:e2e`   | Build, serve and run the end-to-end tests (Playwright) |
| `npm run lint`       | Lint with ESLint                                       |
| `npm run format`     | Format the repository with Prettier                    |
| `npm run vendor:ocr` | Re-vendor the OCR assets                               |

#### Deploying to GitHub Pages

The app uses a relative base (`base: './'`) and `HashRouter`, so it works under a project
subpath such as `https://iacbi.github.io/paperless-pdf/` without extra configuration.

1. Push the repository to GitHub with `main` as the default branch.
2. In **Settings → Pages**, set **Source** to **GitHub Actions**.
3. Push to `main`. The [deploy workflow](./.github/workflows/deploy.yml) runs `npm ci`,
   `npm test` and `npm run build`, then publishes `dist/`.

To host elsewhere, run `npm run build` and serve the `dist/` folder from any static host.

[⬆ Back to top](#top)

---

### Configuration

Only English OCR is included by default. To add a language:

1. Add its Tesseract code to `LANGS` in
   [`scripts/vendor-tesseract.mjs`](./scripts/vendor-tesseract.mjs), and pin the SHA-256
   digest of its `.traineddata.gz` in `TESSDATA_SHA256`. The script refuses to download a
   language that has no pinned digest. Verify the digest against the upstream tessdata_fast
   release before you pin it.
2. Run `npm run vendor:ocr`.
3. Add the language to `OCR_LANGUAGES` in [`src/lib/ocrLanguages.ts`](./src/lib/ocrLanguages.ts)
   so the UI offers it.

The language model is downloaded once, to your machine. Your documents are never uploaded.

[⬆ Back to top](#top)

---

### Contributing

Issues and pull requests are welcome. Before you open a pull request, run `npm run lint` and
`npm test`. If you change PDF processing or the UI, also run `npm run test:e2e`. The first
end-to-end run needs `npx playwright install chromium`.

Keep the privacy invariant intact: no feature may send user data off the device. A change to
the Content Security Policy in `index.html` deserves the same scrutiny. The dev server removes
that policy so React Refresh can run; the production build keeps it.

Project layout:

- `src/lib/`: framework-free PDF logic, with unit tests next to it
- `src/tools/`: the tool registry and one folder per tool
- `src/components/`: shared UI components
- `src/pages/`: the home page and routed pages
- `tests/e2e/`: Playwright tests

To report a security issue, follow [SECURITY.md](./SECURITY.md). Do not open a public issue.

[⬆ Back to top](#top)

---

### License

[MIT](./LICENSE) © 𝓐.𝓒.𝓑

[⬆ Back to top](#top)

---

<a id="turkce"></a>

## Türkçe

### Genel Bakış

paperless-pdf, PDF'leri tarayıcınızda birleştirmenize, bölmenize, sıkıştırmanıza,
dönüştürmenize, döndürmenize ve OCR ile aranabilir hale getirmenize yarar. Her işlem
cihazınızda, JavaScript ve WebAssembly ile çalışır. Dosyalarınızı yükleyeceğiniz bir sunucu
yoktur ve uygulamada analitik bulunmaz.

Canlı sürümü **[iacbi.github.io/paperless-pdf](https://iacbi.github.io/paperless-pdf/)**
adresinden deneyebilirsiniz.

#### Gizlilik

Hiçbir dosya cihazınızdan dışarı çıkmaz. PDF'leriniz, sayfa görüntüleriniz ve çıkarılan metin
bellekte işlenir; sonuç yerel bir indirme olarak size geri gelir. Pratikte bu şu anlama gelir:

- Dosyalarınızı, sayfa görüntülerinizi veya metninizi taşıyan hiçbir ağ isteği yapılmaz.
- Analitik, telemetri veya üçüncü taraf SDK'sı yoktur.
- PDF motorları (pdf-lib, pdf.js) ve OCR motoru (tesseract.js) tarayıcıda çalışır. OCR'ın
  WebAssembly çekirdeği ve dil verisi uygulamanın kendi kaynağından sunulur; bu yüzden OCR
  çevrimdışı çalışır ve üçüncü taraf isteği yapmaz.
- Üretim derlemesi sıkı bir İçerik Güvenlik Politikası (CSP) ile gelir: `connect-src 'self'`,
  `script-src 'self' 'wasm-unsafe-eval'` ve `object-src 'none'`. Betikler, worker'lar ve veriler
  yalnızca uygulamanın kendi kaynağından yüklenebilir.
- Boyut sınırları, çok büyük veya kötü niyetli dosyalara karşı cihazınızı korur. 200 MB'ı ya da
  1.000 sayfayı aşan dosyalar reddedilir. Birleştirme oturumu toplamda 500 MB ve 2.000 sayfa
  ile sınırlıdır. 50 MB'ı ya da 40 milyon pikseli aşan görseller ve çizilemeyecek kadar büyük
  sayfalar reddedilir. Sekmenin donması yerine her araç sizi bilgilendiren bir mesaj gösterir.

Proje React, Vite, TypeScript, Tailwind CSS, pdf-lib, pdf.js, tesseract.js ve dnd-kit ile
geliştirildi.

[⬆ Başa Dön](#top)

---

### Özellikler

| Araç             | Ne yapar                                                                                                                                                         |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Birleştir**    | Birden çok PDF'i birleştirir. Sayfaları sürükleyerek yeniden sıralayabilir veya tek tek silebilirsiniz.                                                          |
| **Böl**          | `1-3, 5, 8-` gibi sayfa aralıklarını tek bir PDF'e ya da ayrı dosyalardan oluşan bir ZIP'e çıkarır.                                                              |
| **Sıkıştır**     | Sayfaları görüntü olarak yeniden işleyerek dosya boyutunu küçültür. DPI ve kaliteyi ayarlayabilirsiniz. Sayfalar görüntüye dönüştüğü için metin artık seçilemez. |
| **Görsel → PDF** | JPG ve PNG görsellerini tek bir PDF'e çevirir. Sürükleyerek sırayı belirleyin, görseli sayfaya sığdırın ya da A4 veya Letter düzenini seçin.                     |
| **PDF → PNG**    | Sayfaları seçtiğiniz çözünürlükte PNG olarak dışa aktarır; tek dosya ya da ZIP olarak.                                                                           |
| **Döndür**       | Sayfaların tamamını ya da bir kısmını 90°'lik adımlarla döndürür. Sayfa küçük resimleri döndürdükçe güncellenir.                                                 |
| **OCR**          | Taranmış sayfalara görünmez, aranabilir bir metin katmanı ekler. Cihazınızda çalışır ve çevrimdışı kullanılabilir.                                               |

paperless-pdf bir Progressive Web App (PWA) olarak da çalışır. İlk açılıştan sonra bir service
worker uygulamayı, OCR motorunu ve dil verisini önbelleğe alır; böylece tüm araçlar çevrimdışı
çalışır. Tarayıcının kurulum isteminden uygulamayı ana ekranınıza veya masaüstünüze ekleyebilirsiniz.

[⬆ Başa Dön](#top)

---

### Gereksinimler

- Node.js 20 veya üzeri ve npm. CI ve dağıtım iş akışı Node 20 ile çalışır; proje Node 24
  üzerinde geliştirildi.
- WebAssembly ve Web Worker desteği olan güncel bir tarayıcı.

[⬆ Başa Dön](#top)

---

### Kurulum

```bash
git clone https://github.com/IACBI/paperless-pdf.git
cd paperless-pdf
npm install      # OCR varlıklarını da hazırlar (postinstall)
npm run dev      # http://localhost:5173
```

`npm install` bir postinstall betiği çalıştırır. Bu betik OCR worker'ını ve WebAssembly
çekirdeğini `node_modules` içinden `public/` klasörüne kopyalar ve İngilizce dil verisini
indirir. İndirilen dosya sabitlenmiş bir SHA-256 özetiyle doğrulanır. Yerelde indirme
başarısız olursa kurulum uyarıyla tamamlanır, ancak `npm run vendor:ocr` komutunu çalıştırana
kadar OCR kullanılamaz. CI'da aynı hata derlemeyi başarısız kılar.

`public/tesseract/` ve `public/tessdata/` içindeki hazırlanan dosyalar git tarafından
yoksayılır.

[⬆ Başa Dön](#top)

---

### Kullanım

| Komut                | Ne yapar                                                    |
| -------------------- | ----------------------------------------------------------- |
| `npm run dev`        | Vite geliştirme sunucusunu başlatır                         |
| `npm run build`      | Tip kontrolü yapar ve `dist/` klasörüne derler              |
| `npm run preview`    | Üretim derlemesini yerelde sunar                            |
| `npm test`           | Birim testlerini çalıştırır (Vitest)                        |
| `npm run test:e2e`   | Derler, sunar ve uçtan uca testleri çalıştırır (Playwright) |
| `npm run lint`       | ESLint ile denetler                                         |
| `npm run format`     | Depoyu Prettier ile biçimlendirir                           |
| `npm run vendor:ocr` | OCR varlıklarını yeniden hazırlar                           |

#### GitHub Pages'e dağıtım

Uygulama göreli bir taban (`base: './'`) ve `HashRouter` kullanır. Bu sayede
`https://iacbi.github.io/paperless-pdf/` gibi bir alt yolda ek bir ayar gerekmeden çalışır.

1. Depoyu varsayılan dalı `main` olacak şekilde GitHub'a gönderin.
2. **Settings → Pages** bölümünde **Source** olarak **GitHub Actions** seçin.
3. `main` dalına push yapın. [Dağıtım iş akışı](./.github/workflows/deploy.yml) `npm ci`,
   `npm test` ve `npm run build` komutlarını çalıştırır, ardından `dist/` klasörünü yayınlar.

Başka bir barındırma servisi kullanacaksanız `npm run build` ile üretilen `dist/` klasörünü
herhangi bir statik sunucuda yayınlamanız yeterlidir.

[⬆ Başa Dön](#top)

---

### Yapılandırma

Varsayılan olarak yalnızca İngilizce OCR dili bulunur. Yeni bir dil eklemek için:

1. Tesseract dil kodunu [`scripts/vendor-tesseract.mjs`](./scripts/vendor-tesseract.mjs)
   içindeki `LANGS` listesine, `.traineddata.gz` dosyasının SHA-256 özetini ise
   `TESSDATA_SHA256` tablosuna ekleyin. Betik, özeti sabitlenmemiş bir dili indirmez. Özeti
   sabitlemeden önce upstream tessdata_fast sürümüyle karşılaştırın.
2. `npm run vendor:ocr` komutunu çalıştırın.
3. Dilin arayüzde görünmesi için [`src/lib/ocrLanguages.ts`](./src/lib/ocrLanguages.ts) içindeki
   `OCR_LANGUAGES` listesine ekleyin.

Dil modeli yalnızca bir kez, derleme yaptığınız makineye indirilir. Belgeleriniz hiçbir zaman
yüklenmez.

[⬆ Başa Dön](#top)

---

### Katkı

Hata bildirimleri ve pull request'ler memnuniyetle karşılanır. Pull request açmadan önce
`npm run lint` ve `npm test` komutlarını çalıştırın. PDF işleme veya arayüzde değişiklik
yaptıysanız `npm run test:e2e` komutunu da çalıştırın. İlk uçtan uca test çalıştırmasından önce
`npx playwright install chromium` gerekir.

Gizlilik ilkesini koruyun: hiçbir özellik kullanıcı verisini cihazın dışına göndermemelidir.
`index.html` içindeki CSP değişiklikleri de aynı titizlikle incelenmelidir. Geliştirme sunucusu,
React Refresh çalışabilsin diye bu politikayı kaldırır; üretim derlemesi ise politikayı korur.

Proje yapısı:

- `src/lib/`: çerçeveden bağımsız PDF mantığı; birim testleri yanında yer alır
- `src/tools/`: araç kayıt defteri ve her araç için bir klasör
- `src/components/`: ortak arayüz bileşenleri
- `src/pages/`: ana sayfa ve yönlendirilen sayfalar
- `tests/e2e/`: Playwright testleri

Bir güvenlik açığı bildirmek istiyorsanız [SECURITY.md](./SECURITY.md) dosyasındaki yönergeleri
izleyin. Herkese açık bir issue açmayın.

[⬆ Başa Dön](#top)

---

### Lisans

[MIT](./LICENSE) © 𝓐.𝓒.𝓑

[⬆ Başa Dön](#top)
