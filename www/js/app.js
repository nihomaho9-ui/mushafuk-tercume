/* Quran Tərcümə — Capacitor reader. Translations are downloaded, not bundled. */
(function () {
  "use strict";

  const BASE_FALLBACK = "https://mushafuk.online/app-data/v1/";
  const SITE_URL = "https://mushafuk.online";
  const BISMILLAH = "بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ";
  const RTL_LANGS = (window.I18N_RTL || ["ur", "fa", "ug", "ps", "ku", "ar"]);
  const RECITERS = [
    { id: "maher", name: "Maher Al Muaiqly", ea: "MaherAlMuaiqly128kbps" },
    { id: "husary", name: "Husary", ea: "Husary_128kbps" },
    { id: "qatami", name: "Nasser Al Qatami", ea: "Nasser_Alqatami_128kbps" },
    { id: "dosari", name: "Yasser Al Dosari", ea: "Yasser_Ad-Dussary_128kbps" },
    { id: "ayyub", name: "Muhammad Ayyub", ea: "Muhammad_Ayyoub_128kbps" },
    { id: "jibreel", name: "Muhammad Jibreel", ea: "Muhammad_Jibreel_128kbps" },
    { id: "shuraim", name: "Saud Ash-Shuraim", ea: "Saood_ash-Shuraym_128kbps" }
  ];

  const $ = (id) => document.getElementById(id);
  const state = {
    ui: "en",
    catalog: null,
    uthmani: null,
    pages: null,
    surahs: null,
    surahNames: null,
    db: null,
    activeId: null,
    pack: null,
    screen: "home",
    page: 1,
    font: 1,
    reciter: "maher",
    bookmarks: [],
    audio: null,
    playS: null,
    playA: null,
    paused: false
  };

  const t = (k) => (I18N[state.ui] && I18N[state.ui][k]) || I18N.en[k] || k;
  const toast = (msg) => {
    const el = $("toast");
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toast._tm);
    toast._tm = setTimeout(() => el.classList.remove("show"), 1800);
  };
  const fmtSize = (n) => (n >= 1048576 ? (n / 1048576).toFixed(2) + " MB" : Math.round(n / 1024) + " KB");
  const p3 = (n) => String(n).padStart(3, "0");
  const ayahCount = (s) => (state.uthmani[s - 1] || []).length;

  function lsGet(k, d) {
    try {
      const v = localStorage.getItem("mt." + k);
      return v == null ? d : JSON.parse(v);
    } catch (e) {
      return d;
    }
  }
  function lsSet(k, v) {
    localStorage.setItem("mt." + k, JSON.stringify(v));
  }
  // Reader/preview text sizes are calc(<base>rem * var(--fs)) in app.css, so one
  // root variable scales the Arabic, translation, translator line and footnotes.
  function applyFontScale(v) {
    let n = Number(v);
    if (!isFinite(n) || n <= 0) n = 1;
    n = Math.max(0.8, Math.min(1.8, n));
    state.font = n;
    document.documentElement.style.setProperty("--fs", String(n));
    return n;
  }

  function idbOpen() {
    return new Promise((resolve, reject) => {
      const r = indexedDB.open("mushafuk-tercume", 1);
      r.onupgradeneeded = () => r.result.createObjectStore("packs");
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  }
  function idbReq(fn) {
    return new Promise((resolve, reject) => {
      const tx = state.db.transaction("packs", "readwrite");
      const st = tx.objectStore("packs");
      const req = fn(st);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  const idbGet = (id) => idbReq((s) => s.get(id));
  const idbPut = (id, v) => idbReq((s) => s.put(v, id));
  const idbDel = (id) => idbReq((s) => s.delete(id));
  const idbKeys = () => idbReq((s) => s.getAllKeys());

  async function sha256Hex(buf) {
    const hash = await crypto.subtle.digest("SHA-256", buf);
    return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  function gunzipJson(buf) {
    const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    const out = fflate.gunzipSync(u8);
    return JSON.parse(new TextDecoder("utf-8").decode(out));
  }

  async function fetchBuf(url, onProg) {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    if (!res.body || !res.body.getReader) return await res.arrayBuffer();
    const total = +res.headers.get("content-length") || 0;
    const reader = res.body.getReader();
    const chunks = [];
    let rec = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      rec += value.length;
      if (onProg) onProg(rec, total);
    }
    const out = new Uint8Array(rec);
    let o = 0;
    for (const c of chunks) {
      out.set(c, o);
      o += c.length;
    }
    return out.buffer;
  }

  async function loadCatalog() {
    const bundled = await (await fetch("data/catalog.json")).json();
    state.catalog = bundled;
    try {
      const live = await (await fetch(bundled.base + "index.json", { cache: "no-store" })).json();
      if (live && Array.isArray(live.translations) && live.translations.length) {
        const bundledDefaults = bundled.defaults;
        state.catalog = live;
        if (!state.catalog.base) state.catalog.base = bundled.base;
        if (!state.catalog.defaults && bundledDefaults) state.catalog.defaults = bundledDefaults;
      }
    } catch (e) {}
  }

  function detectUi() {
    const lang = (navigator.language || "en").slice(0, 2).toLowerCase();
    if (I18N[lang]) return lang;
    return "en";
  }
  function detectLangId() {
    const code = (navigator.language || "").slice(0, 2).toLowerCase();
    return defaultIdForLang(code);
  }
  function setUiLang(lang) {
    if (lang && I18N[lang]) state.ui = lang;
    else if (lang && !I18N[lang]) state.ui = "en";
    lsSet("ui", state.ui);
    applyUiDir();
  }
  function applyUiDir() {
    const meta = metaOf(state.activeId);
    const rtl = (meta && meta.dir === "rtl") || RTL_LANGS.indexOf(state.ui) >= 0;
    document.documentElement.lang = state.ui;
    document.documentElement.dir = rtl ? "rtl" : "ltr";
    document.title = t("app");
  }

  function setTop(title, showBack, showHome) {
    $("title").innerHTML = title;
    $("btnBack").classList.toggle("hidden", !showBack);
    $("btnHome").classList.toggle("hidden", !showHome);
    $("btnSettings").classList.toggle("hidden", state.screen === "picker");
  }

  function openExternal(url) {
    try {
      if (window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.Browser) {
        Capacitor.Plugins.Browser.open({ url: url });
        return;
      }
    } catch (e) {}
    const a = document.createElement("a");
    a.href = url;
    a.target = "_system";
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    try {
      window.open(url, "_system");
    } catch (e2) {
      window.open(url, "_blank");
    }
  }

  function renderPicker(opts) {
    state.screen = "picker";
    hideChrome();
    setTop(t("app"), false, false);
    const prefer = (opts && opts.prefer) || detectLangId();
    const rows = translations()
      .map((tr) => {
        const sel = tr.id === prefer ? " active" : "";
        return `<button type="button" class="lang${sel}" data-id="${tr.id}">
          <span class="flag">${tr.lang.toUpperCase()}</span>
          <span class="who"><b>${esc(tr.lname)}</b><small>${esc(tr.name)}</small></span>
          <span class="sz">${fmtSize(tr.bytes)}</span>
        </button>`;
      })
      .join("");
    $("screen").innerHTML = `<div class="wrap">
      <div class="lead"><h2 style="margin:0;color:var(--em2)">${t("pickTitle")}</h2><p>${t("pickLead")}</p></div>
      <div id="langList">${rows}</div>
      <div id="pickStatus"></div>
    </div>`;
    $("langList").onclick = (e) => {
      const b = e.target.closest(".lang");
      if (b) startDownload(b.dataset.id, $("pickStatus"), () => showHome());
    };
  }

  async function startDownload(id, statusEl, then) {
    const meta = metaOf(id);
    if (!meta) return;
    if (meta.lang) setUiLang(meta.lang);
    statusEl.innerHTML = `<p class="okmsg">${t("downloading")} ${esc(meta.lname)} — ${fmtSize(meta.bytes)}</p><div class="progress"><i id="bar"></i></div>`;
    const bar = $("bar");
    try {
      const url = (state.catalog.base || BASE_FALLBACK) + meta.file;
      const buf = await fetchBuf(url, (rec, total) => {
        const p = total ? Math.min(100, (rec / total) * 100) : 10;
        if (bar) bar.style.width = p + "%";
      });
      if (bar) bar.style.width = "100%";
      const hex = await sha256Hex(buf);
      if (meta.sha256 && hex !== meta.sha256) throw Object.assign(new Error("checksum"), { code: "checksum" });
      const pack = gunzipJson(buf);
      if (!pack || !Array.isArray(pack.v) || pack.v.length !== 114) throw new Error("bad pack");
      await idbPut(id, pack);
      await setActive(id, pack);
      toast(t("downloaded"));
      if (then) then();
    } catch (err) {
      const msg = err && err.code === "checksum" ? t("checksum") : !navigator.onLine ? t("needNet") : t("err");
      statusEl.innerHTML = `<div class="err">${msg}</div>`;
    }
  }

  function metaOf(id) {
    return translations().find((x) => x.id === id);
  }
  function translations() {
    return (state.catalog && state.catalog.translations) || [];
  }
  function defaultIdForLang(code) {
    const d = (state.catalog && state.catalog.defaults) || {};
    if (code && d[code]) return d[code];
    const marked = translations().find((x) => x.lang === code && x.default);
    if (marked) return marked.id;
    const hit = translations().find((x) => x.lang === code);
    if (hit) return hit.id;
    return d.en || (translations()[0] && translations()[0].id) || "english_saheeh";
  }

  async function setActive(id, pack) {
    state.activeId = id;
    state.pack = pack || (await idbGet(id));
    lsSet("active", id);
    const meta = metaOf(id);
    if (meta && meta.lang) setUiLang(meta.lang);
    else applyUiDir();
  }

  function surahLocal(i) {
    const list = (state.surahNames && (state.surahNames[state.ui] || state.surahNames.en)) || [];
    const n = list[i - 1];
    if (n) return n;
    const s = state.surahs[i - 1];
    return s ? s.tname || s.ename || s.name : String(i);
  }
  function surahName(i) {
    const s = state.surahs[i - 1];
    const loc = surahLocal(i);
    return s ? s.name + " · " + loc : loc;
  }

  function hideChrome() {
    $("pager").classList.add("hidden");
    if (state.playS) showPlayer();
    else hidePlayer();
  }

  function showHome() {
    state.screen = "home";
    hideChrome();
    setTop(t("app"), false, false);
    const last = lsGet("last", null);
    const lastHtml = last
      ? `<button type="button" class="continue" id="btnContinue"><b>${t("continue")}</b><small>${esc(surahName(last.s))} · ${t("page")} ${last.page}</small></button>`
      : "";
    const list = state.surahs
      .map((s) => {
        const typ = s.type === "Meccan" ? t("meccan") : t("medinan");
        return `<button type="button" class="sura-row" data-page="${s.page}" data-s="${s.i}">
          <span class="n">${s.i}</span>
          <span class="names"><div class="ar">${s.name}</div><div class="en">${esc(surahLocal(s.i))} · ${typ}</div></span>
          <span class="ay">${s.ayas} ${t("ayahs")}</span>
        </button>`;
      })
      .join("");
    $("screen").innerHTML = `<div class="wrap">${lastHtml}<h2 style="margin:.2rem 0 .6rem;font-size:1rem;color:var(--em2)">${t("surahs")}</h2><div id="suraList">${list}</div></div>`;
    const c = $("btnContinue");
    if (c) c.onclick = () => showReader(last.page, last.s + ":" + last.a);
    $("suraList").onclick = (e) => {
      const b = e.target.closest(".sura-row");
      if (b) showReader(+b.dataset.page, b.dataset.s + ":1");
    };
  }

  function showReader(page, focusRef) {
    state.screen = "reader";
    $("pager").classList.remove("hidden");
    if (state.playS) showPlayer();
    state.page = Math.max(1, Math.min(604, page || 1));
    $("prevPage").disabled = state.page <= 1;
    $("nextPage").disabled = state.page >= 604;
    $("pageLabel").textContent = t("page") + " " + state.page + " / 604";
    const ayahs = state.pages[state.page - 1] || [];
    const first = ayahs[0] ? ayahs[0].split(":") : ["1", "1"];
    const s0 = +first[0];
    setTop(`<span>${esc(state.surahs[s0 - 1] ? state.surahs[s0 - 1].name : "")}</span><span class="sub">${t("page")} ${state.page}</span>`, true, true);

    const pack = state.pack;
    const meta = metaOf(state.activeId) || {};
    const dirTr = meta.dir === "rtl" ? " rtl" : "";
    let html = `<div class="sr-page">`;
    let lastS = 0;
    for (const ref of ayahs) {
      const [ss, aa] = ref.split(":").map(Number);
      if (ss !== lastS) {
        lastS = ss;
        const su = state.surahs[ss - 1] || { name: "", ename: "", ayas: 0, type: "" };
        const typ = su.type === "Meccan" ? t("meccan") : t("medinan");
        const bism = ss !== 1 && ss !== 9 ? `<div class="sr-bism">${BISMILLAH}</div>` : "";
        html += `<section class="sr-card" data-s="${ss}">
          <div class="sr-arname">${su.name}</div>
          <div class="sr-name">${esc(surahLocal(ss))}</div>
          <div class="sr-meta">${typ} · ${su.ayas} ${t("ayahs")}</div>
          ${bism}
        </section>`;
      }
      const ar = (state.uthmani[ss - 1] && state.uthmani[ss - 1][aa - 1]) || "";
      const trText = (pack.v[ss - 1] && pack.v[ss - 1][aa - 1]) || "";
      const fn = pack.f && pack.f[ss - 1] && pack.f[ss - 1][aa - 1];
      const bmOn = isBookmarked(ss, aa) ? " on" : "";
      const fnBtn = fn ? `<button type="button" data-act="fn" title="${t("footnotes")}">i</button>` : "";
      html += `<article class="sr-ayah" id="a-${ss}-${aa}" data-s="${ss}" data-a="${aa}">
        <div class="sr-abar">
          <span class="sr-anum">${ss}:${aa}</span>
          <button type="button" data-act="bm" class="${bmOn}" aria-label="bookmark">${icon.bm}</button>
          <button type="button" data-act="play" aria-label="play">${icon.play}</button>
          <button type="button" data-act="copy" aria-label="copy">${icon.copy}</button>
          <button type="button" data-act="share" aria-label="share">${icon.share}</button>
          ${fnBtn}
        </div>
        <div class="sr-abody">
          <div class="sr-arabic">${ar}</div>
          <div class="sr-tr${dirTr}">${esc(trText)}</div>
          <div class="sr-who">${esc(meta.name || "")}</div>
          ${fn ? `<div class="sr-fn" hidden>${esc(String(fn).replace(/<[^>]+>/g, ""))}</div>` : ""}
        </div>
      </article>`;
    }
    html += "</div>";
    $("screen").innerHTML = html;
    $("screen").scrollTop = 0;
    lsSet("last", { page: state.page, s: s0, a: +first[1] });
    $("screen").onclick = onAyahClick;
    if (state.playS) {
      const el = $("a-" + state.playS + "-" + state.playA);
      if (el) el.classList.add("playing");
    }
    if (focusRef) {
      const [s, a] = focusRef.split(":");
      const el = $("a-" + s + "-" + a);
      if (el) setTimeout(() => el.scrollIntoView({ block: "center" }), 50);
    }
  }

  const icon = {
    bm: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 4h12v16l-6-3-6 3z"/></svg>',
    play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>',
    copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5h10"/></svg>',
    share: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></svg>',
    book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M4 4.5A2.5 2.5 0 0 1 6.5 7H20v13H6.5A2.5 2.5 0 0 0 4 22.5z"/></svg>',
    type: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 20h16M9 4h6l7 16h-3M5 20L12 4l2 4"/><path d="M8.5 14h7"/></svg>',
    mic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v4"/></svg>',
    shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3l8 4v6c0 5-3.4 7.8-8 9-4.6-1.2-8-4-8-9V7z"/></svg>',
    web: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>'
  };

  function isBookmarked(s, a) {
    return state.bookmarks.some((b) => b.s === s && b.a === a);
  }
  function toggleBm(s, a) {
    const i = state.bookmarks.findIndex((b) => b.s === s && b.a === a);
    if (i >= 0) state.bookmarks.splice(i, 1);
    else state.bookmarks.unshift({ s, a, page: state.page });
    lsSet("bookmarks", state.bookmarks);
  }
  function verseText(s, a) {
    const ar = (state.uthmani[s - 1] && state.uthmani[s - 1][a - 1]) || "";
    const trText = (state.pack.v[s - 1] && state.pack.v[s - 1][a - 1]) || "";
    const who = (metaOf(state.activeId) || {}).name || "";
    return `${s}:${a}\n${ar}\n${trText}\n— ${who}\n${t("app")}`;
  }

  async function onAyahClick(e) {
    const btn = e.target.closest("button[data-act]");
    if (!btn) return;
    const art = btn.closest(".sr-ayah");
    const s = +art.dataset.s,
      a = +art.dataset.a;
    const act = btn.dataset.act;
    if (act === "bm") {
      toggleBm(s, a);
      btn.classList.toggle("on", isBookmarked(s, a));
    } else if (act === "copy") {
      try {
        await navigator.clipboard.writeText(verseText(s, a));
      } catch (err) {}
      toast(t("copied"));
    } else if (act === "share") {
      const text = verseText(s, a);
      try {
        if (navigator.share) await navigator.share({ text });
        else {
          await navigator.clipboard.writeText(text);
          toast(t("copied"));
        }
      } catch (err) {
        if (err && err.name === "AbortError") return;
        try {
          await navigator.clipboard.writeText(text);
        } catch (e2) {}
        toast(t("shareFail"));
      }
    } else if (act === "fn") {
      const fn = art.querySelector(".sr-fn");
      if (fn) fn.hidden = !fn.hidden;
    } else if (act === "play") {
      playAyah(s, a, art);
    }
  }

  function reciterMeta() {
    return RECITERS.find((r) => r.id === state.reciter) || RECITERS[0];
  }
  function showPlayer() {
    const bar = $("playerBar");
    bar.classList.remove("hidden");
    $("btnReciter").textContent = reciterMeta().name;
    if (state.playS) $("playerRef").textContent = state.playS + ":" + state.playA;
    $("iconPause").classList.toggle("hidden", state.paused);
    $("iconPlay").classList.toggle("hidden", !state.paused);
  }
  function hidePlayer() {
    $("playerBar").classList.add("hidden");
    closeSheet();
  }
  function stopAudio() {
    if (state.audio) {
      state.audio.onended = null;
      state.audio.pause();
      state.audio.src = "";
      state.audio = null;
    }
    document.querySelectorAll(".sr-ayah.playing").forEach((el) => el.classList.remove("playing"));
    state.playS = null;
    state.playA = null;
    state.paused = false;
    hidePlayer();
  }
  function playAyah(s, a, art) {
    if (!navigator.onLine) {
      toast(t("needNetAudio"));
      return;
    }
    const rec = reciterMeta();
    const url = "https://everyayah.com/data/" + rec.ea + "/" + p3(s) + p3(a) + ".mp3";
    if (state.audio) {
      state.audio.onended = null;
      state.audio.pause();
      state.audio.src = "";
    }
    document.querySelectorAll(".sr-ayah.playing").forEach((el) => el.classList.remove("playing"));
    const el = art || $("a-" + s + "-" + a);
    if (el) el.classList.add("playing");
    const audio = new Audio(url);
    state.audio = audio;
    state.playS = s;
    state.playA = a;
    state.paused = false;
    showPlayer();
    audio.play().catch(() => toast(t("needNetAudio")));
    audio.onended = () => {
      if (el) el.classList.remove("playing");
      const next = a + 1;
      if (next <= ayahCount(s)) {
        const nxt = $("a-" + s + "-" + next);
        if (nxt) nxt.scrollIntoView({ block: "nearest" });
        playAyah(s, next, nxt);
      } else {
        state.playS = null;
        state.playA = null;
        hidePlayer();
      }
    };
  }
  function togglePause() {
    if (!state.audio || !state.playS) return;
    if (state.paused) {
      state.audio.play().catch(() => toast(t("needNetAudio")));
      state.paused = false;
    } else {
      state.audio.pause();
      state.paused = true;
    }
    showPlayer();
  }
  function openSheet() {
    $("reciterSheetTitle").textContent = t("chooseReciter");
    $("reciterList").innerHTML = RECITERS.map((r) => {
      const on = r.id === state.reciter ? " on" : "";
      return `<button type="button" class="rec-opt${on}" data-id="${r.id}">${esc(r.name)}</button>`;
    }).join("");
    $("reciterSheet").classList.remove("hidden");
  }
  function closeSheet() {
    $("reciterSheet").classList.add("hidden");
  }
  function pickReciter(id) {
    if (!RECITERS.some((r) => r.id === id)) return;
    state.reciter = id;
    lsSet("reciter", id);
    closeSheet();
    showPlayer();
    if (state.playS) {
      const s = state.playS,
        a = state.playA;
      playAyah(s, a, $("a-" + s + "-" + a));
    }
  }

  const chev = `<span class="nr-chev">›</span>`;
  function navRow(id, ico, title, sub) {
    return `<button type="button" class="nav-row" id="${id}">
      <span class="nr-ico">${ico}</span>
      <span class="nr-body"><b>${esc(title)}</b>${sub ? `<small>${esc(sub)}</small>` : ""}</span>
      ${chev}
    </button>`;
  }

  function showSettings() {
    state.screen = "settings";
    hideChrome();
    setTop(t("settings"), true, true);
    const meta = metaOf(state.activeId) || {};
    const rec = reciterMeta();
    const bms = state.bookmarks
      .slice(0, 30)
      .map((b) => `<button class="btn" data-act="goto" data-s="${b.s}" data-a="${b.a}" data-page="${b.page}">${b.s}:${b.a}</button>`)
      .join("");
    $("screen").innerHTML = `<div class="wrap">
      <div class="block">
        <h2>${t("reading")}</h2>
        ${navRow("btnLangs", icon.book, t("translations"), meta.lname || meta.name || "")}
        ${navRow("btnFont", icon.type, t("font"), Math.round(state.font * 100) + "%")}
        ${navRow("btnReciterSet", icon.mic, t("reciter"), rec.name)}
      </div>
      <div class="block">
        <h2>${t("bookmarks")}</h2>
        <div class="btns" id="bmList">${bms || `<span style="color:var(--mut);font-size:.88rem">${t("noBookmarks")}</span>`}</div>
      </div>
      <div class="block">
        <h2>${t("about")}</h2>
        ${navRow("btnPrivacy", icon.shield, t("privacyPolicy"), "")}
        ${navRow("btnSources", icon.book, t("sources"), "")}
        ${navRow("btnSite", icon.web, t("website"), SITE_URL.replace("https://", ""))}
        <p style="margin:.7rem 0 0;font-size:.8rem;color:var(--mut)">${t("privacy")}</p>
      </div>
    </div>`;
    $("btnLangs").onclick = showTranslations;
    $("btnFont").onclick = showFont;
    $("btnReciterSet").onclick = openSheet;
    $("btnPrivacy").onclick = showPrivacy;
    $("btnSources").onclick = showSources;
    $("btnSite").onclick = () => openExternal(SITE_URL);
    $("screen").onclick = onSettingsClick;
  }

  function onSettingsClick(e) {
    const b = e.target.closest("button[data-act]");
    if (!b) return;
    if (b.dataset.act === "goto") showReader(+b.dataset.page, b.dataset.s + ":" + b.dataset.a);
  }

  async function showTranslations() {
    state.screen = "translations";
    hideChrome();
    setTop(t("translations"), true, true);
    const keys = await idbKeys();
    const have = new Set(keys.map(String));
    const langs = translations()
      .map((tr) => {
        const on = have.has(tr.id);
        const act = state.activeId === tr.id;
        const st = act
          ? `<span class="pill">${t("active")}</span>`
          : on
            ? `<span class="pill">${t("onDevice")}</span>`
            : `<span class="pill" style="color:var(--mut);background:#f0ebe0">${t("notOnDevice")}</span>`;
        const buttons = [];
        if (!on) buttons.push(`<button class="btn pri" data-act="dl" data-id="${tr.id}">${t("download")} · ${fmtSize(tr.bytes)}</button>`);
        if (on && !act) buttons.push(`<button class="btn pri" data-act="use" data-id="${tr.id}">${t("use")}</button>`);
        if (on) buttons.push(`<button class="btn warn" data-act="del" data-id="${tr.id}">${t("del")}</button>`);
        return `<div class="row" style="align-items:flex-start;flex-wrap:wrap">
          <div style="flex:1;min-width:10rem"><b>${esc(tr.lname)}</b><div style="font-size:.78rem;color:var(--mut)">${esc(tr.name)}</div>${st}</div>
          <div class="btns">${buttons.join("")}</div>
        </div>`;
      })
      .join("");
    $("screen").innerHTML = `<div class="wrap">
      <div class="block">
        <div id="langOps">${langs}</div>
        <div id="setStatus"></div>
      </div>
    </div>`;
    $("screen").onclick = onLangClick;
  }

  async function onLangClick(e) {
    const b = e.target.closest("button[data-act]");
    if (!b) return;
    const act = b.dataset.act;
    const id = b.dataset.id;
    if (act === "dl") {
      await startDownload(id, $("setStatus"), () => showTranslations());
    } else if (act === "use") {
      await setActive(id);
      toast(t("active"));
      showTranslations();
    } else if (act === "del") {
      if (!confirm(t("confirmDel"))) return;
      await idbDel(id);
      if (state.activeId === id) {
        const left = (await idbKeys()).map(String);
        if (left.length) await setActive(left[0]);
        else {
          state.activeId = null;
          state.pack = null;
          lsSet("active", null);
          renderPicker();
          return;
        }
      }
      showTranslations();
    }
  }

  function showFont() {
    state.screen = "font";
    hideChrome();
    setTop(t("font"), true, true);
    const ar = (state.uthmani[0] && state.uthmani[0][0]) || BISMILLAH;
    const trText = (state.pack && state.pack.v[0] && state.pack.v[0][0]) || "";
    const meta = metaOf(state.activeId) || {};
    const dirTr = meta.dir === "rtl" ? " rtl" : "";
    $("screen").innerHTML = `<div class="wrap">
      <div class="block">
        <h2>${t("font")}</h2>
        <div class="font-ctrl">
          <span style="font-size:.8rem;color:var(--mut)">A</span>
          <input id="selFont" type="range" min="0.8" max="1.8" step="0.05" value="${state.font}">
          <span style="font-size:1.15rem;color:var(--mut)">A</span>
        </div>
      </div>
      <h2 style="margin:.2rem 0 .55rem;font-size:.95rem;color:var(--em2)">${t("fontPreview")}</h2>
      <div class="font-prev" id="fontPrev">
        <div class="sr-arabic">${ar}</div>
        <div class="sr-tr${dirTr}">${esc(trText)}</div>
        <div class="sr-who">${esc(meta.name || "")}</div>
      </div>
    </div>`;
    const apply = () => {
      lsSet("font", applyFontScale($("selFont").value));
    };
    $("selFont").oninput = apply;
    $("selFont").onchange = apply;
  }

  function showPrivacy() {
    state.screen = "privacy";
    hideChrome();
    setTop(t("privacyPolicy"), true, true);
    $("screen").innerHTML = `<div class="wrap">
      <div class="block privacy-body">
        <h2>${t("privacyPolicy")}</h2>
        <p>${t("privacy1")}</p>
        <p>${t("privacy2")}</p>
        <p>${t("privacy3")}</p>
        <p>${t("privacy4")}</p>
        <p>${t("privacyContact")}</p>
        <p><a href="#" id="privSite">${esc(SITE_URL)}</a></p>
      </div>
    </div>`;
    $("privSite").onclick = (e) => {
      e.preventDefault();
      openExternal(SITE_URL);
    };
  }

  function showSources() {
    state.screen = "sources";
    hideChrome();
    setTop(t("sources"), true, true);
    const rows = translations()
      .map((tr) => `<article class="note"><h3>${esc(tr.lname)} — ${esc(tr.name)}</h3><p>${esc(tr.src)}</p><p>${t("size")}: ${fmtSize(tr.bytes)} · v${esc(tr.ver)}</p></article>`)
      .join("");
    $("screen").innerHTML = `<div class="wrap src">
      <h3>القرآن</h3>
      <p>Arabic Quran text: Tanzil Quran Text (Uthmani). Copyright (C) 2007–2021 Tanzil Project. Licence: Creative Commons Attribution 3.0. The text is used unaltered. Updates: https://tanzil.net/updates/</p>
      <h3>${t("translator")}</h3>
      ${rows}
      <h3>Audio</h3>
      <p>Recitation streams from EveryAyah (everyayah.com). Reciters: Maher Al Muaiqly, Husary, Nasser Al Qatami, Yasser Al Dosari, Muhammad Ayyub, Muhammad Jibreel, Saud Ash-Shuraim. These recordings are not covered by the Tanzil mushaf permission. Rights belong to the reciter and the publisher of the files.</p>
      <h3>Font</h3>
      <p>Uthmanic Hafs font: King Fahd Glorious Quran Printing Complex (KFGQPC), Madinah.</p>
      <h3>${esc(t("app"))}</h3>
      <p>App shell, design and compilation © 2026 Mahir Aliyev / Nibras. All rights reserved. Quran text, translations and recitations remain under their authors’ and publishers’ rights.</p>
      <p><a href="#" id="srcSite">${esc(SITE_URL)}</a></p>
    </div>`;
    $("srcSite").onclick = (e) => {
      e.preventDefault();
      openExternal(SITE_URL);
    };
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  (function swipe() {
    let x0 = null, y0 = null, t0 = 0;
    $("screen").addEventListener(
      "touchstart",
      (e) => {
        if (state.screen !== "reader" || e.touches.length !== 1) return;
        x0 = e.touches[0].clientX;
        y0 = e.touches[0].clientY;
        t0 = Date.now();
      },
      { passive: true }
    );
    $("screen").addEventListener("touchend", (e) => {
      if (state.screen !== "reader" || x0 == null) return;
      const tch = e.changedTouches[0];
      const dx = tch.clientX - x0, dy = tch.clientY - y0, dt = Date.now() - t0;
      x0 = null;
      if (dt > 800 || Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 1.4) return;
      const rtl = document.documentElement.dir === "rtl";
      const next = (!rtl && dx < 0) || (rtl && dx > 0);
      showReader(state.page + (next ? 1 : -1));
    });
  })();

  $("btnHome").onclick = () => {
    if (state.pack) showHome();
  };
  $("btnSettings").onclick = () => {
    if (state.pack || state.screen === "home") showSettings();
  };
  $("btnBack").onclick = () => {
    if (!$("reciterSheet").classList.contains("hidden")) {
      closeSheet();
      return;
    }
    if (state.screen === "reader") showHome();
    else if (state.screen === "translations" || state.screen === "font" || state.screen === "privacy" || state.screen === "sources") showSettings();
    else if (state.screen === "settings") state.pack ? showHome() : renderPicker();
  };
  $("prevPage").onclick = () => showReader(state.page - 1);
  $("nextPage").onclick = () => showReader(state.page + 1);
  $("btnPlayerPause").onclick = togglePause;
  $("btnReciter").onclick = openSheet;
  $("reciterBackdrop").onclick = closeSheet;
  $("reciterList").onclick = (e) => {
    const b = e.target.closest("button[data-id]");
    if (b) pickReciter(b.dataset.id);
  };

  async function boot() {
    state.ui = detectUi();
    applyUiDir();
    applyFontScale(lsGet("font", 1));
    state.reciter = lsGet("reciter", "maher");
    state.bookmarks = lsGet("bookmarks", []) || [];
    const [uth, pages, surahs, names] = await Promise.all([
      fetch("data/quran-uthmani.json").then((r) => r.json()),
      fetch("data/pages.json").then((r) => r.json()),
      fetch("data/surahs.json").then((r) => r.json()),
      fetch("data/surah-names.json").then((r) => r.json()).catch(() => ({}))
    ]);
    state.uthmani = uth;
    state.pages = pages;
    state.surahs = surahs;
    state.surahNames = names;
    state.db = await idbOpen();
    await loadCatalog();
    const saved = lsGet("active", null);
    if (saved) {
      const pack = await idbGet(saved);
      if (pack && pack.v) {
        await setActive(saved, pack);
        showHome();
        return;
      }
    }
    const keys = await idbKeys();
    if (keys && keys.length) {
      await setActive(String(keys[0]));
      showHome();
      return;
    }
    renderPicker();
  }

  boot().catch((e) => {
    $("screen").innerHTML = `<div class="wrap"><div class="err">${esc(e && e.message ? e.message : String(e))}</div></div>`;
  });
})();
