/* Mushafuk Tərcümə — Capacitor reader. Translations are downloaded, not bundled. */
(function () {
  "use strict";

  const BASE_FALLBACK = "https://mushafuk.online/app-data/v1/";
  const BISMILLAH = "بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ";
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
    ui: "az",
    catalog: null,
    uthmani: null,
    pages: null,
    surahs: null,
    db: null,
    activeId: null,
    pack: null,
    screen: "home",
    page: 1,
    font: 1,
    reciter: "maher",
    bookmarks: [],
    audio: null
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
    if (!res.body || !res.body.getReader) {
      return await res.arrayBuffer();
    }
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
        state.catalog = live;
        if (!state.catalog.base) state.catalog.base = bundled.base;
      }
    } catch (e) {
      /* bundled catalog is enough to show the list; download still needs the network */
    }
  }

  function detectUi() {
    const saved = lsGet("ui", null);
    if (saved && I18N[saved]) return saved;
    const lang = (navigator.language || "az").slice(0, 2).toLowerCase();
    if (I18N[lang]) return lang;
    return "az";
  }
  function detectLangId() {
    const code = (navigator.language || "").slice(0, 2).toLowerCase();
    const hit = (state.catalog.translations || []).find((x) => x.lang === code);
    return hit ? hit.id : "english_saheeh";
  }

  function applyUiDir() {
    const rtl = state.ui === "ar";
    document.documentElement.lang = state.ui;
    document.documentElement.dir = rtl ? "rtl" : "ltr";
  }

  function setTop(title, showBack, showHome) {
    $("title").innerHTML = title;
    $("btnBack").classList.toggle("hidden", !showBack);
    $("btnHome").classList.toggle("hidden", !showHome);
    $("btnSettings").classList.toggle("hidden", state.screen === "picker");
  }

  /* ---------- screens ---------- */
  function renderPicker(opts) {
    state.screen = "picker";
    $("pager").classList.add("hidden");
    setTop(t("app"), false, false);
    const prefer = (opts && opts.prefer) || detectLangId();
    const rows = state.catalog.translations
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
    return (state.catalog.translations || []).find((x) => x.id === id);
  }

  async function setActive(id, pack) {
    state.activeId = id;
    state.pack = pack || (await idbGet(id));
    lsSet("active", id);
  }

  function showHome() {
    state.screen = "home";
    $("pager").classList.add("hidden");
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
          <span class="names"><div class="ar">${s.name}</div><div class="en">${esc(s.ename)} · ${typ}</div></span>
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

  function surahName(i) {
    const s = state.surahs[i - 1];
    return s ? s.name + " · " + s.ename : String(i);
  }

  function showReader(page, focusRef) {
    state.screen = "reader";
    state.page = Math.max(1, Math.min(604, page || 1));
    $("pager").classList.remove("hidden");
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
    const fontStyle = `--read: ${state.font}`;
    let html = `<div class="sr-page" style="font-size:calc(1rem * ${state.font})">`;
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
          <div class="sr-name">${esc(su.ename)}</div>
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
    share: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></svg>'
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
    return `${s}:${a}\n${ar}\n${trText}\n— ${who}\nMushafuk Tərcümə`;
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
        toast(t("copied"));
      } catch (err) {
        toast(t("copied"));
      }
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

  function playAyah(s, a, art) {
    if (!navigator.onLine) {
      toast(t("needNetAudio"));
      return;
    }
    const rec = RECITERS.find((r) => r.id === state.reciter) || RECITERS[0];
    const url = "https://everyayah.com/data/" + rec.ea + "/" + p3(s) + p3(a) + ".mp3";
    if (state.audio) {
      state.audio.pause();
      state.audio.src = "";
    }
    document.querySelectorAll(".sr-ayah.playing").forEach((el) => el.classList.remove("playing"));
    if (art) art.classList.add("playing");
    const audio = new Audio(url);
    state.audio = audio;
    audio.play().catch(() => toast(t("needNetAudio")));
    audio.onended = () => {
      if (art) art.classList.remove("playing");
      const next = a + 1;
      if (next <= ayahCount(s)) {
        const el = $("a-" + s + "-" + next);
        if (el) {
          el.scrollIntoView({ block: "nearest" });
          playAyah(s, next, el);
        }
      }
    };
  }

  async function showSettings() {
    state.screen = "settings";
    $("pager").classList.add("hidden");
    setTop(t("settings"), true, true);
    const keys = await idbKeys();
    const have = new Set(keys.map(String));
    const langs = state.catalog.translations
      .map((tr) => {
        const on = have.has(tr.id);
        const act = state.activeId === tr.id;
        const st = act ? `<span class="pill">${t("active")}</span>` : on ? `<span class="pill">${t("onDevice")}</span>` : `<span class="pill" style="color:var(--mut);background:#f0ebe0">${t("notOnDevice")}</span>`;
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
    const recOpts = RECITERS.map((r) => `<option value="${r.id}"${r.id === state.reciter ? " selected" : ""}>${r.name}</option>`).join("");
    const uiOpts = ["az", "en", "tr", "ar"].map((c) => `<option value="${c}"${c === state.ui ? " selected" : ""}>${c.toUpperCase()}</option>`).join("");
    const bms = state.bookmarks
      .slice(0, 30)
      .map((b) => `<button class="btn" data-act="goto" data-s="${b.s}" data-a="${b.a}" data-page="${b.page}">${b.s}:${b.a}</button>`)
      .join("");
    $("screen").innerHTML = `<div class="wrap">
      <div class="block">
        <h2>${t("uiLang")}</h2>
        <div class="row"><span class="lbl">${t("uiLang")}</span><select id="selUi">${uiOpts}</select></div>
        <div class="row"><span class="lbl">${t("reciter")}</span><select id="selRec">${recOpts}</select></div>
        <div class="row"><span class="lbl">${t("font")}</span><input id="selFont" type="range" min="0.85" max="1.45" step="0.05" value="${state.font}"></div>
      </div>
      <div class="block">
        <h2>${t("languages")}</h2>
        <div id="langOps">${langs}</div>
        <div id="setStatus"></div>
      </div>
      <div class="block">
        <h2>${t("bookmarks")}</h2>
        <div class="btns" id="bmList">${bms || `<span style="color:var(--mut);font-size:.88rem">${t("noBookmarks")}</span>`}</div>
      </div>
      <div class="block">
        <h2>${t("sources")}</h2>
        <button type="button" class="btn pri" id="btnSources">${t("sources")}</button>
        <p style="margin:.7rem 0 0;font-size:.8rem;color:var(--mut)">${t("privacy")}</p>
      </div>
    </div>`;
    $("selUi").onchange = () => {
      state.ui = $("selUi").value;
      lsSet("ui", state.ui);
      applyUiDir();
      showSettings();
    };
    $("selRec").onchange = () => {
      state.reciter = $("selRec").value;
      lsSet("reciter", state.reciter);
    };
    $("selFont").oninput = () => {
      state.font = +$("selFont").value;
      lsSet("font", state.font);
    };
    $("btnSources").onclick = showSources;
    $("screen").onclick = onSettingsClick;
  }

  async function onSettingsClick(e) {
    const b = e.target.closest("button[data-act]");
    if (!b) return;
    const act = b.dataset.act;
    const id = b.dataset.id;
    if (act === "dl") {
      await startDownload(id, $("setStatus"), () => showSettings());
    } else if (act === "use") {
      await setActive(id);
      toast(t("active"));
      showSettings();
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
      showSettings();
    } else if (act === "goto") {
      showReader(+b.dataset.page, b.dataset.s + ":" + b.dataset.a);
    }
  }

  function showSources() {
    state.screen = "sources";
    $("pager").classList.add("hidden");
    setTop(t("sources"), true, true);
    const rows = state.catalog.translations
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
      <h3>Mushafuk</h3>
      <p>App shell, design and compilation © 2026 Mahir Aliyev / Mushafuk / Nibras. All rights reserved. Quran text, translations and recitations remain under their authors’ and publishers’ rights.</p>
    </div>`;
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /* swipe pages in reader */
  (function swipe() {
    let x0 = null,
      y0 = null,
      t0 = 0;
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
      const t = e.changedTouches[0];
      const dx = t.clientX - x0,
        dy = t.clientY - y0,
        dt = Date.now() - t0;
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
    if (state.screen === "reader" || state.screen === "sources") showHome();
    else if (state.screen === "settings") state.pack ? showHome() : renderPicker();
  };
  $("prevPage").onclick = () => showReader(state.page - 1);
  $("nextPage").onclick = () => showReader(state.page + 1);

  async function boot() {
    state.ui = detectUi();
    applyUiDir();
    state.font = lsGet("font", 1);
    state.reciter = lsGet("reciter", "maher");
    state.bookmarks = lsGet("bookmarks", []) || [];
    const [uth, pages, surahs] = await Promise.all([
      fetch("data/quran-uthmani.json").then((r) => r.json()),
      fetch("data/pages.json").then((r) => r.json()),
      fetch("data/surahs.json").then((r) => r.json())
    ]);
    state.uthmani = uth;
    state.pages = pages;
    state.surahs = surahs;
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
