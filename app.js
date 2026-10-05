/* Greenglanz Mobility - Premium
   1) Scroll-Film: Bildfolgen auf Canvas, gesteuert über GSAP ScrollTrigger
   2) Preis-Konfigurator  3) Anfrageformular (WhatsApp / E-Mail)  4) Navigation, Einblendungen */
(() => {
  "use strict";

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));

  /* ---------------------------------------------------------------- Film */
  const SEQ = "assets/seq/";
  const SCENE_VH = 170;      // Scrollstrecke je Szene (muss zu styles.css passen)
  const PLAY_UNTIL = 0.84;   // Anteil der Szene, in dem die Bildfolge läuft
  const FADE = 0.07;         // Überblendung an den Szenengrenzen

  async function initFilm() {
    const film = $("#film");
    if (!film) return;

    let manifest = null;
    try {
      const res = await fetch(SEQ + "manifest.json", { cache: "no-cache" });
      if (res.ok) manifest = await res.json();
    } catch (_) { /* ohne Manifest bleibt der Film im Standbild-Modus */ }

    // Szenen ohne Bildmaterial entfernen, damit nichts Leeres stehen bleibt
    const all = $$(".scene", film);
    if (manifest) {
      all.forEach((el) => {
        if (!manifest.scenes[el.dataset.seq] && !el.classList.contains("scene--hero")) el.remove();
      });
    }
    $$(".scene__poster", film).forEach((img) => {
      const drop = () => img.remove();
      if (img.complete && img.naturalWidth === 0) drop();
      else img.addEventListener("error", drop, { once: true });
    });

    const canLive = manifest && !reduceMotion && window.gsap && window.ScrollTrigger;
    if (!canLive) return;

    const scenes = $$(".scene", film).filter((el) => manifest.scenes[el.dataset.seq]);
    if (!scenes.length) return;
    $$(".scene", film).forEach((el) => { if (!scenes.includes(el)) el.remove(); });

    const ext = manifest.ext || "webp";
    const canvas = $("#filmCanvas");
    const ctx = canvas.getContext("2d", { alpha: false });
    const stage = $("#stage");
    const store = scenes.map((el) => ({
      dir: el.dataset.seq,
      count: manifest.scenes[el.dataset.seq],
      frames: [],
      requested: false,
    }));

    const src = (s, n) => `${SEQ}${s.dir}/f${String(n).padStart(3, "0")}.${ext}`;
    function request(i) {
      const s = store[i];
      if (!s || s.requested) return;
      s.requested = true;
      for (let n = 1; n <= s.count; n++) {
        const img = new Image();
        img.decoding = "async";
        img.onload = () => { s.frames[n - 1] = img; if (i === current.scene) paint(); };
        img.src = src(s, n);
      }
    }

    const current = { scene: 0, frame: 0, alpha: 1, drawnKey: "" };
    let shown = -1;

    function size() {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const w = Math.round(stage.clientWidth * dpr);
      const h = Math.round(stage.clientHeight * dpr);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w; canvas.height = h;
        current.drawnKey = "";
        paint();
      }
    }

    // nächstliegendes bereits geladenes Bild, damit beim Nachladen nichts flackert
    function nearest(s, idx) {
      for (let d = 0; d < s.count; d++) {
        if (s.frames[idx - d]) return s.frames[idx - d];
        if (s.frames[idx + d]) return s.frames[idx + d];
      }
      return null;
    }

    function paint() {
      const s = store[current.scene];
      const img = nearest(s, current.frame);
      if (!img) return;
      const key = `${current.scene}:${img.src}:${current.alpha.toFixed(2)}`;
      if (key === current.drawnKey) return;
      current.drawnKey = key;
      const cw = canvas.width, ch = canvas.height;
      const scale = Math.max(cw / img.naturalWidth, ch / img.naturalHeight);
      const w = img.naturalWidth * scale, h = img.naturalHeight * scale;
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#080b0a";
      ctx.fillRect(0, 0, cw, ch);
      ctx.globalAlpha = current.alpha;
      ctx.drawImage(img, (cw - w) / 2, (ch - h) / 2, w, h);
    }

    function update(progress) {
      const n = scenes.length;
      const t = clamp(progress) * n;
      const i = Math.min(n - 1, Math.floor(t));
      const local = t - i;

      if (i !== shown) {
        scenes.forEach((el) => el.classList.remove("is-active"));
        request(i); request(i + 1);
        shown = i;
      }
      current.scene = i;
      current.frame = Math.round(clamp(local / PLAY_UNTIL) * (store[i].count - 1));

      let alpha = 1;
      if (i > 0 && local < FADE) alpha = local / FADE;
      if (i < n - 1 && local > 1 - FADE) alpha = (1 - local) / FADE;
      current.alpha = clamp(alpha);

      // Text blendet kurz vor dem Szenenwechsel aus, in der letzten Szene bleibt er stehen
      const showCopy = i === 0 ? local < 0.8 : i === n - 1 ? local > 0.1 : local > 0.1 && local < 0.9;
      scenes[i].classList.toggle("is-active", showCopy);
      paint();
    }

    film.style.setProperty("--scenes", scenes.length);
    film.classList.add("film--live");
    gsap.registerPlugin(ScrollTrigger);
    new ResizeObserver(size).observe(stage);
    size();
    request(0); request(1);
    scenes[0].classList.add("is-active");

    // Tastatur: Fokus auf einen Link in einer Szene scrollt den Film dorthin
    scenes.forEach((el, k) => el.addEventListener("focusin", () => {
      if (el.classList.contains("is-active")) return;
      const range = film.offsetHeight - window.innerHeight;
      window.scrollTo({ top: film.offsetTop + (range * (k + 0.5)) / scenes.length, behavior: "auto" });
    }));

    ScrollTrigger.create({
      trigger: film,
      start: "top top",
      end: "bottom bottom",
      scrub: 0.4,
      onUpdate: (self) => update(self.progress),
      onRefresh: (self) => update(self.progress),
    });
  }

  /* -------------------------------------------------- Preis-Konfigurator */
  const PREISE = {
    s:   { bsp: "VW Polo, Renault Twingo, Opel Corsa, Ford Fiesta",        "aussen-standard": "54,99", "aussen-premium": "64,99", "innen-standard": "59,99", "innen-gold": "79,99", "innen-premium": "149,99" },
    m:   { bsp: "Mercedes C-Klasse, BMW 3er, VW Passat, Audi A4",          "aussen-standard": "64,99", "aussen-premium": "74,99", "innen-standard": "69,99", "innen-gold": "89,99", "innen-premium": "159,99" },
    l:   { bsp: "BMW X5, Audi A7, Mercedes GLE, VW Touareg",               "aussen-standard": "74,99", "aussen-premium": "84,99", "innen-standard": "79,99", "innen-gold": "89,99", "innen-premium": "169,99" },
    t:   { bsp: "Renault Master, Renault Trafic, VW Crafter, Mercedes Sprinter", "aussen-standard": "89,99", "aussen-premium": "94,99", "innen-standard": "69,99", "innen-gold": "79,99", "innen-premium": "159,99" },
    lkw: { bsp: "",                                                         "aussen-standard": null,    "aussen-premium": null,    "innen-standard": "79,99", "innen-gold": "99,99", "innen-premium": "159,99" },
  };
  const KLASSE_LABEL = { s: "PKW S (Kleinwagen)", m: "PKW M (Mittelklasse)", l: "PKW L (Oberklasse / SUV)", t: "Transporter", lkw: "LKW" };

  function initPreise() {
    const group = $("#klassen");
    if (!group) return;
    const radios = $$("[role=radio]", group);
    const bsp = $("#klasseBsp");
    const select = $("#f-klasse");

    function choose(btn, focus) {
      radios.forEach((r) => {
        const on = r === btn;
        r.setAttribute("aria-checked", on);
        r.tabIndex = on ? 0 : -1;
      });
      if (focus) btn.focus();
      const k = btn.dataset.k, row = PREISE[k];
      bsp.textContent = row.bsp ? `Zum Beispiel ${row.bsp}` : "Für LKW bieten wir die Innenreinigung der Fahrerkabine an.";
      $$("[data-p]").forEach((el) => {
        const v = row[el.dataset.p];
        el.textContent = v ? `${v} €` : "auf Anfrage";
        el.classList.toggle("is-anfrage", !v);
        el.classList.remove("is-tick");
        void el.offsetWidth;
        el.classList.add("is-tick");
      });
      if (select) select.value = KLASSE_LABEL[k];
    }

    group.addEventListener("click", (e) => {
      const btn = e.target.closest("[role=radio]");
      if (btn) choose(btn, false);
    });
    group.addEventListener("keydown", (e) => {
      const i = radios.indexOf(document.activeElement);
      if (i < 0) return;
      const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
      if (!step) return;
      e.preventDefault();
      choose(radios[(i + step + radios.length) % radios.length], true);
    });

    // "Dieses Paket anfragen" trägt das Paket ins Formular ein
    $$("[data-paket]").forEach((a) => a.addEventListener("click", () => {
      const p = $("#f-paket");
      if (p) p.value = a.dataset.paket;
    }));
  }

  /* ------------------------------------------------------------ Formular */
  const WA = "4915730012743";
  const MAIL = "info@greenglanzmobility.de";

  function initForm() {
    const form = $("#anfrage");
    if (!form) return;
    const status = $("#formStatus");
    const required = ["name", "tel", "klasse"];

    function setError(field, on) {
      field.setAttribute("aria-invalid", on);
      const msg = document.getElementById(field.getAttribute("aria-describedby"));
      if (msg) msg.hidden = !on;
    }
    required.forEach((n) => form.elements[n].addEventListener("input", (e) => {
      if (e.target.value.trim()) setError(e.target, false);
    }));

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const kanal = (e.submitter && e.submitter.dataset.kanal) || "whatsapp";
      let first = null;
      required.forEach((n) => {
        const f = form.elements[n];
        const bad = !f.value.trim();
        setError(f, bad);
        if (bad && !first) first = f;
      });
      if (first) {
        status.textContent = "";
        first.focus();
        return;
      }
      const v = (n) => form.elements[n].value.trim();
      const termin = v("termin") ? new Date(v("termin") + "T00:00").toLocaleDateString("de-DE") : "";
      const lines = [
        "Terminanfrage über die Website",
        `Name: ${v("name")}`,
        `Telefon: ${v("tel")}`,
        `Fahrzeugklasse: ${v("klasse")}`,
        `Paket: ${v("paket") || "Beratung gewünscht"}`,
        termin && `Wunschtermin: ${termin}`,
        v("ort") && `Standort: ${v("ort")}`,
        v("info") && `Hinweise: ${v("info")}`,
      ].filter(Boolean);
      const text = lines.join("\n");

      if (kanal === "mail") {
        window.location.href = `mailto:${MAIL}?subject=${encodeURIComponent("Terminanfrage " + v("name"))}&body=${encodeURIComponent(text)}`;
        status.textContent = "Ihr E-Mail-Programm wurde mit der fertigen Anfrage geöffnet. Bitte dort absenden.";
      } else {
        window.open(`https://wa.me/${WA}?text=${encodeURIComponent(text)}`, "_blank", "noopener");
        status.textContent = "WhatsApp wurde mit der fertigen Anfrage geöffnet. Bitte dort absenden.";
      }
    });
  }

  /* ---------------------------------------------- Navigation, Reveals */
  function initNav() {
    const nav = $("#nav"), toggle = $("#navToggle"), links = $("#navLinks");
    const sentinel = document.createElement("div");
    sentinel.style.cssText = "position:absolute;top:0;left:0;width:1px;height:60px;pointer-events:none";
    document.body.prepend(sentinel);
    new IntersectionObserver(([en]) => nav.classList.toggle("is-solid", !en.isIntersecting)).observe(sentinel);

    const close = () => { links.classList.remove("is-open"); toggle.setAttribute("aria-expanded", "false"); toggle.setAttribute("aria-label", "Menü öffnen"); };
    toggle.addEventListener("click", () => {
      const open = !links.classList.contains("is-open");
      links.classList.toggle("is-open", open);
      toggle.setAttribute("aria-expanded", open);
      toggle.setAttribute("aria-label", open ? "Menü schließen" : "Menü öffnen");
    });
    links.addEventListener("click", (e) => { if (e.target.closest("a")) close(); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
  }

  function initReveal() {
    if (reduceMotion || !("IntersectionObserver" in window)) return;
    const groups = [".section .display", ".section__lede", ".klassen", ".paket", ".zahl", ".fakten li", ".ablauf li", ".kontaktliste li", ".form"];
    document.documentElement.classList.add("js-motion");
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) { en.target.classList.add("is-in"); io.unobserve(en.target); }
      });
    }, { threshold: 0.15, rootMargin: "0px 0px -6% 0px" });
    groups.forEach((sel) => $$(sel).forEach((el, i) => {
      el.dataset.reveal = "";
      el.style.setProperty("--i", i % 4);
      io.observe(el);
    }));
  }

  document.addEventListener("DOMContentLoaded", () => {
    const jahr = $("#jahr");
    if (jahr) jahr.textContent = new Date().getFullYear();
    initNav();
    initPreise();
    initForm();
    initReveal();
    initFilm();
  });
})();
