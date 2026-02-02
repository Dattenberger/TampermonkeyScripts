// ==UserScript==
// @name         Husqvarna Skripte
// @namespace    https://github.com/Dattenberger/TampermonkeyScripts
// @version      3.0.0
// @author       Lukas Dattenberger
// @description  Husqvarna Portal Tools – Bestellexport via GraphQL mit Multi-Order-Support und Live-Status
// @downloadURL  https://raw.githubusercontent.com/Dattenberger/TampermonkeyScripts/main/dist/husqvarna-skripte.user.js
// @updateURL    https://raw.githubusercontent.com/Dattenberger/TampermonkeyScripts/main/dist/husqvarna-skripte.user.js
// @match        https://portal.husqvarnagroup.com/de/orders/*
// @require      https://cdnjs.cloudflare.com/ajax/libs/jquery/3.6.0/jquery.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/jquery-csv/1.0.21/jquery.csv.min.js
// @connect      portal.husqvarnagroup.com
// @grant        GM_addStyle
// @grant        GM_deleteValue
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_xmlhttpRequest
// ==/UserScript==

(function () {
  'use strict';

  function nullSafeString(value) {
    return value == null ? "" : String(value);
  }
  function nullSafeMatch(inputString, regex, groupIndex = 1) {
    if (!inputString) return "";
    const match = String(inputString).match(regex);
    return match && match.length > groupIndex ? match[groupIndex] : "";
  }
  const GERMAN_MONTHS = {
    "Januar": "01",
    "Februar": "02",
    "März": "03",
    "Maerz": "03",
    "April": "04",
    "Mai": "05",
    "Juni": "06",
    "Juli": "07",
    "August": "08",
    "September": "09",
    "Oktober": "10",
    "Okt.": "10",
    "November": "11",
    "Dezember": "12",
    "Dez.": "12"
  };
  function formatGermanDate(input) {
    if (!input) return "";
    const stringInput = String(input).trim();
    const numericMatch = stringInput.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
    if (numericMatch) {
      const day = numericMatch[1].padStart(2, "0");
      const month = numericMatch[2].padStart(2, "0");
      const year = numericMatch[3];
      return `${day}.${month}.${year}`;
    }
    const textMatch = stringInput.match(/^(\d{1,2})\.?\s+([A-Za-zäöüÄÖÜ.]+)\s+(\d{4})$/);
    if (textMatch) {
      const day = textMatch[1].padStart(2, "0");
      const monthCode = GERMAN_MONTHS[textMatch[2]] || "";
      const year = textMatch[3];
      if (monthCode) return `${day}.${monthCode}.${year}`;
    }
    return "";
  }
  function formatDateFromISO(isoString) {
    if (!isoString) return "";
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return "";
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
  }
  function debounce(func, waitTime = 150) {
    let timeout;
    return (...args) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), waitTime);
    };
  }
  function sanitizeFilename(filename) {
    if (!filename) return `order-${Date.now()}.csv`;
    return String(filename).trim().replace(/[\\/:*?"<>|]+/g, "_") + ".csv";
  }
  function validateOrderNumber(orderNumber) {
    return /^\d{6,}$/.test(String(orderNumber || ""));
  }
  function parseOrderNumbers(input) {
    if (!input || typeof input !== "string") {
      return { valid: [], invalid: [] };
    }
    const parts = input.trim().split(/[,\s;]+/).filter((part) => part.length > 0);
    const valid = [];
    const invalid = [];
    parts.forEach((part) => {
      const trimmed = part.trim();
      if (validateOrderNumber(trimmed)) {
        valid.push(trimmed);
      } else if (trimmed.length > 0) {
        invalid.push(trimmed);
      }
    });
    return { valid, invalid };
  }
  const Styles = {
    exportButton: `
    a.export-btn {
      display: inline-flex;
      align-items: center;
      gap: .5rem;
      cursor: pointer;
      text-decoration: none;
      margin-left: 5px;
      transition: opacity 0.2s ease;
      border-radius: 8px;
      padding: 12px 24px;
      border: 1px solid #3d3d3c;
      font-family: "Husqvarna Gothic", Arial, sans-serif;
      line-height: 16px;
      font-size: 14px;
      text-transform: uppercase;
    }
    a.export-btn.loading { background: #6f6f6f; color: white; pointer-events: none; }
    a.export-btn.queued { background-color: #ffc107; border-color: #ffc107; color: #212529; pointer-events: none; }
    a.export-btn.success { background-color: #28a745; border-color: #28a745; color: white; }
    a.export-btn.success:hover { background-color: #218838; border-color: #1e7e34; }
    a.export-btn.error { background-color: #dc3545; border-color: #dc3545; color: white; }
    a.export-btn.error:hover { background-color: #c82333; border-color: #bd2130; }
  `,
    customOrderInput: `
    .datte-custom-order-container { background: white; padding: 20px; margin: 20px 0; border-radius: 8px; border: 1px solid #e0e0e0; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .datte-custom-order-group { display: flex; gap: 12px; align-items: flex-end; width: 100%; }
    .datte-custom-order-wrapper { flex: 1; min-width: 300px; }
    .datte-custom-order-label { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; font-weight: 600; font-size: 14px; color: #3d3d3c; font-family: "Husqvarna Gothic", Arial, sans-serif; }
    .datte-muted { font-size: 12px; font-weight: 400; color: #999; }
    .datte-custom-order-input { width: 100%; padding: 12px 16px; border: 1px solid #3d3d3c; border-radius: 8px; font-size: 14px; font-family: "Husqvarna Gothic", Arial, sans-serif; transition: border-color 0.2s ease; }
    .datte-custom-order-input:focus { outline: none; border-color: #000; }
    .datte-custom-order-input.error { border-color: #dc3545; }
    .datte-custom-order-error { color: #dc3545; font-size: 12px; margin-top: 6px; display: none; font-family: "Husqvarna Gothic", Arial, sans-serif; }
    .datte-custom-order-error.show { display: block; }
    .datte-custom-order-btn { display: inline-flex; align-items: center; gap: 0.5rem; cursor: pointer; text-decoration: none; padding: 12px 32px; border-radius: 8px; border: 1px solid #3d3d3c; background: white; font-family: "Husqvarna Gothic", Arial, sans-serif; line-height: 16px; font-size: 14px; text-transform: uppercase; transition: background-color 0.2s ease, border-color 0.2s ease; white-space: nowrap; }
    .datte-custom-order-btn:hover:not(.loading):not(.disabled) { background: #f5f5f5; }
    .datte-custom-order-btn.loading { background: #6f6f6f; color: white; pointer-events: none; }
    .datte-custom-order-btn.disabled { opacity: 0.5; pointer-events: none; }
    .datte-custom-order-btn.success { background-color: #28a745; border-color: #28a745; color: white; }
    .datte-custom-order-btn.error { background-color: #dc3545; border-color: #dc3545; color: white; }
  `,
    confirmModal: `
    .datte-confirm-modal { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.5); display: flex; align-items: center; justify-content: center; z-index: 10000; animation: fadeIn 0.2s ease; }
    .datte-confirm-dialog { background: white; border-radius: 8px; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3); max-width: 500px; width: 90%; max-height: 80vh; overflow: hidden; display: flex; flex-direction: column; animation: slideIn 0.2s ease; }
    .datte-confirm-header { padding: 20px; border-bottom: 1px solid #e0e0e0; font-family: "Husqvarna Gothic", Arial, sans-serif; }
    .datte-confirm-title { font-size: 18px; font-weight: 600; color: #3d3d3c; display: flex; align-items: center; gap: 8px; }
    .datte-confirm-body { padding: 20px; overflow-y: auto; flex: 1; font-family: "Husqvarna Gothic", Arial, sans-serif; color: #3d3d3c; }
    .datte-confirm-order-list { margin: 15px 0; padding: 15px; background: #f5f5f5; border-radius: 4px; max-height: 200px; overflow-y: auto; font-family: monospace; font-size: 14px; line-height: 1.6; word-break: break-all; }
    .datte-confirm-actions { padding: 15px 20px; border-top: 1px solid #e0e0e0; display: flex; gap: 12px; justify-content: flex-end; }
    .datte-confirm-btn { padding: 10px 20px; border-radius: 6px; border: 1px solid #3d3d3c; font-family: "Husqvarna Gothic", Arial, sans-serif; font-size: 14px; cursor: pointer; transition: all 0.2s ease; }
    .datte-confirm-btn-cancel { background: white; color: #3d3d3c; }
    .datte-confirm-btn-cancel:hover { background: #f5f5f5; }
    .datte-confirm-btn-ok { background: #3d3d3c; color: white; border-color: #3d3d3c; display: flex; align-items: center; gap: 6px; }
    .datte-confirm-btn-ok:hover { background: #2d2d2c; }
    .datte-enter-icon { width: 16px; height: 16px; flex-shrink: 0; }
  `,
    statusDisplay: `
    .datte-download-status-container { margin-top: 20px; padding: 15px; background: #f9f9f9; border-radius: 8px; border: 1px solid #e0e0e0; }
    .datte-download-status-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
    .datte-download-status-title { font-family: "Husqvarna Gothic", Arial, sans-serif; font-size: 14px; font-weight: 600; color: #3d3d3c; }
    .datte-download-status-clear-btn { background: transparent; border: none; cursor: pointer; padding: 4px 8px; border-radius: 4px; transition: background-color 0.2s ease; display: flex; align-items: center; gap: 4px; font-family: "Husqvarna Gothic", Arial, sans-serif; font-size: 13px; color: #666; }
    .datte-download-status-clear-btn:hover { background: #e0e0e0; }
    .datte-download-status-list { display: flex; flex-wrap: wrap; gap: 8px; }
    .datte-download-status-item { display: inline-flex; align-items: center; gap: 8px; padding: 8px 16px; border-radius: 8px; border: 1px solid #3d3d3c; font-family: "Husqvarna Gothic", Arial, sans-serif; font-size: 13px; font-weight: 500; transition: all 0.2s ease; white-space: nowrap; }
    .datte-download-status-item.status-pending { background: #fff3cd; border-color: #ffc107; color: #856404; }
    .datte-download-status-item.status-loading { background: #6f6f6f; border-color: #6f6f6f; color: white; }
    .datte-download-status-item.status-success { background: #28a745; border-color: #28a745; color: white; }
    .datte-download-status-item.status-error { background: #dc3545; border-color: #dc3545; color: white; }
    .datte-download-status-number { font-family: monospace; font-weight: 600; }
    .datte-download-status-icon { flex-shrink: 0; display: flex; align-items: center; }
  `,
    modeToggle: `
    .datte-mode-toggle { display: inline-flex; border: 1px solid #3d3d3c; border-radius: 8px; overflow: hidden; margin-bottom: 16px; }
    .datte-mode-btn { padding: 8px 20px; font-family: "Husqvarna Gothic", Arial, sans-serif; font-size: 13px; text-transform: uppercase; cursor: pointer; border: none; background: white; color: #3d3d3c; transition: all 0.2s ease; }
    .datte-mode-btn.active { background: #3d3d3c; color: white; }
    .datte-mode-btn:hover:not(.active) { background: #f5f5f5; }
  `,
    addButton: `
    a.add-btn { display: inline-flex; align-items: center; gap: .5rem; cursor: pointer; text-decoration: none; margin-left: 12px; border-radius: 8px; padding: 12px 24px; border: 1px solid #3d3d3c; font-family: "Husqvarna Gothic", Arial, sans-serif; line-height: 16px; font-size: 14px; text-transform: uppercase; transition: all 0.2s ease; }
    a.add-btn.selected { background-color: #28a745; border-color: #28a745; color: white; }
    a.add-btn:hover:not(.selected) { background: #f5f5f5; }
  `,
    downloadAllBar: `
    .datte-download-all-bar { display: flex; align-items: center; justify-content: space-between; padding: 12px 20px; margin-top: 12px; background: #f0f0f0; border-radius: 8px; border: 1px solid #e0e0e0; font-family: "Husqvarna Gothic", Arial, sans-serif; }
    .datte-download-all-count { font-size: 14px; font-weight: 600; color: #3d3d3c; }
    .datte-download-all-actions { display: flex; gap: 12px; }
  `,
    mergedModal: `
    .datte-merged-modal { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 10000; animation: fadeIn 0.2s ease; }
    .datte-merged-dialog { background: white; border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.3); width: 700px; max-width: 95vw; max-height: 85vh; display: flex; flex-direction: column; animation: slideIn 0.2s ease; }
    .datte-merged-header { padding: 20px; border-bottom: 1px solid #e0e0e0; display: flex; justify-content: space-between; align-items: center; }
    .datte-merged-close-btn { background: none; border: none; cursor: pointer; padding: 4px; border-radius: 4px; color: #666; transition: color 0.2s; }
    .datte-merged-close-btn:hover { color: #333; }
    .datte-merged-title { font-family: "Husqvarna Gothic", Arial, sans-serif; font-size: 18px; font-weight: 600; color: #3d3d3c; }
    .datte-merged-body { padding: 20px; overflow-y: auto; flex: 1; }
    .datte-merged-table { width: 100%; border-collapse: collapse; font-family: "Husqvarna Gothic", Arial, sans-serif; font-size: 13px; }
    .datte-merged-table th { text-align: left; padding: 8px 12px; border-bottom: 2px solid #3d3d3c; font-weight: 600; text-transform: uppercase; font-size: 12px; color: #666; }
    .datte-merged-table td { padding: 8px 12px; border-bottom: 1px solid #e0e0e0; vertical-align: middle; }
    .datte-merged-table input { width: 100%; padding: 6px 10px; border: 1px solid #ccc; border-radius: 4px; font-family: "Husqvarna Gothic", Arial, sans-serif; font-size: 13px; }
    .datte-merged-table input:focus { outline: none; border-color: #3d3d3c; }
    .datte-merged-status { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 4px; font-size: 12px; font-weight: 500; white-space: nowrap; }
    .datte-merged-status.status-pending { background: #fff3cd; color: #856404; }
    .datte-merged-status.status-loading { background: #6f6f6f; color: white; }
    .datte-merged-status.status-success { background: #28a745; color: white; }
    .datte-merged-status.status-error { background: #dc3545; color: white; }
    .datte-merged-footer { padding: 15px 20px; border-top: 1px solid #e0e0e0; display: flex; justify-content: space-between; align-items: center; }
    .datte-merged-warning { padding: 12px 16px; margin-bottom: 12px; background: #fff3cd; border: 1px solid #ffc107; border-radius: 6px; font-family: "Husqvarna Gothic", Arial, sans-serif; font-size: 13px; color: #856404; }
    .datte-merged-warning-actions { display: flex; gap: 12px; margin-top: 10px; }
  `,
    animations: `
    .loading-spinner { animation: spin 1s linear infinite; }
    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes slideIn { from { transform: translateY(-20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
  `
  };
  function applyStyles() {
    Object.values(Styles).forEach((css) => GM_addStyle(css));
  }
  const Config = {
    business: {
      DISCOUNT_FACTOR: 0.97,
      MAX_MULTI_ORDER_LIMIT: 20
    },
    timing: {
      DEBOUNCE_DELAY: 120,
      RETRY_DELAY_BASE: 1e3
    },
    download: {
      MAX_RETRY_ATTEMPTS: 5,
      MAX_CONCURRENT_DOWNLOADS: 2,
      MAX_RETRY_FULL: 3,
      MAX_RETRY_TOTAL: 6
    },
    ui: {
      LOADING_TEXT: "Exportiere..."
    }
  };
  function extractOrderNumber() {
    var _a;
    const headingElement = document.querySelector('[data-testid="order-detail-page"] h1');
    if (headingElement) {
      const headingMatch = (_a = headingElement.textContent) == null ? void 0 : _a.match(/(\d{6,})/);
      if (headingMatch) return headingMatch[1];
    }
    const queryMatch = location.search.match(/[?&]order=(\d{6,})/);
    if (queryMatch) return queryMatch[1];
    const detailNumber = Array.from(document.querySelectorAll("p")).map((p) => {
      var _a2;
      return ((_a2 = p.textContent) == null ? void 0 : _a2.trim()) || "";
    }).find((text) => /^\d{6,}$/.test(text));
    if (detailNumber) return detailNumber;
    const pathMatch = location.pathname.match(/\/de\/orders\/(\d{6,})/);
    if (pathMatch) return pathMatch[1];
    return "";
  }
  function extractSiteName() {
    var _a;
    const redirectLink = document.querySelector('a[href*="/b2b/products/redirect/"]');
    if (redirectLink) {
      const urlMatch = (_a = redirectLink.getAttribute("href")) == null ? void 0 : _a.match(/\/b2b\/products\/redirect\/([^/]+)\//);
      if (urlMatch) return urlMatch[1];
    }
    return "b2b-de-de-de";
  }
  function isOrderListPage() {
    return !!document.querySelector('[data-testid="order-list-page"]') && !!document.querySelector('div[role="table"]');
  }
  function extractOrderIdFromHref(href) {
    if (!href) return "";
    const match = href.match(/orderId=(\d+)/);
    return match ? match[1] : "";
  }
  const ICONS = {
    spinner: '<svg class="loading-spinner" xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" stroke-dasharray="31.416" stroke-dashoffset="31.416" fill="none" opacity="0.25"/><path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/></svg>',
    success: '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>',
    error: '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 6l12 12M6 18L18 6"/></svg>',
    clock: '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6l4 2"/><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" fill="none"/></svg>',
    download: '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" fill="none" viewBox="0 0 28 28"><path fill="currentColor" d="M27.003 20a1 1 0 0 1 .992.884l.007.116L28 26.003a2 2 0 0 1-1.85 1.994l-.15.005H2a2 2 0 0 1-1.995-1.85L0 26.002V21a1 1 0 0 1 1.993-.117L2 21v5.002h24L26.002 21a1 1 0 0 1 1-1m-13-20a1 1 0 0 1 .992.883l.007.117v16.585l6.293-6.292a1 1 0 0 1 1.492 1.327l-.078.087-8 8a1 1 0 0 1-.085.076l-.009.007-.028.021a1 1 0 0 1-.075.05l-.026.014a1 1 0 0 1-.08.04l-.038.016-.051.018-.018.006a1 1 0 0 1-.124.03l-.027.004a1 1 0 0 1-.146.011h-.033l-.052-.004.085.004a1 1 0 0 1-.18-.016h-.002l-.023-.005-.059-.014-.032-.01h-.002l-.014-.005a1 1 0 0 1-.095-.036l-.003-.002-.018-.008-.045-.023-.036-.02-.004-.003q0 .002-.005-.003l-.01-.006-.065-.044-.024-.018a1 1 0 0 1-.09-.08l-8-8a1 1 0 0 1 1.327-1.492l.087.078 6.293 6.292V1a1 1 0 0 1 1-1"></path></svg>',
    pending14: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16"><circle cx="8" cy="8" r="7" stroke="currentColor" stroke-width="1.5" fill="none"/><path d="M8 4v4l3 2" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/></svg>',
    spinner14: '<svg class="loading-spinner" xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" stroke-dasharray="31.416" stroke-dashoffset="31.416" fill="none" opacity="0.25"/><path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/></svg>',
    success14: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"/></svg>',
    error14: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M6 6l12 12M6 18L18 6"/></svg>',
    enter: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="datte-enter-icon"><polyline points="9 10 4 15 9 20" /><path d="M20 4v7a4 4 0 0 1-4 4H4" /></svg>',
    close: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16"><path d="M2.146 2.854a.5.5 0 1 1 .708-.708L8 7.293l5.146-5.147a.5.5 0 0 1 .708.708L8.707 8l5.147 5.146a.5.5 0 0 1-.708.708L8 8.707l-5.146 5.147a.5.5 0 0 1-.708-.708L7.293 8 2.146 2.854Z"/></svg>',
    plus: '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 5v14M5 12h14"/></svg>',
    check: '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>'
  };
  function getStatusIcon(status) {
    switch (status) {
      case "pending":
        return ICONS.pending14;
      case "loading":
        return ICONS.spinner14;
      case "success":
        return ICONS.success14;
      case "error":
        return ICONS.error14;
      default:
        return "";
    }
  }
  function showConfirmModal(orderNumbers, inputElement) {
    return new Promise((resolve) => {
      const sortedNumbers = [...orderNumbers].sort((a, b) => a.localeCompare(b));
      const modal = document.createElement("div");
      modal.className = "datte-confirm-modal";
      modal.innerHTML = `
      <div class="datte-confirm-dialog">
        <div class="datte-confirm-header">
          <div class="datte-confirm-title">
            ${orderNumbers.length} Aufträge herunterladen?
            <span class="datte-muted">(Enter zum Bestätigen)</span>
          </div>
        </div>
        <div class="datte-confirm-body">
          <p>Möchten Sie wirklich ${orderNumbers.length} Aufträge herunterladen?</p>
          <div class="datte-confirm-order-list">${sortedNumbers.join(", ")}</div>
        </div>
        <div class="datte-confirm-actions">
          <button class="datte-confirm-btn datte-confirm-btn-cancel">Abbrechen</button>
          <button class="datte-confirm-btn datte-confirm-btn-ok">${ICONS.enter} OK - Herunterladen</button>
        </div>
      </div>
    `;
      document.body.appendChild(modal);
      const cancelBtn = modal.querySelector(".datte-confirm-btn-cancel");
      const okBtn = modal.querySelector(".datte-confirm-btn-ok");
      const cleanup = () => {
        document.removeEventListener("keydown", handleKeyPress);
        modal.remove();
      };
      const handleCancel = () => {
        cleanup();
        if (inputElement) inputElement.focus();
        resolve(false);
      };
      const handleConfirm = () => {
        cleanup();
        resolve(true);
      };
      cancelBtn.addEventListener("click", handleCancel);
      okBtn.addEventListener("click", handleConfirm);
      const handleKeyPress = (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          handleConfirm();
        } else if (e.key === "Escape") {
          e.preventDefault();
          handleCancel();
        }
      };
      document.addEventListener("keydown", handleKeyPress);
      modal.addEventListener("click", (e) => {
        if (e.target === modal) handleCancel();
      });
      okBtn.focus();
    });
  }
  function generateCsv(data, separator = ";") {
    return $.csv.fromObjects(data, { separator });
  }
  function downloadCsvBlob(csvContent, filename) {
    const url = URL.createObjectURL(new Blob([csvContent], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1e4);
  }
  const State = {
    orderCache: /* @__PURE__ */ new Map(),
    activeDownloads: /* @__PURE__ */ new Set(),
    downloadQueue: [],
    retryCounters: /* @__PURE__ */ new Map(),
    downloadStatusItems: /* @__PURE__ */ new Map()
  };
  function gmFetch(url, options = {}) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: options.method || "GET",
        url,
        headers: options.headers || {},
        data: options.body,
        responseType: "json",
        onload(response) {
          if (response.status >= 200 && response.status < 300) {
            resolve({
              ok: true,
              status: response.status,
              json: () => Promise.resolve(response.response)
            });
          } else {
            reject(new Error(`HTTP ${response.status}`));
          }
        },
        onerror() {
          reject(new Error("Network error"));
        },
        ontimeout() {
          reject(new Error("Request timeout"));
        }
      });
    });
  }
  const GQL_QUERY = `
  query getDetailedClosedOrder($siteName: String!, $orderNumber: ID!) {
    site(name: $siteName) {
      commerce {
        orders {
          get(orderId: $orderNumber) {
            customerOrderNumber
            orderNumber
            orderLines {
              ecomArticleDescription
              customerOrderLineReference
              requestedQuantity
              requestedDispatchDate
              unformattedArticleNumber
              totalGrossPrice
              totalNetPrice
              article {
                id
                name
                articleDescription
              }
              deliveryLines {
                deliveryQuantity
                promisedDispatchDate
                shipmentInfos { shipmentTrackingUrl }
              }
            }
          }
        }
      }
    }
  }`;
  const GQL_QUERY_LITE = `
  query getDetailedClosedOrder($siteName: String!, $orderNumber: ID!) {
    site(name: $siteName) {
      commerce {
        orders {
          get(orderId: $orderNumber) {
            customerOrderNumber
            orderNumber
            orderLines {
              ecomArticleDescription
              customerOrderLineReference
              requestedQuantity
              requestedDispatchDate
              unformattedArticleNumber
              totalGrossPrice
              totalNetPrice
              article {
                id
                name
                articleDescription
              }
            }
          }
        }
      }
    }
  }`;
  function shouldRetryError(error) {
    const message = error.message || "";
    if (error.name === "NetworkError" || message.includes("Failed to fetch")) return true;
    if (message.includes("GraphQL: leere Antwort")) return true;
    if (message.includes("500") || message.includes("502") || message.includes("503") || message.includes("504")) return true;
    if (message.includes("timeout")) return true;
    if (message.includes("401") || message.includes("403") || message.includes("404")) return false;
    if (message.includes("Ungültige Bestellnummer")) return false;
    if (message.includes("Download bereits aktiv")) return false;
    return true;
  }
  function handleExportError(error, orderNumber) {
    console.error(`Export error for order ${orderNumber}:`, error);
    const ctx = `Bestellung ${orderNumber}: `;
    if (error.name === "NetworkError" || error.message.includes("Failed to fetch")) return ctx + "Netzwerkfehler - bitte Internetverbindung prüfen";
    if (error.message.includes("401") || error.message.includes("403")) return ctx + "Authentifizierung fehlgeschlagen - bitte neu anmelden";
    if (error.message.includes("404")) return ctx + "Bestellung nicht gefunden";
    if (error.message.includes("500") || error.message.includes("502") || error.message.includes("503")) return ctx + "Server-Fehler - bitte später erneut versuchen";
    return ctx + `Export fehlgeschlagen: ${error.message || "Unbekannter Fehler"}`;
  }
  async function fetchOrderViaGraphQL(orderNumber, siteName, retryAttempt = 1, skipDeliveryLines = false) {
    var _a, _b, _c, _d;
    if (!validateOrderNumber(orderNumber)) {
      throw new Error("Ungültige Bestellnummer");
    }
    if (retryAttempt === 1) {
      const cacheKey = `${orderNumber}-${siteName}`;
      if (State.orderCache.has(cacheKey)) {
        return State.orderCache.get(cacheKey);
      }
    }
    if (State.activeDownloads.has(orderNumber)) {
      throw new Error("Download bereits aktiv für diese Bestellung");
    }
    State.activeDownloads.add(orderNumber);
    try {
      const body = {
        query: skipDeliveryLines ? GQL_QUERY_LITE : GQL_QUERY,
        variables: { siteName, orderNumber },
        operationName: "getDetailedClosedOrder"
      };
      const res = await gmFetch("https://portal.husqvarnagroup.com/hbd/graphql?", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body)
      });
      if (!res.ok) throw new Error(`GraphQL HTTP ${res.status}`);
      const json = await res.json();
      const order = (_d = (_c = (_b = (_a = json == null ? void 0 : json.data) == null ? void 0 : _a.site) == null ? void 0 : _b.commerce) == null ? void 0 : _c.orders) == null ? void 0 : _d.get;
      if (!order) throw new Error("GraphQL: leere Antwort");
      const cacheKey = `${orderNumber}-${siteName}`;
      State.orderCache.set(cacheKey, order);
      State.retryCounters.delete(orderNumber);
      return order;
    } finally {
      State.activeDownloads.delete(orderNumber);
    }
  }
  function mapGraphQLToRow(line) {
    var _a, _b, _c, _d, _e, _f;
    const firstDel = ((_a = line.deliveryLines) == null ? void 0 : _a[0]) ?? null;
    const delivered = firstDel == null ? void 0 : firstDel.deliveryQuantity;
    const requested = line.requestedQuantity;
    const anzKonf = `${delivered ?? requested ?? ""} / ${requested ?? ""}`;
    const promised = firstDel == null ? void 0 : firstDel.promisedDispatchDate;
    const versendet = formatDateFromISO(promised) || formatDateFromISO(line.requestedDispatchDate);
    const name = ((_b = line.article) == null ? void 0 : _b.name) || line.ecomArticleDescription;
    const beschreibung = ((_c = line.article) == null ? void 0 : _c.articleDescription) || "";
    const nameBeschreibung = (name + " " + beschreibung).trim();
    return {
      "Artikelnumer": line.unformattedArticleNumber || ((_d = line.article) == null ? void 0 : _d.id) || "",
      "Kommentar": line.customerOrderLineReference || "",
      "Beschreibung": nameBeschreibung,
      "Angefragt": formatDateFromISO(line.requestedDispatchDate),
      "Versendet": versendet,
      "Anz/Konf.": anzKonf,
      "Gesamt": line.totalNetPrice,
      "Tracking link": ((_f = (_e = firstDel == null ? void 0 : firstDel.shipmentInfos) == null ? void 0 : _e[0]) == null ? void 0 : _f.shipmentTrackingUrl) || ""
    };
  }
  function prepareCsvDataToExport(rows, innerOrderNumber, outerOrderNumber) {
    return rows.map((data) => {
      let vpe = parseInt(nullSafeMatch(data["Kommentar"], /^D-BE\S*\s*VPE=(\d+)/, 1), 10);
      if (!Number.isFinite(vpe) || vpe < 1) vpe = 1;
      const quantityRaw = (data["Anz/Konf."] || "").split("/")[0] || "";
      const quantity = parseInt(String(quantityRaw).replace(/\D+/g, ""), 10);
      const baseQuantity = Number.isFinite(quantity) ? quantity : 0;
      const totalQuantity = Math.max(1, baseQuantity * vpe);
      const totalPrice = data["Gesamt"];
      const purchasePriceNet = Number.isFinite(totalPrice) && totalQuantity > 0 ? totalPrice * Config.business.DISCOUNT_FACTOR / totalQuantity : NaN;
      return {
        "HAN": (data["Artikelnumer"] || "").replace(/^0+/g, "").replace(/\D+/g, ""),
        "Interne Bestellnummer": nullSafeString(innerOrderNumber).slice(0, 14),
        "Artikelnummer": nullSafeMatch(data["Kommentar"], /^D-BE\S*\s*(?:VPE=\d*)?\s*(\S*)/, 1),
        "Lieferantenbezeichnung": data["Beschreibung"] || "",
        "menge": totalQuantity,
        "EK netto": Number.isFinite(purchasePriceNet) ? purchasePriceNet.toFixed(4).replace(".", ",") : "",
        "Lieferdatum": formatGermanDate(data["Versendet"]),
        "Freiposition": "N",
        "Fremdbelegnummer": nullSafeString(outerOrderNumber)
      };
    });
  }
  function updateStatusDisplay() {
    const container = document.getElementById("datte-download-status-container");
    if (!container) return;
    container.style.display = State.downloadStatusItems.size > 0 ? "block" : "none";
  }
  function clearAllStatusItems() {
    State.downloadStatusItems.forEach((item) => item.remove());
    State.downloadStatusItems.clear();
    updateStatusDisplay();
  }
  function createStatusItem(orderNumber, status = "pending", _message = "In Warteschlange") {
    const list = document.getElementById("datte-download-status-list");
    if (!list) return;
    if (State.downloadStatusItems.has(orderNumber)) {
      updateStatusItem(orderNumber, status);
      return;
    }
    const item = document.createElement("div");
    item.className = `datte-download-status-item status-${status}`;
    item.id = `datte-status-${orderNumber}`;
    item.innerHTML = `
    <span class="datte-download-status-number">${orderNumber}</span>
    <span class="datte-download-status-icon">${getStatusIcon(status)}</span>
  `;
    list.appendChild(item);
    State.downloadStatusItems.set(orderNumber, item);
    updateStatusDisplay();
  }
  function updateStatusItem(orderNumber, status, _message) {
    const item = State.downloadStatusItems.get(orderNumber);
    if (!item) return;
    item.className = `datte-download-status-item status-${status}`;
    const iconEl = item.querySelector(".datte-download-status-icon");
    if (iconEl) iconEl.innerHTML = getStatusIcon(status);
  }
  function isMaxConcurrentDownloadsReached() {
    return State.activeDownloads.size >= Config.download.MAX_CONCURRENT_DOWNLOADS;
  }
  function processDownloadQueue() {
    if (State.downloadQueue.length === 0 || isMaxConcurrentDownloadsReached()) return;
    const queueItem = State.downloadQueue.shift();
    startDownload(queueItem);
  }
  function enqueueDownload(queueItem) {
    if (State.activeDownloads.has(queueItem.orderNumber) || State.downloadQueue.some((item) => item.orderNumber === queueItem.orderNumber)) {
      return;
    }
    State.downloadQueue.push(queueItem);
    updateQueuedButtonState(queueItem);
    processDownloadQueue();
  }
  function updateQueuedButtonState(queueItem) {
    const { $btn, iconSelector, textSelector } = queueItem;
    $btn.addClass("queued").attr("data-queued-state", "true");
    $btn.find(iconSelector).html(ICONS.clock);
    const $text = $btn.find(textSelector);
    if ($text.length > 0) $text.text("In Warteschlange");
  }
  function getButtonId(orderNumber) {
    return `export-btn-${orderNumber}`;
  }
  async function startDownload(queueItem) {
    const { orderNumber, siteName, filename, $btn, iconSelector, textSelector, retryAttempt = 1, isCustomOrderInput = false } = queueItem;
    const buttonId = getButtonId(orderNumber);
    $btn.removeClass("queued error").removeAttr("data-queued-state data-error-state").addClass("loading").attr("data-button-id", buttonId);
    const $icon = $btn.find(iconSelector);
    const $text = $btn.find(textSelector);
    $icon.html(ICONS.spinner);
    if ($text.length > 0) {
      $text.text(retryAttempt >= 2 ? `${Config.ui.LOADING_TEXT} (${retryAttempt})` : Config.ui.LOADING_TEXT);
    }
    if (isCustomOrderInput) {
      updateStatusItem(orderNumber, "loading");
    }
    try {
      const order = await fetchOrderViaGraphQL(orderNumber, siteName, retryAttempt);
      const innerOrderNumber = order.customerOrderNumber && order.customerOrderNumber !== "-" ? order.customerOrderNumber : order.orderNumber;
      const outerOrderNumber = order.orderNumber;
      const rows = (order.orderLines || []).map(mapGraphQLToRow);
      const csv = generateCsv(prepareCsvDataToExport(rows, innerOrderNumber, outerOrderNumber));
      downloadCsvBlob(csv, filename);
      $btn.removeClass("loading").addClass("success").attr("data-success-state", "true");
      $icon.html(ICONS.success);
      if ($text.length > 0) $text.text("Erfolgreich!");
      if (isCustomOrderInput) updateStatusItem(orderNumber, "success", "Erfolgreich heruntergeladen");
    } catch (error) {
      const err = error;
      if (retryAttempt < Config.download.MAX_RETRY_ATTEMPTS && shouldRetryError(err)) {
        const nextAttempt = retryAttempt + 1;
        const delay = Config.timing.RETRY_DELAY_BASE * Math.pow(2, retryAttempt - 1);
        console.log(`Retry attempt ${nextAttempt} for order ${orderNumber} in ${delay}ms`);
        State.retryCounters.set(orderNumber, nextAttempt);
        setTimeout(() => startDownload({ ...queueItem, retryAttempt: nextAttempt }), delay);
        return;
      }
      const userMessage = handleExportError(err, orderNumber);
      State.retryCounters.delete(orderNumber);
      $btn.removeClass("loading").addClass("error").attr("data-error-state", "true");
      $icon.html(ICONS.error);
      if ($text.length > 0) {
        $text.text(retryAttempt >= 2 ? `Fehler! (${retryAttempt}/${Config.download.MAX_RETRY_ATTEMPTS})` : "Fehler!");
      }
      if (isCustomOrderInput) updateStatusItem(orderNumber, "error", err.message || "Fehler beim Download");
      console.error(userMessage);
    } finally {
      State.activeDownloads.delete(orderNumber);
      setTimeout(() => processDownloadQueue(), 100);
    }
  }
  function createExportHandler(iconSelector, textSelector, orderNumber, filename, $btn) {
    return (e) => {
      e.preventDefault();
      if (State.activeDownloads.has(orderNumber)) return;
      if ($btn.hasClass("error") || $btn.attr("data-error-state") === "true") {
        $btn.removeClass("error").removeAttr("data-error-state");
        State.retryCounters.delete(orderNumber);
      }
      if ($btn.hasClass("queued") || $btn.attr("data-queued-state") === "true") {
        $btn.removeClass("queued").removeAttr("data-queued-state");
        const idx = State.downloadQueue.findIndex((item) => item.orderNumber === orderNumber);
        if (idx !== -1) State.downloadQueue.splice(idx, 1);
      }
      const queueItem = {
        orderNumber,
        siteName: extractSiteName(),
        filename,
        $btn,
        iconSelector,
        textSelector,
        originalIcon: $btn.find(iconSelector).html() || "",
        originalText: $btn.find(textSelector).text() || "",
        retryAttempt: 1
      };
      if (isMaxConcurrentDownloadsReached()) {
        enqueueDownload(queueItem);
      } else {
        startDownload(queueItem);
      }
    };
  }
  const UNSET = "__GM_STORE_UNSET__";
  function createStore(prefix, schema) {
    const prefixedKey = (key) => `${prefix}.${key}`;
    return {
      get(key) {
        const def = schema[key];
        const raw = GM_getValue(prefixedKey(key), UNSET);
        if (raw === UNSET) return def.default;
        if (def.serializer) return def.serializer.deserialize(raw);
        return raw;
      },
      set(key, value) {
        const def = schema[key];
        if (def.serializer) {
          GM_setValue(prefixedKey(key), def.serializer.serialize(value));
        } else {
          GM_setValue(prefixedKey(key), value);
        }
      },
      remove(key) {
        GM_deleteValue(prefixedKey(key));
      }
    };
  }
  function mapSerializer() {
    return {
      serialize: (map) => JSON.stringify([...map.entries()]),
      deserialize: (raw) => new Map(JSON.parse(raw))
    };
  }
  const store = createStore("husqvarna", {
    mode: {
      default: "single"
    },
    orderNameOverrides: {
      default: /* @__PURE__ */ new Map(),
      serializer: mapSerializer()
    }
  });
  const MergedState = {
    get mode() {
      return store.get("mode");
    },
    set mode(v) {
      store.set("mode", v);
    },
    selectedOrders: /* @__PURE__ */ new Map(),
    isDownloading: false,
    modalOpen: false
  };
  function createMergedOrderEntry(orderNumber) {
    return {
      orderNumber,
      status: "pending",
      retryAttempt: 0,
      customerOrderNumber: "",
      userOverrideOrderNumber: "",
      orderData: null,
      errorMessage: "",
      usedLiteQuery: false
    };
  }
  const MAX_CONCURRENT = Config.download.MAX_CONCURRENT_DOWNLOADS;
  const MAX_RETRY_FULL = Config.download.MAX_RETRY_FULL;
  const MAX_RETRY_TOTAL = Config.download.MAX_RETRY_TOTAL;
  async function startMergedDownloads(onStatusChange) {
    if (MergedState.isDownloading) return;
    MergedState.isDownloading = true;
    const siteName = extractSiteName();
    const entries = Array.from(MergedState.selectedOrders.values()).filter((e) => e.status !== "success");
    const queue = [...entries];
    const active = [];
    const processNext = async () => {
      while (queue.length > 0) {
        const entry = queue.shift();
        await downloadSingleOrder(entry, siteName, onStatusChange);
      }
    };
    for (let i = 0; i < Math.min(MAX_CONCURRENT, queue.length); i++) {
      active.push(processNext());
    }
    await Promise.all(active);
    MergedState.isDownloading = false;
  }
  async function downloadSingleOrder(entry, siteName, onStatusChange) {
    entry.status = "loading";
    entry.retryAttempt = 1;
    onStatusChange(entry.orderNumber, entry);
    for (let attempt = 1; attempt <= MAX_RETRY_TOTAL; attempt++) {
      entry.retryAttempt = attempt;
      entry.status = "loading";
      onStatusChange(entry.orderNumber, entry);
      const skipDeliveryLines = attempt > MAX_RETRY_FULL;
      try {
        const order = await fetchOrderViaGraphQL(entry.orderNumber, siteName, attempt, skipDeliveryLines);
        if (skipDeliveryLines && order.orderLines) {
          const todayISO = (/* @__PURE__ */ new Date()).toISOString();
          for (const line of order.orderLines) {
            if (!line.deliveryLines || line.deliveryLines.length === 0) {
              line.deliveryLines = [{
                deliveryQuantity: line.requestedQuantity,
                promisedDispatchDate: todayISO,
                shipmentInfos: []
              }];
            }
          }
          entry.usedLiteQuery = true;
        }
        entry.orderData = order;
        entry.customerOrderNumber = order.customerOrderNumber || "";
        if (!entry.userOverrideOrderNumber) {
          entry.userOverrideOrderNumber = entry.customerOrderNumber;
        }
        entry.status = "success";
        entry.errorMessage = "";
        onStatusChange(entry.orderNumber, entry);
        return;
      } catch (error) {
        const err = error;
        entry.errorMessage = err.message || "Unbekannter Fehler";
        const isRetryable = shouldRetryError(err);
        if (!isRetryable || attempt >= MAX_RETRY_TOTAL) {
          entry.status = "error";
          onStatusChange(entry.orderNumber, entry);
          return;
        }
        const delay = Config.timing.RETRY_DELAY_BASE * Math.pow(2, attempt - 1);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
  function exportMergedCsv() {
    const allRows = [];
    const skippedOrders = [];
    let exported = 0;
    for (const entry of MergedState.selectedOrders.values()) {
      if (entry.status !== "success" || !entry.orderData) {
        skippedOrders.push(entry.orderNumber);
        continue;
      }
      const order = entry.orderData;
      const internalNumber = entry.userOverrideOrderNumber.trim() || entry.customerOrderNumber || entry.orderNumber;
      const outerNumber = order.orderNumber || entry.orderNumber;
      const rows = (order.orderLines || []).map(mapGraphQLToRow);
      const csvRows = prepareCsvDataToExport(rows, internalNumber, outerNumber);
      allRows.push(...csvRows);
      exported++;
    }
    if (allRows.length > 0) {
      const csv = generateCsv(allRows);
      const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
      downloadCsvBlob(csv, `Sammelexport_${today}.csv`);
    }
    return { exported, skipped: skippedOrders.length, skippedOrders };
  }
  function getFailedOrPendingOrders() {
    const result = [];
    for (const entry of MergedState.selectedOrders.values()) {
      if (entry.status !== "success") result.push(entry.orderNumber);
    }
    return result;
  }
  function openMergedDownloadModal() {
    if (MergedState.modalOpen) return;
    MergedState.modalOpen = true;
    const entries = Array.from(MergedState.selectedOrders.values());
    const modal = document.createElement("div");
    modal.className = "datte-merged-modal";
    modal.innerHTML = `
    <div class="datte-merged-dialog">
      <div class="datte-merged-header">
        <span class="datte-merged-title">Sammel-Export (${entries.length} Bestellungen)</span>
        <button class="datte-merged-close-btn" title="Schließen">${ICONS.error}</button>
      </div>
      <div class="datte-merged-body">
        <div id="datte-merged-warning" class="datte-merged-warning" style="display:none;"></div>
        <table class="datte-merged-table">
          <thead>
            <tr>
              <th>Auftragsnr.</th>
              <th>Interne Bestellnr.</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody id="datte-merged-tbody">
            ${entries.map((e) => renderRow(e)).join("")}
          </tbody>
        </table>
      </div>
      <div class="datte-merged-footer">
        <button class="datte-confirm-btn datte-confirm-btn-cancel" id="datte-merged-close">Schließen</button>
        <div style="display:flex;gap:12px;">
          <button class="datte-confirm-btn datte-confirm-btn-ok" id="datte-merged-csv-export" style="background:#2563eb;border-color:#2563eb;">CSV-Export</button>
          <button class="datte-confirm-btn datte-confirm-btn-ok" id="datte-merged-start">Download starten</button>
        </div>
      </div>
    </div>
  `;
    document.body.appendChild(modal);
    entries.forEach((entry) => {
      const input = document.getElementById(`datte-merged-input-${entry.orderNumber}`);
      if (input) {
        input.addEventListener("input", () => {
          entry.userOverrideOrderNumber = input.value;
          const overrides = store.get("orderNameOverrides");
          overrides.set(entry.orderNumber, input.value);
          store.set("orderNameOverrides", overrides);
        });
      }
    });
    const closeModal = () => {
      if (MergedState.isDownloading) {
        if (!confirm("Downloads laufen noch. Wirklich schließen?")) return;
      }
      document.removeEventListener("keydown", handleKey);
      modal.remove();
      MergedState.modalOpen = false;
    };
    modal.querySelector(".datte-merged-close-btn").addEventListener("click", closeModal);
    document.getElementById("datte-merged-close").addEventListener("click", closeModal);
    modal.addEventListener("click", (e) => {
      if (e.target === modal) closeModal();
    });
    const handleKey = (e) => {
      if (e.key === "Escape") {
        closeModal();
        document.removeEventListener("keydown", handleKey);
      }
    };
    document.addEventListener("keydown", handleKey);
    document.getElementById("datte-merged-start").addEventListener("click", async () => {
      const startBtn = document.getElementById("datte-merged-start");
      startBtn.disabled = true;
      startBtn.textContent = "Downloads laufen...";
      await startMergedDownloads((orderNumber, entry) => {
        updateModalRow(orderNumber, entry);
      });
      startBtn.textContent = "Download starten";
      startBtn.disabled = false;
    });
    document.getElementById("datte-merged-csv-export").addEventListener("click", () => {
      const failedOrders = getFailedOrPendingOrders();
      const warningEl = document.getElementById("datte-merged-warning");
      if (failedOrders.length > 0) {
        warningEl.style.display = "block";
        warningEl.innerHTML = `
        <strong>⚠ Nicht alle Bestellungen wurden heruntergeladen.</strong><br>
        Folgende fehlen: <strong>${failedOrders.join(", ")}</strong><br>
        <div class="datte-merged-warning-actions">
          <button class="datte-confirm-btn datte-confirm-btn-cancel" id="datte-merged-warning-cancel">Abbrechen</button>
          <button class="datte-confirm-btn datte-confirm-btn-ok" id="datte-merged-warning-confirm" style="background:#e67e22;border-color:#e67e22;">Trotzdem exportieren</button>
        </div>
      `;
        document.getElementById("datte-merged-warning-cancel").addEventListener("click", () => {
          warningEl.style.display = "none";
        });
        document.getElementById("datte-merged-warning-confirm").addEventListener("click", () => {
          warningEl.style.display = "none";
          exportMergedCsv();
        });
      } else {
        exportMergedCsv();
      }
    });
  }
  function renderRow(entry) {
    const overrides = store.get("orderNameOverrides");
    const savedOverride = overrides.get(entry.orderNumber);
    if (savedOverride !== void 0) {
      entry.userOverrideOrderNumber = savedOverride;
    }
    const statusClass = `status-${entry.status}`;
    const statusText = getStatusText(entry);
    const icon = getStatusIcon(entry.status);
    return `
    <tr id="datte-merged-row-${entry.orderNumber}">
      <td><strong>${entry.orderNumber}</strong></td>
      <td><input type="text" id="datte-merged-input-${entry.orderNumber}"
           value="${entry.userOverrideOrderNumber}"
           placeholder="Wird nach Download gefüllt"></td>
      <td><span class="datte-merged-status ${statusClass}">
        <span class="datte-merged-status-icon">${icon}</span>
        <span class="datte-merged-status-text">${statusText}</span>
      </span></td>
    </tr>
  `;
  }
  function updateModalRow(orderNumber, entry) {
    const row = document.getElementById(`datte-merged-row-${orderNumber}`);
    if (!row) return;
    const statusSpan = row.querySelector(".datte-merged-status");
    if (statusSpan) {
      statusSpan.className = `datte-merged-status status-${entry.status}`;
      const iconEl = statusSpan.querySelector(".datte-merged-status-icon");
      const textEl = statusSpan.querySelector(".datte-merged-status-text");
      if (iconEl) iconEl.innerHTML = getStatusIcon(entry.status);
      if (textEl) textEl.textContent = getStatusText(entry);
    }
    const input = document.getElementById(`datte-merged-input-${orderNumber}`);
    if (input && entry.status === "success" && !input.value) {
      const autoValue = entry.userOverrideOrderNumber || entry.customerOrderNumber;
      input.value = autoValue;
      if (autoValue) {
        const overrides = store.get("orderNameOverrides");
        overrides.set(entry.orderNumber, autoValue);
        store.set("orderNameOverrides", overrides);
      }
    }
  }
  function getStatusText(entry) {
    switch (entry.status) {
      case "pending":
        return "Ausstehend";
      case "loading":
        return entry.retryAttempt > 1 ? `Lade... (${entry.retryAttempt}/6)` : "Lade...";
      case "success":
        return entry.usedLiteQuery ? "Erfolgreich (ohne Lieferzeiten)" : "Erfolgreich";
      case "error":
        return `Fehler (${entry.retryAttempt}/6)`;
      default:
        return "";
    }
  }
  let barElement = null;
  function createDownloadAllBar(container) {
    if (document.getElementById("datte-download-all-bar")) return;
    const bar = document.createElement("div");
    bar.id = "datte-download-all-bar";
    bar.className = "datte-download-all-bar";
    bar.style.display = MergedState.mode === "merged" ? "flex" : "none";
    bar.innerHTML = `
    <span class="datte-download-all-count" id="datte-download-all-count">
      0 Bestellungen ausgewählt
    </span>
    <div class="datte-download-all-actions">
      <button class="datte-confirm-btn datte-confirm-btn-cancel" id="datte-clear-selection">
        Auswahl leeren
      </button>
      <button class="datte-confirm-btn datte-confirm-btn-ok" id="datte-download-all-btn" disabled>
        Download All
      </button>
    </div>
  `;
    const modeToggle = container.querySelector(".datte-mode-toggle");
    if (modeToggle && modeToggle.nextSibling) {
      container.insertBefore(bar, modeToggle.nextSibling);
    } else {
      container.appendChild(bar);
    }
    barElement = bar;
    document.getElementById("datte-clear-selection").addEventListener("click", () => {
      MergedState.selectedOrders.clear();
      updateDownloadAllBar();
      document.querySelectorAll(".add-btn.selected").forEach((btn) => {
        btn.classList.remove("selected");
        const icon = btn.querySelector(".add-icon");
        const text = btn.querySelector(".add-text");
        if (icon) icon.innerHTML = getPlusIcon();
        if (text) text.textContent = "Hinzufügen";
      });
    });
    document.getElementById("datte-download-all-btn").addEventListener("click", () => {
      if (MergedState.selectedOrders.size === 0) return;
      openMergedDownloadModal();
    });
  }
  function updateDownloadAllBar() {
    const count = MergedState.selectedOrders.size;
    const countEl = document.getElementById("datte-download-all-count");
    if (countEl) {
      countEl.textContent = `${count} Bestellung${count !== 1 ? "en" : ""} ausgewählt`;
    }
    const btn = document.getElementById("datte-download-all-btn");
    if (btn) {
      btn.disabled = count === 0;
    }
  }
  function showDownloadAllBar() {
    const bar = barElement || document.getElementById("datte-download-all-bar");
    if (bar) bar.style.display = "flex";
  }
  function hideDownloadAllBar() {
    const bar = barElement || document.getElementById("datte-download-all-bar");
    if (bar) bar.style.display = "none";
  }
  function getPlusIcon() {
    return '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 5v14M5 12h14"/></svg>';
  }
  function attachExportButtonToNewLayout() {
    const $page = $('[data-testid="order-detail-page"]').first();
    if (!$page.length) return;
    const $bar = $page.find("h1").parent().find("h1 ~ div").first();
    if (!$bar.length || $bar.find(".export-btn").length) return;
    const orderNumber = extractOrderNumber();
    const filename = sanitizeFilename(orderNumber);
    const $btn = $(`
    <a class="export-btn" data-variant="secondary" data-size="compact" download="${filename}" title="Export CSV für JTL (API)">
      <span class="export-icon" aria-hidden="true">${ICONS.download}</span>
      <span class="export-text">Export CSV für JTL</span>
    </a>
  `);
    $btn.on("click", createExportHandler(".export-icon", ".export-text", orderNumber, filename, $btn));
    $bar.append($btn);
  }
  function attachExportButtonToOldModal() {
    const $root = $("div#ui-modal-target");
    if (!$root.length) return;
    const $modal = $root.find("article").first();
    if (!$modal.length) return;
    const $header = $modal.find("header");
    const $headerDiv = $header.find("div").first();
    if (!$headerDiv.length || $header.find(".export-btn").length) return;
    $headerDiv.css({ display: "flex", justifyContent: "space-between", alignItems: "center" });
    const orderNumber = extractOrderNumber();
    const filename = sanitizeFilename(orderNumber);
    const $btn = $(`
    <a class="export-btn" data-variant="secondary" data-size="compact" download="${filename}">
      <span class="export-icon" aria-hidden="true">${ICONS.download}</span>
      <span class="export-text">Export CSV für JTL</span>
    </a>
  `);
    $btn.on("click", createExportHandler(".export-icon", ".export-text", orderNumber, filename, $btn));
    $headerDiv.append($btn);
  }
  function attachExportButtonsToOrderList() {
    const table = document.querySelector('[data-testid="order-list-page"] div[role="table"]');
    if (!table) return;
    const rows = table.querySelectorAll('div[role="row"]:not(.b2b-tm)');
    rows.forEach((row) => {
      const detailLink = row.querySelector('a[data-testid="view-order-details-link"]');
      if (!detailLink) return;
      const orderNumber = extractOrderIdFromHref(detailLink.href);
      if (!orderNumber || !validateOrderNumber(orderNumber)) return;
      const arrowCell = row.querySelector('div[role="cell"]:last-child');
      if (!arrowCell) return;
      if (MergedState.mode === "merged") {
        if (row.querySelector(".add-btn")) return;
        renderAddButton(arrowCell, orderNumber);
      } else {
        if (row.querySelector(".export-btn")) return;
        const filename = sanitizeFilename(orderNumber);
        const $downloadBtn = $(`
        <a class="export-btn" data-variant="secondary" data-size="compact" download="${filename}"
           title="CSV Export für Bestellung ${orderNumber}" style="margin-left: 12px;">
          <span class="export-icon" aria-hidden="true">${ICONS.download}</span>
          <span style="width: max-content" class="export-text">JTL Export</span>
        </a>
      `);
        $downloadBtn.on("click", createExportHandler(".export-icon", ".export-text", orderNumber, filename, $downloadBtn));
        $(arrowCell).append($downloadBtn);
      }
    });
  }
  function replaceAllRowButtons() {
    const table = document.querySelector('[data-testid="order-list-page"] div[role="table"]');
    if (!table) return;
    table.querySelectorAll(".export-btn, .add-btn").forEach((btn) => btn.remove());
    attachExportButtonsToOrderList();
  }
  function renderAddButton(arrowCell, orderNumber) {
    const isSelected = MergedState.selectedOrders.has(orderNumber);
    const btn = document.createElement("a");
    btn.className = `add-btn${isSelected ? " selected" : ""}`;
    btn.innerHTML = `
    <span class="add-icon" aria-hidden="true">${isSelected ? ICONS.check : ICONS.plus}</span>
    <span class="add-text">${isSelected ? "Hinzugefügt" : "Hinzufügen"}</span>
  `;
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      if (MergedState.selectedOrders.has(orderNumber)) {
        MergedState.selectedOrders.delete(orderNumber);
        btn.classList.remove("selected");
        btn.querySelector(".add-icon").innerHTML = ICONS.plus;
        btn.querySelector(".add-text").textContent = "Hinzufügen";
      } else {
        MergedState.selectedOrders.set(orderNumber, createMergedOrderEntry(orderNumber));
        btn.classList.add("selected");
        btn.querySelector(".add-icon").innerHTML = ICONS.check;
        btn.querySelector(".add-text").textContent = "Hinzugefügt";
      }
      updateDownloadAllBar();
    });
    arrowCell.appendChild(btn);
  }
  function createCustomOrderInputUI(orderListPage) {
    console.log("[CustomOrderInput] Creating custom order input UI");
    const ordersDiv = document.createElement("div");
    ordersDiv.id = "orders";
    ordersDiv.className = "datte-custom-order-container";
    ordersDiv.innerHTML = `
    <div class="datte-custom-order-group">
      <div class="datte-custom-order-wrapper">
        <label for="datte-custom-order-number" class="datte-custom-order-label">
          <span>JTL-CSV-Export für mehrere Auftragsnummern</span>
          <span class="datte-muted">(Enter drücken)</span>
        </label>
        <input type="text" id="datte-custom-order-number" class="datte-custom-order-input"
               placeholder="Auftragsnummer(n) - mehrere mit Leerzeichen, Komma oder Semikolon trennen" autocomplete="off">
        <div class="datte-custom-order-error" id="datte-custom-order-error">Fehlerhafte Eingabe: Nur Zahlen sind erlaubt</div>
      </div>
      <button class="datte-custom-order-btn" id="datte-custom-order-download">
        <span class="datte-custom-order-icon" aria-hidden="true">${ICONS.download}</span>
        <span class="datte-custom-order-text">Herunterladen</span>
      </button>
    </div>
    <div class="datte-download-status-container" id="datte-download-status-container" style="display: none;">
      <div class="datte-download-status-header">
        <span class="datte-download-status-title">Downloads</span>
        <button class="datte-download-status-clear-btn" id="datte-download-status-clear" title="Alle leeren">
          ${ICONS.close} Leeren
        </button>
      </div>
      <div class="datte-download-status-list" id="datte-download-status-list"></div>
    </div>
  `;
    orderListPage.insertBefore(ordersDiv, orderListPage.firstChild);
    const input = document.getElementById("datte-custom-order-number");
    const downloadBtn = document.getElementById("datte-custom-order-download");
    const errorMsg = document.getElementById("datte-custom-order-error");
    const clearBtn = document.getElementById("datte-download-status-clear");
    if (clearBtn) clearBtn.addEventListener("click", () => clearAllStatusItems());
    function validateInput() {
      const value = input.value.trim();
      if (value.length === 0) {
        input.classList.remove("error");
        errorMsg.classList.remove("show");
        return null;
      }
      const parsed = parseOrderNumbers(value);
      if (parsed.invalid.length > 0) {
        input.classList.add("error");
        errorMsg.textContent = `Fehlerhafte Eingabe: ${parsed.invalid.join(", ")} - nur Zahlen erlaubt`;
        errorMsg.classList.add("show");
        return null;
      }
      if (parsed.valid.length > Config.business.MAX_MULTI_ORDER_LIMIT) {
        input.classList.add("error");
        errorMsg.textContent = `Maximum ${Config.business.MAX_MULTI_ORDER_LIMIT} Aufträge gleichzeitig erlaubt (${parsed.valid.length} eingegeben)`;
        errorMsg.classList.add("show");
        return null;
      }
      input.classList.remove("error");
      errorMsg.classList.remove("show");
      return parsed;
    }
    async function handleCustomOrderDownload() {
      const parsed = validateInput();
      if (!parsed || parsed.valid.length === 0) return;
      const orderNumbers = parsed.valid;
      if (MergedState.mode === "merged") {
        orderNumbers.forEach((orderNumber) => {
          if (!MergedState.selectedOrders.has(orderNumber)) {
            MergedState.selectedOrders.set(orderNumber, createMergedOrderEntry(orderNumber));
          }
        });
        updateDownloadAllBar();
        document.querySelectorAll(".add-btn").forEach((btn) => {
          const text = btn.querySelector(".add-text");
          const icon = btn.querySelector(".add-icon");
          if (!text || !icon) return;
          const row = btn.closest('div[role="row"]');
          if (!row) return;
          const link = row.querySelector('a[data-testid="view-order-details-link"]');
          if (!link) return;
          const href = link.href;
          const match = href.match(/\/orders\/(\d+)/);
          if (match && MergedState.selectedOrders.has(match[1])) {
            btn.classList.add("selected");
            icon.innerHTML = ICONS.check;
            text.textContent = "Hinzugefügt";
          }
        });
        input.value = "";
        input.classList.remove("error");
        errorMsg.classList.remove("show");
        input.focus();
        return;
      }
      if (orderNumbers.length > 1) {
        const confirmed = await showConfirmModal(orderNumbers, input);
        if (!confirmed) return;
      }
      input.value = "";
      input.classList.remove("error");
      errorMsg.classList.remove("show");
      const siteName = extractSiteName();
      orderNumbers.forEach((orderNumber) => {
        const filename = sanitizeFilename(orderNumber);
        createStatusItem(orderNumber, "pending", "In Warteschlange");
        const dummyBtn = document.createElement("button");
        dummyBtn.style.display = "none";
        dummyBtn.innerHTML = '<span class="datte-custom-order-icon"></span><span class="datte-custom-order-text"></span>';
        const queueItem = {
          orderNumber,
          siteName,
          filename,
          $btn: $(dummyBtn),
          iconSelector: ".datte-custom-order-icon",
          textSelector: ".datte-custom-order-text",
          originalIcon: "",
          originalText: "",
          retryAttempt: 1,
          isCustomOrderInput: true
        };
        if (isMaxConcurrentDownloadsReached()) {
          enqueueDownload(queueItem);
        } else {
          startDownload(queueItem);
        }
      });
      input.focus();
    }
    input.addEventListener("input", () => {
      if (input.value.trim().length > 0) validateInput();
      else {
        input.classList.remove("error");
        errorMsg.classList.remove("show");
      }
    });
    input.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleCustomOrderDownload();
      }
    });
    downloadBtn.addEventListener("click", (e) => {
      e.preventDefault();
      handleCustomOrderDownload();
    });
  }
  function setupCustomOrderInputObserver() {
    const existing = document.querySelector('[data-testid="order-list-page"]');
    if (existing && !document.querySelector(".datte-custom-order-container")) {
      createCustomOrderInputUI(existing);
      return;
    }
    const observer = new MutationObserver(() => {
      const orderListPage = document.querySelector('[data-testid="order-list-page"]');
      if (orderListPage && !document.querySelector(".datte-custom-order-container")) {
        createCustomOrderInputUI(orderListPage);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }
  function createModeToggle(container) {
    if (document.querySelector(".datte-mode-toggle")) return;
    const toggle = document.createElement("div");
    toggle.className = "datte-mode-toggle";
    toggle.innerHTML = `
    <button class="datte-mode-btn ${MergedState.mode === "single" ? "active" : ""}" data-mode="single">Einzelmodus</button>
    <button class="datte-mode-btn ${MergedState.mode === "merged" ? "active" : ""}" data-mode="merged">Sammelmodus</button>
  `;
    container.insertBefore(toggle, container.firstChild);
    toggle.addEventListener("click", (e) => {
      const target = e.target;
      const mode = target.dataset.mode;
      if (!mode || mode === MergedState.mode) return;
      MergedState.mode = mode;
      toggle.querySelectorAll(".datte-mode-btn").forEach((btn) => {
        btn.classList.toggle("active", btn.dataset.mode === mode);
      });
      replaceAllRowButtons();
      if (mode === "merged") {
        showDownloadAllBar();
        updateDownloadAllBar();
      } else {
        hideDownloadAllBar();
      }
    });
  }
  applyStyles();
  function initializeScript() {
    setupCustomOrderInputObserver();
    const handleDOMChanges = debounce(() => {
      if (document.querySelector('[data-testid="order-detail-page"]')) attachExportButtonToNewLayout();
      if (document.querySelector("div#ui-modal-target article header")) attachExportButtonToOldModal();
      if (isOrderListPage()) {
        const orderListPage = document.querySelector('[data-testid="order-list-page"]');
        if (orderListPage) {
          createModeToggle(orderListPage);
          createDownloadAllBar(orderListPage);
        }
        attachExportButtonsToOrderList();
      }
    }, Config.timing.DEBOUNCE_DELAY);
    handleDOMChanges();
    const mutationObserver = new MutationObserver((mutations) => {
      if (!location.pathname.includes("/de/orders")) return;
      if (mutations.some((m) => m.type === "childList")) handleDOMChanges();
    });
    mutationObserver.observe(document.body, { subtree: true, childList: true });
  }
  jQuery(document).ready(initializeScript);

})();