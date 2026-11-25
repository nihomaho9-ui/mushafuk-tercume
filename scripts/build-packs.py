#!/usr/bin/env python3
"""Build gzip translation packs and index.json for mushafuk.online/app-data/v1/.
Snapshots bengali_zakaria, indonesian_complex and chinese_makin from QuranEnc."""
from __future__ import annotations
import gzip, hashlib, json, os, time, urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

ROOT = Path("/workspace/mushafuk-online-site/tr")
OUT = Path("/workspace/tercume-release/app-data/v1")
OUT.mkdir(parents=True, exist_ok=True)
API = "https://quranenc.com/api/v1/"
UA = "MushafukTercume/1.0 (pack-builder; personal dawah app)"

# lang, id, name, native lang name, dir, source_kind, ver, src_label
CATALOG = [
    ("az", "az.musayev", "Əlixan Musayev", "Azərbaycanca", "ltr", "tanzil", "tanzil", "Tanzil.net"),
    ("ru", "ru.kuliev", "Эльмир Кулиев", "Русский", "ltr", "tanzil", "tanzil", "Tanzil.net"),
    ("tr", "turkish_shahin", "Ali Özek ve diğerleri", "Türkçe", "ltr", "local", "1.0.0", "QuranEnc.com — Dr. Ali Ozek and others (v1.0.0)"),
    ("en", "english_saheeh", "Saheeh International", "English", "ltr", "local", "1.1.2", "QuranEnc.com — Noor International Center (v1.1.2)"),
    ("uz", "uzbek_mansour", "Алоуддин Мансур", "Oʻzbekcha", "ltr", "local", "1.0.0", "QuranEnc.com — Alaauddin Mansour (v1.0.0)"),
    ("tg", "tajik_arifi", "Маркази тарҷумаи Равод", "Тоҷикӣ", "ltr", "local", "1.0.2", "QuranEnc.com — Rowwad Translation Center (v1.0.2)"),
    ("ky", "kyrgyz_hakimov", "Шамсуддин Хакимов", "Кыргызча", "ltr", "local", "1.0.2", "QuranEnc.com — Shamsuddin Hakimov (v1.0.2)"),
    ("ug", "uyghur_saleh", "مۇھەممەد سالىھ", "ئۇيغۇرچە", "rtl", "local", "1.0.2", "QuranEnc.com — Muhammad Saleh (v1.0.2)"),
    ("ps", "pashto_rwwad", "د رواد د ژباړې مرکز", "پښتو", "rtl", "local", "1.0.1", "QuranEnc.com — Rowwad Translation Center (v1.0.1)"),
    ("ku", "kurdish_bamoki", "محمد صالح بامۆکی", "Kurdî", "rtl", "local", "1.1.1", "QuranEnc.com — Muhammad Salih Bamoki (v1.1.1)"),
    ("hi", "hindi_omari", "अज़ीज़ुल-हक़ उमरी", "हिन्दी", "ltr", "local", "1.1.5", "QuranEnc.com — Azizul Haq Al-Omari (v1.1.5)"),
    ("ta", "tamil_omar", "உமர் ஷரீஃப்", "தமிழ்", "ltr", "local", "1.0.4", "QuranEnc.com — Shaykh Omar Sharif (v1.0.4)"),
    ("fr", "french_rashid", "Rachid Maach", "Français", "ltr", "local", "1.0.3", "QuranEnc.com — Rashid Ma’ash (v1.0.3)"),
    ("de", "german_bubenheim", "Frank Bubenheim, Nadeem Elyas", "Deutsch", "ltr", "local", "1.1.4", "QuranEnc.com — Bubenheim & Elyas (v1.1.4)"),
    ("nl", "dutch_center", "Rowwad Vertaalcentrum", "Nederlands", "ltr", "local", "2.0.10", "QuranEnc.com — Rowwad Vertaalcentrum (v2.0.10)"),
    ("es", "spanish_garcia", "Isa García", "Español", "ltr", "local", "1.0.2", "QuranEnc.com — Muhammad Isa Garcia (v1.0.2)"),
    ("pt", "portuguese_nasr", "Helmi Nasr", "Português", "ltr", "local", "1.4.1", "QuranEnc.com — Dr. Helmi Nasr (v1.4.1)"),
    ("ha", "hausa_gummi", "Abubakar Mahmoud Gumi", "Hausa", "ltr", "local", "1.2.2", "QuranEnc.com — Abu Bakr Mahmoud Jumi (v1.2.2)"),
    ("so", "somali_yacob", "Cabdullaahi Xasan Yacquub", "Soomaali", "ltr", "local", "1.0.26", "QuranEnc.com — Abdullah Hasan Yaqoub (v1.0.26)"),
    ("ja", "japanese_saeedsato", "サイード佐藤", "日本語", "ltr", "local", "1.0.13", "QuranEnc.com — Saeed Sato (v1.0.13)"),
    ("ur", "urdu_junagarhi", "محمد جوناگڑھی", "اردو", "rtl", "local", "1.1.3", "QuranEnc.com — Muhammad Junagarhi (v1.1.3)"),
    ("fa", "persian_ih", "مرکز ترجمه رواد", "فارسی", "rtl", "local", "1.1.3", "QuranEnc.com — Rowwad Translation Center (v1.1.3)"),
    ("id", "indonesian_complex", "Kementerian Agama / The Complex", "Bahasa Indonesia", "ltr", "fetch", "1.0.1", "QuranEnc.com — Indonesian Translation — The Complex (v1.0.1); King Fahd Complex edition of the Indonesian Ministry of Religious Affairs text"),
    ("bn", "bengali_zakaria", "আবু বকর মুহাম্মাদ যাকারিয়া", "বাংলা", "ltr", "fetch", "1.1.1", "QuranEnc.com — Dr. Abu Bakr Muhammad Zakaria (v1.1.1); King Fahd Complex print, 1436 AH"),
    ("zh", "chinese_makin", "穆罕默德·马坚 / Muhammad Makin", "中文", "ltr", "fetch", "1.0.2", "QuranEnc.com — Muhammad Makeen / Sheikh Muhammad Makin (v1.0.2); King Fahd Complex edition"),
]

