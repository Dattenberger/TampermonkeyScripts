// ==UserScript==
// @name         Husqvarna Image Download Button
// @namespace    https://github.com/Dattenberger/TampermonkeyScripts
// @version      1.3.0
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

  /** String für Dateinamen säubern (ASCII, - statt Leerzeichen) */
  function sanitize(str) {
    return str
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9_-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase();
  }

  /** Artikel-/Produktnamen ermitteln und bereinigen */
  function getProductName() {
    const nameEl = document.querySelector(
      'h1'
    );
    const rawName = nameEl?.textContent.trim() || 'husqvarna-product';
    return sanitize(rawName);
  }

  /** Bild-URLs sammeln und format-Parameter setzen */
  function collectImageUrls() {
    const imgs = document.querySelectorAll(
      'article .hbd-product-details__grid > :first-child img, article .hbd-thumbnail-scroller_main img'
    );
    const urls = new Set();
    imgs.forEach((img) => {
      const raw = img.currentSrc || img.src || img.getAttribute('data-src');
      if (!raw) return;
      const u = new URL(raw, location.href);
      u.searchParams.set('format', 'WEBP_LANDSCAPE_CONTAIN_XXL');
      urls.add(u.href);
    });
    return [...urls];
  }

  /** Alle gefundenen Bilder herunterladen */
  function downloadAll() {
    const base = getProductName();
    const urls = collectImageUrls();

    if (!urls.length) {
      alert('Kein Bild gefunden – ist die Seite komplett geladen?');
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

    // Zielcontainer: erster Treffer von ProductDetails
    const container = document.querySelector(
      'article > :first-child'
    );
    if (!container) return; // noch nicht da → später erneut versuchen

    const btn = Object.assign(document.createElement('button'), {
      id: 'tm-img-dl-btn',
      innerText: 'Bilder herunterladen',
      onclick: downloadAll,
      style: `
        display:inline-block; margin-bottom:12px;
        padding:8px 14px; background:#ff6600; color:#fff;
        border:none; border-radius:4px; cursor:pointer;
      `,
    });

    // Als erstes Kind einfügen
    container.prepend(btn);
  }

  /* ---------------------------------------------------------
   * DOM beobachten (Galerie & Details laden asynchron)
   * --------------------------------------------------------- */

  new MutationObserver(injectButton).observe(document.documentElement, {
    childList: true,
    subtree: true,
  });

  // Falls DOM bereits fertig
  injectButton();
})();
