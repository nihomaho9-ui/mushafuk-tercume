# Mushafuk Tərcümə

Android app (`com.nibras.tercume`) for reading the Quran with translations in 25 languages, in the format of [t.mushafuk.online](https://t.mushafuk.online). Mushafuk itself is unchanged.

- Capacitor 7. Translations are **not** bundled. On first launch the user picks a language; only that pack is downloaded and cached for offline use. More languages can be added, switched or deleted in Settings.
- Arabic Uthmani text is bundled (Tanzil, CC BY 3.0, unaltered).
- Packs are hosted at `https://mushafuk.online/app-data/v1/`.
- Recitation streams from EveryAyah (internet required for audio).
- Colours are Nibras blue/green only.

## Build

Signing properties stay outside the repo (`TERCUME_SIGNING_PROPS`).

```bash
npm install
npx cap sync android
export TERCUME_SIGNING_PROPS=/path/to/signing.properties
bash scripts/build-release.sh
```

## Licence

App shell © 2026 Mahir Aliyev / Mushafuk / Nibras. All rights reserved.

Quran text, translations, tafsirs, recitations and fonts remain under their authors' and publishers' rights. See the in-app Sources screen and `https://mushafuk.online/sources.html`.
