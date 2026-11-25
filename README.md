# Quran Tərcümə

Android app (`com.nibras.tercume`) for reading the Quran with a translation in each supported language, in the format of [t.mushafuk.online](https://t.mushafuk.online). The separate Mushafuk mushaf app is unchanged.

**Repo:** [github.com/nihomaho9-ui/mushafuk-tercume](https://github.com/nihomaho9-ui/mushafuk-tercume)

Launcher and in-app name follow the phone or selected language (default Azerbaijani: «Quran Tərcümə»). Package name stays `com.nibras.tercume`.

---

## Qısa status (Mahir üçün)

Bu, **1.0.1** işinin mənbə kodudur. **1.0.0** artıq bu reponun `main` tarlindədir.

Hazır olanlar (kodda var, mağazaya hələ yüklənməyib):

- Ad: Quran Tərcümə, **24 dildə** (Portuqal çıxarılıb)
- Mahirin loqosu: ikonda Quran + rəhal, dillər cədvəli yoxdur; tam şəkil mağaza bannerində
- Ayarlar: Tərcümələr və yazı ölçüsü ayrı səhifələrdə; ölçü dəyişəndə nümunə ayə canlı görünür
- Oxunuş zamanı qari dəyişmək (pleyer düyməsi, oxunuş dayanmır)
- Məxfilik siyasəti tətbiqin içində; sayt üçün mətn `mushafuk-online-site` reposunda `tercume/privacy.html`
- Ayarlarda və mənbələrdə mushafuk.online keçidi
- Planşetdə en: kartlar tam enə yaxın
- `index.json` vasitəsilə dilin default tərcüməsini dəyişmək asandır
- İlk açılışda kataloq yüklənənə qədər olan çöküş düzəldilib

**Kataloq artıq tətbiq olunub (24 dil):** Sabiq, Al-Mukhtasar, Xəvacə Mirof (Khoja Mirov Khoja Mir), Sərfəraz (Maulawi Janbaz Sarfaraz), Süleyman (Muhammad Suleiman); Portuqal yoxdur. Hər yeni paket 6236 ayədir, QuranEnc-dən dəyişdirilmədən.

**Hələ edilməyib:**

1. Yeni paketləri və yenilənmiş `index.json`-u `mushafuk.online/app-data/v1/` ünvanına yükləmək (köhnə `.json.gz` faylları silinmir). Mənbə: `nihomaho9-ui/mushafuk-online-site` / `app-data/v1/`.
2. Saytın tərcümə səhifələri (t.mushafuk.online siyahıları) və sonra Mushafuk *mushaf* tətbiqi — Mahir bunları da istədi. Bu, başqa repodadır, bu app-ə daxil deyil.
3. Yeni siyahı ilə imzalı 1.0.1 APK/AAB yığmaq (əgər bu commit-də hələ yoxdursa).
4. **Huawei AppGallery və Google Play yükləməsi HOLD-dadır** — təsdiq gələnə qədər yükləmə.
5. Mağaza bannerindəki tam loqoda hələ «25» yazısı var (Mahirin orijinal şəkli). İkon kəsimində rəqəm yoxdur.

Keystore və şifrələr bu repoda **yoxdur** və heç vaxt commit olunmamalıdır.

---

## Current status / TODO

Version on this branch: **1.0.1** (`versionCode` 2). A 1.0.0 signed build was already released as a GitHub test APK; 1.0.1 has not been submitted to any store.

### Done in the working tree (this commit)

- App name «Quran Tərcümə» with localized launcher labels (`android/app/src/main/res/values-XX/strings.xml`) and in-app UI strings (`www/js/i18n.js`). Indonesian uses both `values-in` and `values-id`; Chinese uses `values-zh` and `values-zh-rCN`. Default `values/` is Azerbaijani.
- Mahir’s logo: launcher / adaptive / 512 icon is the Quran on the rehal on teal `#155F65`, **without** the language panel. The full image (with the 25-language panel) is in `docs/store-assets/` for Play feature graphic and AppGallery banners. Original file: `docs/logo/logo-source.jpg` (do not overwrite).
- Settings is a tidy list of buttons. Translations and font size each open a separate page. Font size has a live ayah preview.
- While audio plays, a player bar shows the reciter; tap to switch reciter without stopping the current ayah. Choice is remembered. Audio is from EveryAyah (seven reciters).
- In-app privacy policy (selected language) and a mushafuk.online link in Settings and Sources.
- Almost full-width layout (no 40rem cap); 10px padding on phones, 16px on tablets.
- Live catalog is `https://mushafuk.online/app-data/v1/index.json`. Bundled fallback is `www/data/catalog.json`. A `defaults` map (lang → pack id) plus `default: true` on the chosen entry makes a language’s default easy to swap without an app rebuild. The app prefers the live index; if the live file has no `defaults`, it falls back to the bundled map, then to the first pack for that language.
- First-launch crash fixed: `applyUiDir()` no longer reads `catalog.translations` before the catalog is loaded.

### TODO before store upload

1. ~~Apply Mahir’s approved **app** catalog (24 languages).~~ **Done in this tree.** See [Approved 1.0.1 catalog](#approved-101-catalog). Fetch unaltered from QuranEnc, update credits and versions, verify **6236** ayahs per pack.
2. Add the new gzip packs under `mushafuk.online/app-data/v1/`, update `index.json` and the bundled `catalog.json`. **Leave old pack files on the server**; only drop them from the index.
3. Site reader pages (t.mushafuk.online): Mahir asked for the same catalog changes on the site first, then in the Mushafuk *mushaf* app. That work lives in `nihomaho9-ui/mushafuk-online-site`, not here. Do not delete site files; only change lists.
4. Drop Portuguese from the picker, `i18n.js`, `values-pt`, store titles, and every “25 languages” string (become 24). Rebuild icons/store copy if wording is baked into a graphic — the **launcher** crop has no language count; the full logo panel still says “25” and may need a new image from Mahir later.
5. Rebuild the signed 1.0.1 APK and AAB after the catalog change (an earlier 1.0.1 binary was built before the swaps).
6. Store upload (AppGallery + Play, for review) stays **on hold** until upload is confirmed. Mahir signs into the consoles himself.
7. Site reader lists (t.mushafuk.online) and the Mushafuk mushaf app are a separate follow-up in `mushafuk-online-site` / the Mushafuk app repo.

Privacy HTML for stores: add-only page at `https://mushafuk.online/tercume/privacy.html` (source in the site repo, `tercume/privacy.html`). Confirm it is live before store submission.

---

## Approved 1.0.1 catalog

Applied in `www/data/catalog.json` and the site `app-data/v1/index.json` (old pack *files* are kept on the server, only dropped from the index):

| Lang | Remove from index (keep the file) | Use instead | Display name |
|------|-----------------------------------|-------------|--------------|
| id   | `indonesian_complex`              | `indonesian_sabiq`    | Sabiq (QuranEnc) |
| ug   | `uyghur_saleh`                    | `uyghur_mokhtasar`    | Al-Mukhtasar (this is a tafsir) |
| tg   | `tajik_arifi`                     | `tajik_khawaja`       | Xəvacə Mirof / Khawaja |
| ps   | `pashto_rwwad`                    | `pashto_sarfaraz`     | Sərfəraz / Sarfaraz |
| zh   | `chinese_makin`                   | `chinese_suliman`     | Süleyman / Suliman |
| pt   | `portuguese_nasr`                 | —                     | **Remove Portuguese from the app** |

After this, the app has **24** languages. Set `defaults` in `index.json` to the new ids. Do not rewrite ayah text.

---

## Requirements

| Tool | Version used here |
|------|-------------------|
| Node.js | 20+ (built with 24.22.1) |
| npm | comes with Node |
| Capacitor | **7.6.10** (`@capacitor/android`, `cli`, `core`; `@capacitor/network` 7.0.4) |
| JDK | **21** (Temurin 21.0.13+9). JDK 17 fails (`invalid source release: 21`). |
| Android SDK | `ANDROID_HOME` set; platform / build-tools for compileSdk **36** |
| Gradle | Wrapper **8.11.1** (`android/gradle/wrapper`) |
| Android Gradle Plugin | **8.7.2** |
| minSdk / targetSdk | 24 / 36 |
| Python 3 | only for `scripts/build-packs.py` |

Permissions: `INTERNET`, `ACCESS_NETWORK_STATE` only (plus the AndroidX notification receiver permission the support library adds).

`CapacitorHttp` is enabled in `capacitor.config.json` so `fetch()` uses native HTTP (avoids CORS when talking to mushafuk.online).

---

## How to build

```bash
git clone https://github.com/nihomaho9-ui/mushafuk-tercume.git
cd mushafuk-tercume
npm ci    # or: npm install

# After changing www/ or capacitor.config.json:
npx cap sync android
```

**Important:** `npx cap sync android` can overwrite `android/app/src/main/res/values/strings.xml` with the name from `capacitor.config.json`. Re-check that file (and the `values-XX/` locales — they are usually left alone, but restore them from git if needed):

```bash
git checkout -- android/app/src/main/res/values/strings.xml
git status android/app/src/main/res/
```

### Debug APK (no signing file required)

```bash
export JAVA_HOME=/path/to/jdk-21
export ANDROID_HOME=/path/to/android-sdk
cd android
./gradlew :app:assembleDebug
# output: android/app/build/outputs/apk/debug/
```

### Signed release APK + AAB

The keystore and passwords are **outside this repository**. Never commit `*.jks`, `*.keystore`, `signing.properties`, or `credentials.txt`.

Create a properties file anywhere outside the repo, for example:

```properties
storeFile=/absolute/path/to/MushafukTercume.jks
storePassword=...
keyAlias=upload
keyPassword=...
```

On the machine that already built 1.0.0 / 1.0.1, that file is pointed to by `TERCUME_SIGNING_PROPS` (directory: `…/nibras-signing-keys/MushafukTercume_com.nibras.tercume/`). Use the **same** keystore as 1.0.0. Cert SHA-256:

`19:62:21:8D:04:04:04:AD:7A:45:E0:ED:23:05:CF:7E:7F:C8:9D:5B:32:FB:71:F7:67:19:9A:46:5A:8C:1E:29`

```bash
export JAVA_HOME=/path/to/jdk-21
export ANDROID_HOME=/path/to/android-sdk
export TERCUME_SIGNING_PROPS=/absolute/path/to/signing.properties
bash scripts/build-release.sh
```

The script passes `-PversionCode=2 -PversionName=1.0.1` (also set in `android/gradle.properties`). Bump both when you cut a new store build. Outputs:

- `android/app/build/outputs/apk/release/`
- `android/app/build/outputs/bundle/release/`

APK/AAB files are gitignored.

Web-only smoke test (no Android): serve `www/` and open it in Chrome:

```bash
python3 -m http.server 8767 --directory www
# http://127.0.0.1:8767/index.html
```

---

## Language packs and `index.json`

Translations are **not** inside the APK. Only Arabic Uthmani is bundled (`www/data/quran-uthmani.json`, Tanzil, CC BY 3.0, unaltered).

### Live files

| URL | Role |
|-----|------|
| https://mushafuk.online/app-data/v1/index.json | Live catalog (the app fetches this on launch, `cache: no-store`) |
| https://mushafuk.online/app-data/v1/{id}.json.gz | One gzip pack per translation |
| `www/data/catalog.json` | Bundled copy of the catalog, used if the network is down |

Source of the hosted files: repo `nihomaho9-ui/mushafuk-online-site`, folder `app-data/v1/`. That site is deployed to mushafuk.online. **Add-only for pack files:** add new `{id}.json.gz`, update `index.json`; do not delete old packs unless there is an explicit yes.

### Catalog shape

```json
{
  "version": 1,
  "base": "https://mushafuk.online/app-data/v1/",
  "note": "…",
  "defaults": {
    "az": "az.musayev",
    "id": "indonesian_complex"
  },
  "translations": [
    {
      "id": "az.musayev",
      "lang": "az",
      "lname": "Azərbaycanca",
      "name": "Əlixan Musayev",
      "dir": "ltr",
      "src": "Tanzil.net",
      "ver": "tanzil",
      "file": "az.musayev.json.gz",
      "bytes": 0,
      "raw_bytes": 0,
      "sha256": "…",
      "default": true
    }
  ]
}
```

`defaults[lang]` is the pack the picker prefers for that language. To swap a default: upload the new `{id}.json.gz`, append its entry to `translations`, set `defaults[lang]` to the new id, set `default: true` on the new entry and `default: false` (or omit it) on the old one. You may leave the old pack in the list (user can still download it) or drop it from the list while keeping the file on disk. The running app picks this up from the live index without a store update. Users who already downloaded the old pack keep it until they switch.

Pack JSON inside the gzip:

```json
{ "id": "…", "v": [ [ "ayah 1 of sura 1", "…" ], [ "…sura 2" ] ], "f": [ [ "optional footnote", "" ] ] }
```

`v` has 114 sura arrays; total ayahs must be **6236**. `f` is optional (same shape), used when QuranEnc provides footnotes. Do not strip or edit footnotes (QuranEnc terms).

### How to regenerate packs

`scripts/build-packs.py` snapshots from:

- local Tanzil JSON under the site repo (`tr/az.musayev.json`, `tr/ru.kuliev.json`) for Azerbaijani and Russian;
- per-sura JSON already on the site (`tr/{id}/{1..114}.json`) for translations that were copied from QuranEnc earlier;
- QuranEnc API `https://quranenc.com/api/v1/translation/sura/{id}/{sura}` for editions fetched live (`kind: fetch`).

Edit the `CATALOG` list at the top of the script, then:

```bash
# Optional: point ROOT/OUT at your checkouts (see the script).
python3 scripts/build-packs.py
```

It writes gzip files and `index.json` to `/workspace/tercume-release/app-data/v1/` by default — change `OUT` if needed. It already asserts 6236 ayahs for API fetches. After a build, copy **new** `*.json.gz` plus the updated `index.json` into `mushafuk-online-site/app-data/v1/` and also refresh `www/data/catalog.json` in this repo. Do not delete old gz files on the site.

For a single new edition you can also fetch 114 suras from QuranEnc, build the `{id,v,f?}` object, gzip with compresslevel 9, SHA-256 the gzip bytes, and add the index entry (`bytes` = gzip size, `raw_bytes` = uncompressed UTF-8 length, `sha256` of the gzip).

Update in-app credits (`name`, `src`, `ver`) from QuranEnc’s own metadata. Localized sura names live in `www/data/surah-names.json` (not in the packs).

### UI languages vs packs

`www/js/i18n.js` holds UI strings. The UI language follows the **active translation’s** `lang` (RTL for `ur`, `fa`, `ug`, `ps`, `ku`). If you drop Portuguese from the catalog, also remove `pt` from `i18n.js`, `values-pt/`, `docs/listing-titles.json`, and any “25” copy.

Store titles (Play 30-character limit) are in `docs/listing-titles.json`.

---

## Project layout

```
www/                  # Capacitor web app (this is the UI)
  index.html
  css/app.css
  js/app.js           # picker, downloads, reader, settings, player
  js/i18n.js
  data/catalog.json   # bundled catalog fallback
  data/quran-uthmani.json
  data/surah-names.json
  data/surahs.json
  data/pages.json
  icons/
android/              # native project (Capacitor 7)
scripts/build-packs.py
scripts/build-release.sh
docs/logo/logo-source.jpg          # Mahir’s original 1280×1280, do not edit
docs/store-assets/                 # Play / AppGallery graphics
docs/listing-titles.json
```

Web colours are Nibras blue/green only (no rainbow palette). Contact: nibrascode@gmail.com.

---

## Licence

App shell © 2026 Mahir Aliyev / Mushafuk / Nibras. All rights reserved. See `LICENSE`.

Quran text, translations, tafsirs, recitations and fonts remain under their authors’ and publishers’ rights. See the in-app Sources screen and https://mushafuk.online/sources.html.
