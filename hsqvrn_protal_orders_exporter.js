// ==UserScript==
// @name         HusqPortalOrdersExporter V3 (old+new compatible)
// @namespace    https://github.com/Dattenberger/TampermonkeyScripts
// @version      2.0.0
// @description  Exportiert Husqvarna-Bestelldaten als CSV (kompatibel mit altem Modal & neuem React-Layout).
// @author       Lukas Dattenberger
// @match        https://portal.husqvarnagroup.com/de/orders/*
// @grant        GM_addStyle
// @updateURL    https://raw.githubusercontent.com/Dattenberger/TampermonkeyScripts/main/hsqvrn_protal_orders_exporter.js
// @downloadURL  https://raw.githubusercontent.com/Dattenberger/TampermonkeyScripts/main/hsqvrn_protal_orders_exporter.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/jquery/3.6.0/jquery.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/jquery-csv/1.0.21/jquery.csv.min.js
// ==/UserScript==

(function () {
  'use strict';

  GM_addStyle(`
    a.export-btn {
      display:inline-flex; align-items:center; gap:.5rem; cursor:pointer; text-decoration:none;
    }
  `);

  // ---------- Utils ----------
  const debounce = (fn, wait = 200) => { let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), wait); }; };

  function nullSafeMatch(str, regex, idx = 1) {
    if (!str) return '';
    const m = str.match(regex);
    return (m && m.length > idx) ? m[idx] : '';
  }

  function parseNumberEU(s) {
    if (!s) return NaN;
    const cleaned = s.toString().trim().replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '');
    const n = parseFloat(cleaned);
    return Number.isFinite(n) ? n : NaN;
  }

  const MONTHS_DE = {
    'Januar':'01','Februar':'02','März':'03','Maerz':'03','April':'04','Mai':'05','Juni':'06',
    'Juli':'07','August':'08','September':'09','Oktober':'10','Okt.':'10','November':'11','Dezember':'12','Dez.':'12'
  };

  // Akzeptiert: "27. August 2025", "27 August 2025", "2.9.2025", "02.09.2025"
  function formatDateDE(input) {
    if (!input) return '';
    const s = input.trim();

    // 1) rein numerisch d.m.yyyy / dd.mm.yyyy
    const mNum = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
    if (mNum) {
      const d = mNum[1].padStart(2, '0');
      const mo = mNum[2].padStart(2, '0');
      const y = mNum[3];
      return `${d}.${mo}.${y}`;
    }

    // 2) ausgeschriebene Monate
    const mText = s.match(/^(\d{1,2})\.?\s+([A-Za-zäöüÄÖÜ\.]+)\s+(\d{4})$/);
    if (mText) {
      const d = mText[1].padStart(2, '0');
      const mo = MONTHS_DE[mText[2]] || '';
      const y = mText[3];
      if (mo) return `${d}.${mo}.${y}`;
    }

    return '';
  }

  function sanitizeFilename(s) {
    if (!s) return `order-${Date.now()}.csv`;
    return s.toString().trim().replace(/[\\/:*?"<>|]+/g, '_') + '.csv';
  }

  function prepareCsvDataToExport(rows, innerOrderNumber, outerOrderNumber) {
    return rows.map((data) => {
      let vpe = parseInt(nullSafeMatch(data['Kommentar'], /^D-BE\S*\s*VPE=(\d+)/, 1), 10);
      if (!Number.isFinite(vpe) || vpe < 1) vpe = 1;

      const anzRaw = (data['Anz/Konf.'] || '').split('/')[0] || '';
      const anz = parseInt(anzRaw.toString().replace(/^0+/g, '').replace(/\D+/g, ''), 10);
      const mengeBase = Number.isFinite(anz) ? anz : 0;
      const menge = Math.max(1, mengeBase * vpe); // nie 0

      const gesamt = parseNumberEU(data['Gesamt']);
      const ekNetto = (Number.isFinite(gesamt) && menge > 0) ? (gesamt * 0.97 / menge) : NaN;

      return {
        'HAN': (data['Artikelnumer'] || '').replace(/\D+/g, ''),
        'Interne Bestellnummer': (innerOrderNumber || '').slice(0, 14),
        'Artikelnummer': nullSafeMatch(data['Kommentar'], /^D-BE\S*\s*(?:VPE=\d*)?\s*(\S*)/, 1),
        'Lieferantenbezeichnung': data['Beschreibung'] || '',
        'menge': menge,
        'EK netto': Number.isFinite(ekNetto) ? ekNetto.toFixed(4).replace('.', ',') : '',
        'Lieferdatum': formatDateDE(data['Versendet']),
        'Freiposition': 'N',
        'Fremdbelegnummer': outerOrderNumber || ''
      };
    });
  }

  // ---------- Alter Aufbau (Modal) ----------
  function detectOldModal() {
    return !!document.querySelector('div#ui-modal-target article header');
  }

  function collectRowsOld($modal) {
    const rows = [];
    const $table = $modal.find('table');
    const $trs = $table.find('tbody tr');
    $trs.each(function () {
      const $tds = $(this).find('td');
      rows.push({
        'Artikelnumer': $tds.eq(0).find('div div').eq(0).text() || $tds.eq(0).find('div div').eq(1).text(),
        'Kommentar': $tds.eq(2).find('div').text(),
        'Beschreibung': $tds.eq(1).find('div').text(),
        'Angefragt': $tds.eq(3).find('div').text(),
        'Versendet': $tds.eq(4).find('div').text(),
        'Anz/Konf.': $tds.eq(5).find('div').text(),
        'Gesamt': $tds.eq(6).find('div').text(),
        'Tracking link': $tds.eq(7).find('span').text()
      });
    });
    return rows;
  }

  function attachExporterOld() {
    const modalSelector = 'div#ui-modal-target';
    const $root = $(modalSelector);
    if (!$root.length) return;
    if (!location.search.includes('?order=')) return;

    const $modal = $root.find('article').first();
    if (!$modal.length) return;

    const $header = $modal.find('header');
    const $headerDiv = $header.find('div').first();
    if (!$headerDiv.length) return;

    const innerOrderNumber = ($modal.find('dl > dd').eq(0).text() || '').trim();
    const hDiv = $header.find('> div').get(0);
    const outerOrderNumber = hDiv && hDiv.childNodes && hDiv.childNodes[0]
      ? (hDiv.childNodes[0].wholeText || '').trim()
      : '';

    if ($header.find('.export-btn').length) return;

    $headerDiv.css({ display: 'flex', justifyContent: 'space-between', alignItems: 'center' });
    const filename = sanitizeFilename(innerOrderNumber || outerOrderNumber || '');

    const $btn = $(`
      <a class="export-btn b2b-ai b2b-am b2b-al" data-variant="secondary" data-size="compact" download="${filename}">
        <span class="b2b-bx" aria-hidden="true">
          <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" fill="none" viewBox="0 0 28 28">
            <path fill="currentColor" d="M27.003 20..."></path>
          </svg>
        </span>
        <span class="label_s">Export CSV für JTL</span>
      </a>
    `);

    $btn.on('click', () => {
      const rows = collectRowsOld($modal);
      const csv = $.csv.fromObjects(prepareCsvDataToExport(rows, innerOrderNumber, outerOrderNumber), { separator: ';' });
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      $btn.attr('href', url);
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    });

    $headerDiv.append($btn);
  }

  // ---------- Neuer Aufbau (React Seite) ----------
  function detectNewPage() {
    return !!document.querySelector('[data-testid="order-detail-page"]') || !!document.querySelector('div[role="table"]');
  }

  function getOrderNumbersNew($page) {
    // H1: "Bestellung 2013415420"
    const h1 = $page.find('h1').text() || '';
    const fromH1 = (h1.match(/(\d{6,})/) || [,''])[1];

    // "Ihre Bestellnummer:" Blöcke – nimm die erste echte Nummer, sonst H1
    let inner = '';
    $page.find('h3:contains("Details zur Bestellung")').parent().find('p').each(function() {
      const t = $(this).text().trim();
      if (/^\d{6,}$/.test(t) && !inner) inner = t;
    });

    const outer = fromH1 || inner || '';
    if (!inner) inner = outer;
    return { innerOrderNumber: inner, outerOrderNumber: outer };
  }

  function cellByArea($row, area) {
    // sucht div[role="cell"] mit grid-area: <area>
    return $row.find(`div[role="cell"][style*="grid-area: ${area}"]`);
  }

  function collectRowsNew($page) {
    const rows = [];
    const $table = $page.find('div[role="table"]');
    if (!$table.length) return rows;

    // Datenteil: zweites rowgroup (erstes = Header)
    const $groups = $table.children('div[role="rowgroup"]');
    const $dataGroup = $groups.eq(1);
    const $rows = $dataGroup.children('div[role="row"]');

    $rows.each(function() {
      const $r = $(this);

      const $cell2 = cellByArea($r, 'cell2'); // Artikel (formatierte Artikelnummer, Link)
      const $cell3a = cellByArea($r, 'cell3a'); // Nettopreis gesamt (Zahl)
      const $cell4 = cellByArea($r, 'cell4'); // Kommentar
      const $cell5 = cellByArea($r, 'cell5'); // Expected ship date
      const $cell6 = cellByArea($r, 'cell6'); // MENGE del. / ord.
      const $tracking = cellByArea($r, 'tracking'); // Tracking
      const $shipping = cellByArea($r, 'shippingDate'); // Actual ship date
      const $details = cellByArea($r, 'details'); // Detailblock mit unformatted id, name, desc

      const artikelFormatted = $cell2.find('a').text().replace(/\s+/g,' ').trim();
      const nettopreis = $cell3a.find('span').first().text().trim();
      const kommentar = $cell4.text().trim();
      const expShip = $cell5.text().trim();
      const menge = $cell6.text().trim();
      const trackingTxt = ($tracking.text() || '').trim();
      const actualShip = $shipping.text().trim();

      const unformatted = $details.find('> div > div').eq(0).text().trim(); // erste Zeile im details-Block
      const name1 = $details.find('> div > div').eq(1).text().trim();
      const name2 = $details.find('> div > div').eq(2).text().trim();
      const beschreibung = name1 || name2 || artikelFormatted;

      rows.push({
        'Artikelnumer': artikelFormatted || unformatted, //die formatted Variante hat immer die aktuelle HAN.
        'Kommentar': kommentar,
        'Beschreibung': beschreibung,
        'Angefragt': expShip,                               // analog altem Mapping
        'Versendet': actualShip || expShip,                 // falls Actual leer ist, nimm Expected
        'Anz/Konf.': menge,
        'Gesamt': nettopreis,
        'Tracking link': trackingTxt
      });
    });

    return rows;
  }

  function attachExporterNew() {
    const $page = $('[data-testid="order-detail-page"]').first();
    if (!$page.length) return;

    // Platz neben bestehendem "Auftrag exportieren" Button
    const $buttonBar = $page.find('h1').parent().find('.b2b-ga.b2b-gu.b2b-gj').first();
    if (!$buttonBar.length) return;
    if ($buttonBar.find('.export-btn').length) return;

    const { innerOrderNumber, outerOrderNumber } = getOrderNumbersNew($page);
    const filename = sanitizeFilename(innerOrderNumber || outerOrderNumber || '');

    const $btn = $(`
      <a class="export-btn b2b-ai b2b-am b2b-al" data-variant="secondary" data-size="compact" download="${filename}" title="Export CSV für JTL">
        <span class="b2b-ax" aria-hidden="true">
          <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" fill="none" viewBox="0 0 28 28">
            <path fill="currentColor" d="M27.003 20..."></path>
          </svg>
        </span>
        <span class="b2b-au b2b-a0">Export CSV für JTL</span>
      </a>
    `);

    $btn.on('click', () => {
      const rows = collectRowsNew($page);
      const csv = $.csv.fromObjects(prepareCsvDataToExport(rows, innerOrderNumber, outerOrderNumber), { separator: ';' });
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      $btn.attr('href', url);
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    });

    // Button einsetzen (nicht den React-Button anfassen, um Konflikte zu vermeiden)
    $buttonBar.append($btn);
  }

  // ---------- Bootstrapping ----------
  function start() {
    const onChange = debounce(() => {
      if (detectNewPage()) attachExporterNew();
      if (detectOldModal()) attachExporterOld();
    }, 120);

    // initial
    onChange();

    const target = document.body;
    if (!target) return;

    const mo = new MutationObserver((mutations) => {
      if (!location.pathname.includes('/de/orders/')) return;
      if (mutations.some(m => m.type === 'childList')) onChange();
    });

    mo.observe(target, { subtree: true, childList: true });
  }

  jQuery(document).ready(start);
})();
