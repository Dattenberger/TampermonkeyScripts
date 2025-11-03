// ==UserScript==
// @name         HusqPortalOrdersExporter V4
// @namespace    https://github.com/Dattenberger/TampermonkeyScripts
// @version      2.1.7
// @description  Exportiert Bestelldaten via GraphQL
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
        /* Export button styling */
        a.export-btn {
            display: inline-flex;
            align-items: center;
            gap: .5rem;
            cursor: pointer;
            text-decoration: none;
            margin-left: 5px;
            transition: opacity 0.2s ease;
            /*padding: 0.5em 1em !important;*/
            border-radius: 8px;
            padding: 12px 24px;
            border: 1px solid #3d3d3c;
            font-family: "Husqvarna Gothic", Arial, sans-serif;
            line-height: 16px;
            font-size: 14px;
            transition: unset;
            text-transform: uppercase;
        }

        /* Loading state */
        a.export-btn.loading {
            background: #6f6f6f;
            color: white;
            pointer-events: none;
        }

        /* Queued state */
        a.export-btn.queued {
            background-color: #ffc107;
            border-color: #ffc107;
            color: #212529;
            pointer-events: none;
        }

        /* Success state */
        a.export-btn.success {
            background-color: #28a745;
            border-color: #28a745;
            color: white;
        }

        a.export-btn.success:hover {
            background-color: #218838;
            border-color: #1e7e34;
        }

        /* Error state */
        a.export-btn.error {
            background-color: #dc3545;
            border-color: #dc3545;
            color: white;
        }

        a.export-btn.error:hover {
            background-color: #c82333;
            border-color: #bd2130;
        }


        /* Loading spinner animation */
        .loading-spinner {
            animation: spin 1s linear infinite;
        }

        /* Keyframes for spinner rotation */
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    `);

    // Configuration constants
    /**
     * Skonto-Faktor für Husqvarna-Bestellungen (3% Rabatt bei Zahlung innerhalb von 14 Tagen)
     * Formel: nettoPreis * DISCOUNT_FACTOR = nettoPreis * 0.97 = nettoPreis - (nettoPreis * 0.03)
     * @constant {number}
     */
    const DISCOUNT_FACTOR = 0.97;
    const DEBOUNCE_DELAY = 120;
    const URL_CLEANUP_DELAY = 10000;
    const MAX_RETRY_ATTEMPTS = 5;
    const RETRY_DELAY_BASE = 1000; // Base delay in ms for retry backoff

    // UI Constants
    const LOADING_TEXT = 'Exportiere...';
    const SPINNER_SVG = '<svg class="loading-spinner" xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" stroke-dasharray="31.416" stroke-dashoffset="31.416" fill="none" opacity="0.25"/><path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/></svg>';

    // Cache and download management
    const orderCache = new Map();
    const activeDownloads = new Set(); // Track active order numbers
    const downloadQueue = []; // Queue for pending downloads
    const MAX_CONCURRENT_DOWNLOADS = 2;
    const retryCounters = new Map(); // Track retry attempts per order

    // Queue item structure: { orderNumber, siteName, filename, $btn, iconSelector, textSelector, originalIcon, originalText, retryAttempt }

    /**
     * Creates a debounced function that delays invoking func until after waitTime milliseconds
     * have elapsed since the last time the debounced function was invoked
     * @param {Function} func - The function to debounce
     * @param {number} waitTime - The number of milliseconds to delay (default: 150)
     * @returns {Function} The debounced function
     */
    function debounce(func, waitTime = 150) {
        let timeout;
        return (...args) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => func(...args), waitTime)
        }
    }

    /**
     * Safely converts a value to string, returning empty string for null/undefined
     * @param {*} value - The value to convert to string
     * @returns {string} The string representation or empty string
     */
    function nullSafeString(value){
        return value == null ? '' : String(value);
    }

    /**
     * Validates if the provided order number has the correct format
     * @param {string} orderNumber - The order number to validate
     * @returns {boolean} True if valid, false otherwise
     */
    function validateOrderNumber(orderNumber) {
        return /^\d{6,}$/.test(String(orderNumber || ''));
    }

    /**
     * Safely matches a regex against a string and returns the specified group
     * @param {string} inputString - The string to match against
     * @param {RegExp} regex - The regular expression
     * @param {number} groupIndex - The group index to return (default: 1)
     * @returns {string} The matched group or empty string
     */
    function nullSafeMatch(inputString, regex, groupIndex = 1) {
        if (!inputString) return '';
        const match = String(inputString).match(regex);
        return (match && match.length > groupIndex) ? match[groupIndex] : '';
    }

    /**
     * Parses a European formatted number (1.234,56) to a JavaScript number
     * @param {string|number} input - The input to parse
     * @returns {number} The parsed number or NaN
     */
    function parseEuropeanNumber(input) {
        if (!input) return NaN;
        const cleanedNumber = parseFloat(String(input).trim().replace(/\./g,'').replace(',', '.').replace(/[^\d.-]/g, ''));
        return Number.isFinite(cleanedNumber) ? cleanedNumber : NaN;
    }

    const GERMAN_MONTHS = {
        'Januar': '01',
        'Februar': '02',
        'März': '03',
        'Maerz': '03',
        'April': '04',
        'Mai': '05',
        'Juni': '06',
        'Juli': '07',
        'August': '08',
        'September': '09',
        'Oktober': '10',
        'Okt.': '10',
        'November': '11',
        'Dezember': '12',
        'Dez.': '12'
    };

    /**
     * Formats various German date formats to DD.MM.YYYY format
     * Supports both numeric (1.2.2024) and text formats (1. Januar 2024)
     * @param {string|Date} input - The date input to format
     * @returns {string} Formatted date as DD.MM.YYYY or empty string if invalid
     */
    function formatGermanDate(input) {
        if (!input) return '';
        const stringInput = String(input).trim();
        const numericMatch = stringInput.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
        if (numericMatch) {
            const day = numericMatch[1].padStart(2, '0'), month = numericMatch[2].padStart(2, '0'), year = numericMatch[3];
            return `${day}.${month}.${year}`;
        }
        const textMatch = stringInput.match(/^(\d{1,2})\.?\s+([A-Za-zäöüÄÖÜ\.]+)\s+(\d{4})$/);
        if (textMatch) {
            const day = textMatch[1].padStart(2, '0'), monthCode = GERMAN_MONTHS[textMatch[2]] || '', year = textMatch[3];
            if (monthCode) return `${day}.${monthCode}.${year}`;
        }
        return '';
    }

    /**
     * Converts an ISO date string to German DD.MM.YYYY format
     * @param {string} isoString - ISO date string (e.g., "2024-01-15T10:30:00Z")
     * @returns {string} Formatted date as DD.MM.YYYY or empty string if invalid
     */
    function formatDateFromISO(isoString) {
        if (!isoString) return '';
        const date = new Date(isoString);
        if (isNaN(date)) return '';
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}.${month}.${year}`;
    }

    /**
     * Sanitizes a filename by removing invalid characters and adding .csv extension
     * @param {string} filename - The filename to sanitize
     * @returns {string} Sanitized filename with .csv extension
     */
    function sanitizeFilename(filename) {
        if (!filename) return `order-${Date.now()}.csv`;
        return String(filename).trim().replace(/[\\/:*?"<>|]+/g, '_') + '.csv';
    }

    function extractOrderNumber() {
        const headingElement = document.querySelector('[data-testid="order-detail-page"] h1');
        if (headingElement) {
            const headingMatch = headingElement.textContent && headingElement.textContent.match(/(\d{6,})/);
            if (headingMatch) return headingMatch[1];
        }
        const queryMatch = location.search.match(/[?&]order=(\d{6,})/);
        if (queryMatch) return queryMatch[1];
        const detailNumber = Array.from(document.querySelectorAll('p')).map(paragraph => paragraph.textContent?.trim() || '').find(text => /^\d{6,}$/.test(text));
        if (detailNumber) return detailNumber;
        const pathMatch = location.pathname.match(/\/de\/orders\/(\d{6,})/);
        if (pathMatch) return pathMatch[1];
        return '';
    }

    /**
     * Extracts the site name from redirect links or returns default
     * @returns {string} The site name
     */
    function extractSiteName() {
        const redirectLink = document.querySelector('a[href*="/b2b/products/redirect/"]');
        if (redirectLink) {
            const urlMatch = redirectLink.getAttribute('href').match(/\/b2b\/products\/redirect\/([^/]+)\//);
            if (urlMatch) return urlMatch[1];
        }
        return 'b2b-de-de-de';
    }

    // ---- GraphQL: Optimierte Query (nur benötigte Felder) ----
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

    /**
     * Determines if an error should trigger a retry attempt
     * @param {Error} error - The error to check
     * @returns {boolean} True if error should be retried
     */
    function shouldRetryError(error) {
        const message = error.message || '';

        // Retry on network errors and server errors
        if (error.name === 'NetworkError' || message.includes('Failed to fetch')) return true;
        if (message.includes('GraphQL: leere Antwort')) return true;
        if (message.includes('500') || message.includes('502') || message.includes('503') || message.includes('504')) return true;
        if (message.includes('timeout')) return true;

        // Don't retry on client errors (400-499)
        if (message.includes('401') || message.includes('403') || message.includes('404')) return false;

        // Don't retry on validation errors
        if (message.includes('Ungültige Bestellnummer')) return false;
        if (message.includes('Download bereits aktiv')) return false;

        // Default: retry unknown errors
        return true;
    }

    /**
     * Handles export errors with specific error types and user-friendly messages
     * @param {Error} error - The error to handle
     * @param {string} orderNumber - The order number for context
     * @returns {string} User-friendly error message with order number
     */
    function handleExportError(error, orderNumber) {
        console.error(`Export error for order ${orderNumber}:`, error);

        const orderContext = `Bestellung ${orderNumber}: `;

        if (error.name === 'NetworkError' || error.message.includes('Failed to fetch')) {
            return orderContext + 'Netzwerkfehler - bitte Internetverbindung prüfen';
        }
        if (error.message.includes('401') || error.message.includes('403')) {
            return orderContext + 'Authentifizierung fehlgeschlagen - bitte neu anmelden';
        }
        if (error.message.includes('404')) {
            return orderContext + 'Bestellung nicht gefunden';
        }
        if (error.message.includes('500') || error.message.includes('502') || error.message.includes('503')) {
            return orderContext + 'Server-Fehler - bitte später erneut versuchen';
        }

        return orderContext + `Export fehlgeschlagen: ${error.message || 'Unbekannter Fehler'}`;
    }

    /**
     * Fetches order data via GraphQL with caching and retry support
     * @param {string} orderNumber - The order number to fetch
     * @param {string} siteName - The site name
     * @param {number} retryAttempt - Current retry attempt (1-based)
     * @returns {Promise<Object>} The order data
     */
    async function fetchOrderViaGraphQL(orderNumber, siteName, retryAttempt = 1) {
        // Input validation
        if (!validateOrderNumber(orderNumber)) {
            throw new Error('Ungültige Bestellnummer');
        }

        // Check cache first (only on first attempt)
        if (retryAttempt === 1) {
            const cacheKey = `${orderNumber}-${siteName}`;
            if (orderCache.has(cacheKey)) {
                return orderCache.get(cacheKey);
            }
        }

        // Check if download is already running for this order
        if (activeDownloads.has(orderNumber)) {
            throw new Error('Download bereits aktiv für diese Bestellung');
        }

        // Track this download
        activeDownloads.add(orderNumber);

        try {
            const body = {
                query: GQL_QUERY,
                variables: {siteName, orderNumber},
                operationName: 'getDetailedClosedOrder'
            };

            const res = await fetch('https://portal.husqvarnagroup.com/hbd/graphql?', {
                method: 'POST',
                credentials: 'same-origin',
                headers: {'content-type': 'application/json'},
                body: JSON.stringify(body)
            });

            if (!res.ok) {
                throw new Error(`GraphQL HTTP ${res.status}`);
            }

            const json = await res.json();
            const order = json?.data?.site?.commerce?.orders?.get;

            if (!order) {
                throw new Error('GraphQL: leere Antwort');
            }

            // Cache the result on successful fetch
            const cacheKey = `${orderNumber}-${siteName}`;
            orderCache.set(cacheKey, order);

            // Clear retry counter on success
            retryCounters.delete(orderNumber);

            return order;
        } finally {
            activeDownloads.delete(orderNumber);
            // Process next item in queue
            setTimeout(() => processDownloadQueue(), 100);
        }
    }

    /**
     * Transforms order line data into CSV export format for JTL
     * Calculates quantities, prices, and formats data according to JTL requirements
     * @param {Array<Object>} rows - Array of order line data objects
     * @param {string} innerOrderNumber - Internal order number (customer reference)
     * @param {string} outerOrderNumber - External order number (system reference)
     * @returns {Array<Object>} Array of objects formatted for CSV export
     */
    function prepareCsvDataToExport(rows, innerOrderNumber, outerOrderNumber) {
        return rows.map((data) => {
            let vpe = parseInt(nullSafeMatch(data['Kommentar'], /^D-BE\S*\s*VPE=(\d+)/, 1), 10);
            if (!Number.isFinite(vpe) || vpe < 1) vpe = 1;

            const quantityRaw = (data['Anz/Konf.'] || '').split('/')[0] || '';
            const quantity = parseInt(String(quantityRaw).replace(/\D+/g, ''), 10);
            const baseQuantity = Number.isFinite(quantity) ? quantity : 0;
            const totalQuantity = Math.max(1, baseQuantity * vpe);

            const totalPrice = data['Gesamt'];
            const purchasePriceNet = (Number.isFinite(totalPrice) && totalQuantity > 0) ? (totalPrice * DISCOUNT_FACTOR / totalQuantity) : NaN;

            return {
                'HAN': (data['Artikelnumer'] || '').replace(/^0+/g, '').replace(/\D+/g, ''),
                'Interne Bestellnummer': nullSafeString(innerOrderNumber).slice(0, 14),
                'Artikelnummer': nullSafeMatch(data['Kommentar'], /^D-BE\S*\s*(?:VPE=\d*)?\s*(\S*)/, 1),
                'Lieferantenbezeichnung': data['Beschreibung'] || '',
                'menge': totalQuantity,
                'EK netto': Number.isFinite(purchasePriceNet) ? purchasePriceNet.toFixed(4).replace('.', ',') : '',
                'Lieferdatum': formatGermanDate(data['Versendet']),
                'Freiposition': 'N',
                'Fremdbelegnummer': nullSafeString(outerOrderNumber)
            };
        });
    }

    // ---- Mapper: GraphQL -> Zwischenformat (angepasst) ----
    function mapGraphQLToRow(line) {
        const firstDel = (line.deliveryLines && line.deliveryLines[0]) || null;
        const delivered = firstDel?.deliveryQuantity;
        const requested = line.requestedQuantity;
        const anzKonf = `${(delivered ?? requested) ?? ''} / ${requested ?? ''}`;

        const promised = firstDel?.promisedDispatchDate;
        const versendet = formatDateFromISO(promised) || formatDateFromISO(line.requestedDispatchDate);

        const name = (line.article && line.article.name) || line.ecomArticleDescription;
        const beschreibung = (line.article && line.article.articleDescription) || ''
        const nameBeschreibung = (name + " " + beschreibung).trim();

        return {
            'Artikelnumer': line.unformattedArticleNumber || (line.article && line.article.id) || '',
            'Kommentar': line.customerOrderLineReference || '',
            'Beschreibung': nameBeschreibung,
            'Angefragt': formatDateFromISO(line.requestedDispatchDate),
            'Versendet': versendet,
            'Anz/Konf.': anzKonf,
            'Gesamt': line.totalNetPrice,
            'Tracking link': (firstDel?.shipmentInfos && firstDel.shipmentInfos[0]?.shipmentTrackingUrl) || ''
        };
    }

    /**
     * Detects if we're on the order list overview page
     * @returns {boolean} True if on order list page
     */
    function isOrderListPage() {
        return !!document.querySelector('[data-testid="order-list-page"]') &&
            !!document.querySelector('div[role="table"]');
    }

    /**
     * Checks if too many downloads are running concurrently
     * @returns {boolean} True if max concurrent downloads reached
     */
    function isMaxConcurrentDownloadsReached() {
        return activeDownloads.size >= MAX_CONCURRENT_DOWNLOADS;
    }


    /**
     * Processes the next item in the download queue if slots are available
     */
    function processDownloadQueue() {
        if (downloadQueue.length === 0 || isMaxConcurrentDownloadsReached()) {
            return;
        }

        const queueItem = downloadQueue.shift();
        startDownload(queueItem);
    }

    /**
     * Adds a download to the queue and processes it if possible
     * @param {Object} queueItem - Download queue item with all necessary data
     */
    function enqueueDownload(queueItem) {
        // Check if already in queue or downloading
        if (activeDownloads.has(queueItem.orderNumber) ||
            downloadQueue.some(item => item.orderNumber === queueItem.orderNumber)) {
            return;
        }

        downloadQueue.push(queueItem);
        updateQueuedButtonState(queueItem);
        processDownloadQueue();
    }

    /**
     * Updates button to show queued state
     * @param {Object} queueItem - Queue item containing button and state info
     */
    function updateQueuedButtonState(queueItem) {
        const { $btn, iconSelector, textSelector } = queueItem;
        $btn.addClass('queued').attr('data-queued-state', 'true');
        const $icon = $btn.find(iconSelector);
        const $text = $btn.find(textSelector);

        $icon.html('<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6l4 2"/><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" fill="none"/></svg>');
        if ($text.length > 0) {
            $text.text(`In Warteschlange`);
        }
    }


    /**
     * Starts the actual download process for a queue item with retry support
     * @param {Object} queueItem - Queue item containing all download data
     */
    async function startDownload(queueItem) {
        const { orderNumber, siteName, filename, $btn, iconSelector, textSelector, retryAttempt = 1 } = queueItem;

        // Start loading state with retry indicator
        const buttonId = getButtonId(orderNumber);
        $btn.removeClass('queued error').removeAttr('data-queued-state data-error-state')
            .addClass('loading').attr('data-button-id', buttonId);

        const $icon = $btn.find(iconSelector);
        const $text = $btn.find(textSelector);

        $icon.html(SPINNER_SVG);
        if ($text.length > 0) {
            const loadingText = retryAttempt >= 2 ? `${LOADING_TEXT} (${retryAttempt})` : LOADING_TEXT;
            $text.text(loadingText);
        }

        try {
            const order = await fetchOrderViaGraphQL(orderNumber, siteName, retryAttempt);
            const innerOrderNumber = order.customerOrderNumber && order.customerOrderNumber !== '-' ? order.customerOrderNumber : order.orderNumber;
            const outerOrderNumber = order.orderNumber;

            const rows = (order.orderLines || []).map(mapGraphQLToRow);
            const csv = $.csv.fromObjects(prepareCsvDataToExport(rows, innerOrderNumber, outerOrderNumber), {separator: ';'});
            const url = URL.createObjectURL(new Blob([csv], {type: 'text/csv;charset=utf-8'}));

            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            link.click();

            setTimeout(() => URL.revokeObjectURL(url), URL_CLEANUP_DELAY);

            // Show success state permanently
            $btn.removeClass('loading').addClass('success').attr('data-success-state', 'true');
            $icon.html('<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>');
            if ($text.length > 0) {
                $text.text('Erfolgreich!');
            }

        } catch (error) {
            // Check if we should retry
            if (retryAttempt < MAX_RETRY_ATTEMPTS && shouldRetryError(error)) {
                const nextAttempt = retryAttempt + 1;
                const delay = RETRY_DELAY_BASE * Math.pow(2, retryAttempt - 1); // Exponential backoff

                console.log(`Retry attempt ${nextAttempt} for order ${orderNumber} in ${delay}ms`);

                // Update retry counter
                retryCounters.set(orderNumber, nextAttempt);

                // Schedule retry
                setTimeout(() => {
                    const retryQueueItem = { ...queueItem, retryAttempt: nextAttempt };
                    startDownload(retryQueueItem);
                }, delay);

                return; // Don't process error state yet
            }

            // Max retries reached or non-retryable error
            const userMessage = handleExportError(error, orderNumber);
            retryCounters.delete(orderNumber);

            // Show error state permanently with red highlighting
            $btn.removeClass('loading').addClass('error').attr('data-error-state', 'true');
            $icon.html('<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 6l12 12M6 18L18 6"/></svg>');
            if ($text.length > 0) {
                const errorText = retryAttempt >= 2 ? `Fehler! (${retryAttempt}/${MAX_RETRY_ATTEMPTS})` : 'Fehler!';
                $text.text(errorText);
            }

            // Error is now only shown visually with red button
            console.error(userMessage);
        } finally {
            activeDownloads.delete(orderNumber);
            // Process next item in queue
            setTimeout(() => processDownloadQueue(), 100);
        }
    }

    /**
     * Gets a unique button ID for tracking individual button states
     * @param {string} orderNumber - The order number
     * @returns {string} Unique button identifier
     */
    function getButtonId(orderNumber) {
        return `export-btn-${orderNumber}`;
    }

    /**
     * Creates a unified export handler for both layout types
     * Handles loading states, error states, success states, and retry functionality
     * @param {string} iconSelector - CSS selector for the icon element
     * @param {string} textSelector - CSS selector for the text element
     * @param {string} orderNumber - The order number to export
     * @param {string} filename - The filename for the download
     * @param {jQuery} $btn - The button jQuery object
     * @returns {Function} The event handler function
     */

    function createExportHandler(iconSelector, textSelector, orderNumber, filename, $btn) {
        return async (e) => {
            e.preventDefault();

            // Check if already downloading this order
            if (activeDownloads.has(orderNumber)) {
                return; // Silently ignore if already in progress
            }

            // If button is in error or queued state, reset to original state and continue with download
            if ($btn.hasClass('error') || $btn.attr('data-error-state') === 'true') {
                $btn.removeClass('error').removeAttr('data-error-state');
                // Clear retry counter for new manual attempt
                retryCounters.delete(orderNumber);
            }
            if ($btn.hasClass('queued') || $btn.attr('data-queued-state') === 'true') {
                $btn.removeClass('queued').removeAttr('data-queued-state');
                // Remove from queue if already queued
                const queueIndex = downloadQueue.findIndex(item => item.orderNumber === orderNumber);
                if (queueIndex !== -1) {
                    downloadQueue.splice(queueIndex, 1);
                }
            }

            // Check concurrent download limit - if reached, try to add to queue
            if (isMaxConcurrentDownloadsReached()) {
                const queueItem = {
                    orderNumber,
                    siteName: extractSiteName(),
                    filename,
                    $btn,
                    iconSelector,
                    textSelector,
                    originalIcon: $btn.find(iconSelector).html(),
                    originalText: $btn.find(textSelector).text(),
                    retryAttempt: 1
                };
                enqueueDownload(queueItem);
                return;
            }

            // Start download immediately
            const queueItem = {
                orderNumber,
                siteName: extractSiteName(),
                filename,
                $btn,
                iconSelector,
                textSelector,
                originalIcon: $btn.find(iconSelector).html(),
                originalText: $btn.find(textSelector).text(),
                retryAttempt: 1
            };
            startDownload(queueItem);
        };
    }

    function attachExportButtonToNewLayout() {
        const $page = $('[data-testid="order-detail-page"]').first();
        if (!$page.length) return;
        const $bar = $page.find('h1').parent().find('h1 ~ div').first();
        if (!$bar.length) return;
        if ($bar.find('.export-btn').length) return;

        const orderNumber = extractOrderNumber();
        const filename = sanitizeFilename(orderNumber);

        const $btn = $(`
      <a class="export-btn" data-variant="secondary" data-size="compact" download="${filename}" title="Export CSV für JTL (API)">
        <span class="export-icon" aria-hidden="true">
          <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" fill="none" viewBox="0 0 28 28">
            <path fill="currentColor" d="M27.003 20a1 1 0 0 1 .992.884l.007.116L28 26.003a2 2 0 0 1-1.85 1.994l-.15.005H2a2 2 0 0 1-1.995-1.85L0 26.002V21a1 1 0 0 1 1.993-.117L2 21v5.002h24L26.002 21a1 1 0 0 1 1-1m-13-20a1 1 0 0 1 .992.883l.007.117v16.585l6.293-6.292a1 1 0 0 1 1.492 1.327l-.078.087-8 8a1 1 0 0 1-.085.076l-.009.007-.028.021a1 1 0 0 1-.075.05l-.026.014a1 1 0 0 1-.08.04l-.038.016-.051.018-.018.006a1 1 0 0 1-.124.03l-.027.004a1 1 0 0 1-.146.011h-.033l-.052-.004.085.004a1 1 0 0 1-.18-.016h-.002l-.023-.005-.059-.014-.032-.01h-.002l-.014-.005a1 1 0 0 1-.095-.036l-.003-.002-.018-.008-.045-.023-.036-.02-.004-.003q0 .002-.005-.003l-.01-.006-.065-.044-.024-.018a1 1 0 0 1-.09-.08l-8-8a1 1 0 0 1 1.327-1.492l.087.078 6.293 6.292V1a1 1 0 0 1 1-1"></path>
          </svg>
        </span>
        <span class="export-text">Export CSV für JTL</span>
      </a>
    `);
        $btn.on('click', createExportHandler('.export-icon', '.export-text', orderNumber, filename, $btn));

        $bar.append($btn);
    }

    function attachExportButtonToOldModal() {
        const $root = $('div#ui-modal-target');
        if (!$root.length) return;
        const $modal = $root.find('article').first();
        if (!$modal.length) return;
        const $header = $modal.find('header');
        const $headerDiv = $header.find('div').first();
        if (!$headerDiv.length) return;
        if ($header.find('.export-btn').length) return;

        $headerDiv.css({display: 'flex', justifyContent: 'space-between', alignItems: 'center'});
        const orderNumber = extractOrderNumber();
        const filename = sanitizeFilename(orderNumber);

        const $btn = $(`
      <a class="export-btn" data-variant="secondary" data-size="compact" download="${filename}">
        <span class="export-icon" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" fill="none" viewBox="0 0 28 28"><path fill="currentColor" d="M27.003 20..."></path></svg></span>
        <span class="export-text">Export CSV für JTL</span>
      </a>
    `);

        $btn.on('click', createExportHandler('.export-icon', '.export-text', orderNumber, filename, $btn));

        $headerDiv.append($btn);
    }

    /**
     * Extracts order ID from a detail link href
     * @param {string} href - The href attribute value
     * @returns {string} The extracted order ID or empty string
     */
    function extractOrderIdFromHref(href) {
        if (!href) return '';
        const match = href.match(/orderId=(\d+)/);
        return match ? match[1] : '';
    }

    /**
     * Attaches export buttons to all order rows in the order list table
     */
    function attachExportButtonsToOrderList() {
        const table = document.querySelector('[data-testid="order-list-page"] div[role="table"]');
        if (!table) return;

        // Find all order rows (skip header row)
        const rows = table.querySelectorAll('div[role="row"]:not(.b2b-tm)');

        rows.forEach(row => {
            // Skip if button already exists
            if (row.querySelector('.export-btn')) return;

            // Find the detail link to extract order ID
            const detailLink = row.querySelector('a[data-testid="view-order-details-link"]');
            if (!detailLink) return;

            const orderNumber = extractOrderIdFromHref(detailLink.href);
            if (!orderNumber || !validateOrderNumber(orderNumber)) return;

            const filename = sanitizeFilename(orderNumber);

            // Find the cell with the arrow (last cell)
            const arrowCell = row.querySelector('div[role="cell"]:last-child');
            if (!arrowCell) return;

            // Create download button
            const $downloadBtn = $(`
                <a class="export-btn"
                   data-variant="secondary"
                   data-size="compact"
                   download="${filename}"
                   title="CSV Export für Bestellung ${orderNumber}"
                   style="margin-left: 12px;">
                    <span class="export-icon" aria-hidden="true">
                        <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" fill="none" viewBox="0 0 28 28">
                            <path fill="currentColor" d="M27.003 20a1 1 0 0 1 .992.884l.007.116L28 26.003a2 2 0 0 1-1.85 1.994l-.15.005H2a2 2 0 0 1-1.995-1.85L0 26.002V21a1 1 0 0 1 1.993-.117L2 21v5.002h24L26.002 21a1 1 0 0 1 1-1m-13-20a1 1 0 0 1 .992.883l.007.117v16.585l6.293-6.292a1 1 0 0 1 1.492 1.327l-.078.087-8 8a1 1 0 0 1-.085.076l-.009.007-.028.021a1 1 0 0 1-.075.05l-.026.014a1 1 0 0 1-.08.04l-.038.016-.051.018-.018.006a1 1 0 0 1-.124.03l-.027.004a1 1 0 0 1-.146.011h-.033l-.052-.004.085.004a1 1 0 0 1-.18-.016h-.002l-.023-.005-.059-.014-.032-.01h-.002l-.014-.005a1 1 0 0 1-.095-.036l-.003-.002-.018-.008-.045-.023-.036-.02-.004-.003q0 .002-.005-.003l-.01-.006-.065-.044-.024-.018a1 1 0 0 1-.09-.08l-8-8a1 1 0 0 1 1.327-1.492l.087.078 6.293 6.292V1a1 1 0 0 1 1-1"></path>
                        </svg>
                    </span>
                    <span style="width: max-content" class="export-text">JTL Export</span>
                </a>
            `);

            // Add event handler using the existing createExportHandler function
            $downloadBtn.on('click', createExportHandler('.export-icon', '.export-text', orderNumber, filename, $downloadBtn));

            // Insert after the arrow link
            $(arrowCell).append($downloadBtn);
        });
    }

    function initializeScript() {
        const handleDOMChanges = debounce(() => {
            if (document.querySelector('[data-testid="order-detail-page"]')) attachExportButtonToNewLayout();
            if (document.querySelector('div#ui-modal-target article header')) attachExportButtonToOldModal();
            if (isOrderListPage()) attachExportButtonsToOrderList();
        }, 120);
        handleDOMChanges();

        const mutationObserver = new MutationObserver(mutations => {
            if (!location.pathname.includes('/de/orders')) return;
            if (mutations.some(mutation => mutation.type === 'childList')) handleDOMChanges();
        });
        mutationObserver.observe(document.body, {subtree: true, childList: true});
    }

    jQuery(document).ready(initializeScript);
})();
