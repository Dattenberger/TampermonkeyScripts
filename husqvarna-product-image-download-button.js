// ==UserScript==
// @name         Husqvarna Image Download Button
// @namespace    https://github.com/Dattenberger/TampermonkeyScripts
// @version      1.2.0
// @description  Fügt auf Husqvarna-Produktseiten einen Button ein, um alle Galeriebilder als XXL-WebP herunterzuladen
// @author       Lukas Dattenberger
// @match        https://www.husqvarna.com/*
// @grant        GM_download
// @updateURL    https://raw.githubusercontent.com/Dattenberger/TampermonkeyScripts/main/husqvarna-product-image-download-button.js
// @downloadURL  https://raw.githubusercontent.com/Dattenberger/TampermonkeyScripts/main/husqvarna-product-image-download-button.js
// ==/UserScript==

(function () {
  'use strict';

  /* ---------------------------------------------------------
   * Hilfsfunktionen
   * --------------------------------------------------------- */

  /** macht einen String filename-tauglich (ASCII, - statt Leerzeichen) */
  function sanitize(str) {
    return str
      .normalize('NFKD')                      // Diakritika trennen
      .replace(/[\u0300-\u036f]/g, '')       // Diakritika entfernen
      .replace(/[^a-zA-Z0-9_-]+/g, '-')      // alles Unerlaubte → '-'
      .replace(/-+/g, '-')                   // Mehrfach '-' zusammenfassen
      .replace(/^-|-$/g, '')                 // führende/abschließende '-' löschen
      .toLowerCase();
  }

  /** liest den Artikel-/Produktnamen, schon sanitised */
  function getProductName() {
    const nameEl = document.querySelector('[data-ui-component="ProductV2Aside"] h1');
    const rawName = nameEl?.textContent.trim() || 'husqvarna-product';
    return sanitize(rawName);
  }

  /** sammelt die Bild-URLs und setzt den format-Parameter */
  function collectImageUrls() {
    const imgs = document.querySelectorAll('[id^="pdp-media-scroller-item--"] img');
    const urls = new Set();
    imgs.forEach(img => {
      const raw = img.currentSrc || img.src;
      if (!raw) return;
      const u = new URL(raw, location.href);
      u.searchParams.set('format', 'WEBP_LANDSCAPE_CONTAIN_XXL');
      urls.add(u.href);
    });
    return [...urls];
  }

  /** lädt alle gefundenen Bilder */
  function downloadAll() {
    const base = getProductName();
    const urls = collectImageUrls();

    if (!urls.length) {
      alert('Kein Bild gefunden – Seite schon komplett geladen?');
      return;
    }

    urls.forEach((url, i) =>
      GM_download({
        url,
        name: `${base}-${i + 1}.webp`,
        saveAs: false,
      })
    );
  }

  /* ---------------------------------------------------------
   * Button einfügen
   * --------------------------------------------------------- */

  function injectButton() {
    if (document.getElementById('tm-img-dl-btn')) return;

    const scroller = document.querySelector('.hbd-thumbnail-scroller_main');
    if (!scroller) return; // noch nicht da → später erneut versuchen

    const btn = Object.assign(document.createElement('button'), {
      id: 'tm-img-dl-btn',
      innerText: 'Bilder herunterladen',
      onclick: downloadAll,
      style: `
        display:inline-block; margin-bottom:12px; margin-left:60px;
        padding:8px 14px; background:#ff6600; color:#fff;
        border:none; border-radius:4px; cursor:pointer;
      `,
    });

    scroller.insertAdjacentElement('beforebegin', btn);
  }

  /* ---------------------------------------------------------
   * Seite beobachten (Galerie lädt asynchron)
   * --------------------------------------------------------- */

  new MutationObserver(injectButton).observe(document.documentElement, {
    childList: true,
    subtree: true,
  });

  // Falls DOM bereits fertig ist
  injectButton();
})();