def get(url):
    last = None
    for i in range(6):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.load(r)
        except Exception as e:
            last = e
            time.sleep(2 + i * 3)
    raise last

def pack_from_tanzil(ident):
    data = json.load(open(ROOT / f"{ident}.json"))
    v = data["v"]
    assert len(v) == 114, ident
    return {"id": ident, "v": v}

def pack_from_local_suras(ident):
    d = ROOT / ident
    v, f = [], []
    has_f = False
    for s in range(1, 115):
        obj = json.load(open(d / f"{s}.json"))
        t = obj["t"]
        fn = obj.get("f") or []
        v.append(t)
        if any(fn):
            has_f = True
            # pad
            while len(fn) < len(t):
                fn.append("")
            f.append(fn)
        else:
            f.append([""] * len(t))
    out = {"id": ident, "v": v}
    if has_f:
        out["f"] = f
    return out

def pack_from_quranenc(ident):
    v, f = [], []
    has_f = False
    def one(s):
        rs = get(f"{API}translation/sura/{ident}/{s}")["result"]
        rs.sort(key=lambda r: int(r["aya"]))
        t = [r.get("translation") or "" for r in rs]
        fn = [r.get("footnotes") or "" for r in rs]
        return s, t, fn
    with ThreadPoolExecutor(8) as ex:
        done = {fut: fut for fut in [ex.submit(one, s) for s in range(1, 115)]}
        results = {}
        for fut in as_completed(done):
            s, t, fn = fut.result()
            results[s] = (t, fn)
    for s in range(1, 115):
        t, fn = results[s]
        v.append(t)
        if any(fn):
            has_f = True
        f.append(fn)
    out = {"id": ident, "v": v}
    if has_f:
        out["f"] = f
    # ayah count check
    n = sum(len(x) for x in v)
    print(f"  fetched {ident}: {n} ayahs, footnotes={has_f}")
    if n != 6236:
        raise SystemExit(f"{ident} ayah count {n} != 6236")
    return out

def write_gz(ident, obj):
    raw = json.dumps(obj, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    gz = gzip.compress(raw, compresslevel=9)
    path = OUT / f"{ident}.json.gz"
    path.write_bytes(gz)
    sha = hashlib.sha256(gz).hexdigest()
    return path, len(raw), len(gz), sha

def main():
    index = {
        "version": 1,
        "base": "https://mushafuk.online/app-data/v1/",
        "note": "Gzip packs for Mushafuk Tərcümə. Translations are not bundled in the APK. Arabic Uthmani text is bundled (Tanzil, CC BY 3.0, unaltered).",
        "translations": [],
    }
    for lang, ident, name, lname, direction, kind, ver, src in CATALOG:
        print(f"== {ident} ({kind})")
        if kind == "tanzil":
            obj = pack_from_tanzil(ident)
        elif kind == "local":
            obj = pack_from_local_suras(ident)
        else:
            obj = pack_from_quranenc(ident)
        obj["lang"] = lang
        obj["name"] = name
        obj["src"] = src
        obj["ver"] = ver
        path, raw_n, gz_n, sha = write_gz(ident, obj)
        print(f"  wrote {path.name} raw={raw_n} gz={gz_n} sha256={sha[:16]}…")
        index["translations"].append({
            "id": ident,
            "lang": lang,
            "lname": lname,
            "name": name,
            "dir": direction,
            "src": src,
            "ver": ver,
            "file": f"{ident}.json.gz",
            "bytes": gz_n,
            "raw_bytes": raw_n,
            "sha256": sha,
        })
    (OUT / "index.json").write_text(json.dumps(index, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("index written", OUT / "index.json")
    print("total gz", sum(t["bytes"] for t in index["translations"]))

if __name__ == "__main__":
    main()
