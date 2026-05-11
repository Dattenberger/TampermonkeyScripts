// ==UserScript==
// @name         MFR Beschreibung Formatter
// @namespace    https://robotico.de/
// @version      0.2
// @description  Fügt Leerzeilen und fehlende Felder in die Turm-Beschreibung ein
// @match        https://portal.mobilefieldreport.com/*
// @updateURL    https://raw.githubusercontent.com/Dattenberger/TampermonkeyScripts/main/mfr-kd-auftragsformatter.js
// @downloadURL  https://raw.githubusercontent.com/Dattenberger/TampermonkeyScripts/main/mfr-kd-auftragsformatter.js
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    // ── Konfiguration ──────────────────────────────────────────────

    // Bekannte Zeilen-Prefixe in der erwarteten Reihenfolge.
    // Der Text wird an diesen Stellen aufgetrennt.
    const LINE_PREFIXES = [
        'Erwartete Ankunft:',
        'Kunde:',
        'Auftrag:',
        '--- Interne Hinweise ---',
        'Gebuchter Typ der Winterwartung:',
        'PIN:',
        'Lagerort:',
        'In Betrieb nehmen:',
        'Zubehör:',
        'Kommentar aus Winter KD Liste:',
        'Kommentar bzgl. Abholung / Auslieferung:',
    ];

    // Zeilen, VOR denen eine Leerzeile stehen soll
    const BLANK_LINE_BEFORE = new Set([
        'Auftrag:',
        '--- Interne Hinweise ---',
        'Kommentar aus Winter KD Liste:',
        'Kommentar bzgl. Abholung / Auslieferung:',
    ]);

    // Zeilen, die nach "Lagerort:" eingefügt werden (falls fehlend)
    const INSERT_AFTER_LAGERORT = [
        'In Betrieb nehmen: XXX',
        'Zubehör: XXX',
    ];

    // ── Hilfsfunktionen ────────────────────────────────────────────

    function getDescriptionEl() {
        return document.querySelector('#redactorDescription');
    }

    function isEditMode() {
        const el = getDescriptionEl();
        return el && el.getAttribute('contenteditable') === 'true';
    }

    function activateEditMode() {
        const addLink = document.querySelector('.editDescriptionCommand > a');
        if (addLink) {
            addLink.click();
            return true;
        }
        const el = getDescriptionEl();
        if (el) {
            el.click();
            return true;
        }
        return false;
    }

    /**
     * Splittet einen flachen Text (ohne Zeilenumbrüche) anhand der
     * bekannten Schlüsselwörter in einzelne Zeilen auf.
     */
    function splitByKeywords(raw) {
        // Normalisieren: Zeilenumbrüche → Leerzeichen, mehrfache Leerzeichen → eins
        let text = raw.replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim();

        // Regex bauen, die VOR jedem bekannten Prefix splittet
        const escapedPrefixes = LINE_PREFIXES.map(p =>
            p.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')
        );
        const splitRegex = new RegExp(
            '\\s(?=' + escapedPrefixes.join('|') + ')',
            'g'
        );

        const parts = text.split(splitRegex).filter(s => s.trim() !== '');

        console.log('[MFR Formatter] Erkannte Zeilen:', parts);
        return parts;
    }

    /**
     * Nimmt den Rohtext und gibt den formatierten Text als Array von
     * Zeilen zurück (inkl. Leerzeilen als '').
     */
    function formatDescription(raw) {
        let lines = splitByKeywords(raw);

        // Fehlende Felder nach "Lagerort:" einfügen
        const lagerortIdx = lines.findIndex(l => l.startsWith('Lagerort:'));
        if (lagerortIdx !== -1) {
            const toInsert = INSERT_AFTER_LAGERORT.filter(newLine => {
                const prefix = newLine.split(':')[0] + ':';
                return !lines.some(l => l.startsWith(prefix));
            });
            if (toInsert.length > 0) {
                lines.splice(lagerortIdx + 1, 0, ...toInsert);
            }
        }

        // Leerzeilen VOR bestimmten Zeilen einfügen
        const result = [];
        for (let i = 0; i < lines.length; i++) {
            const needsBlank = [...BLANK_LINE_BEFORE].some(prefix =>
                lines[i].startsWith(prefix)
            );
            if (needsBlank && i > 0) {
                result.push('');
            }
            result.push(lines[i]);
        }

        return result;
    }

    /**
     * Schreibt die formatierten Zeilen als HTML ins Redactor-Feld.
     */
    function applyToEditor(el, lines) {
        // Jede Zeile wird ein eigener <p>-Block.
        // Leerzeilen werden zu <p><br></p> (Redactor-Konvention).
        const html = lines
            .map(line => {
                if (line === '') return '<p><br></p>';
                return '<p>' + escapeHtml(line) + '</p>';
            })
            .join('');

        el.innerHTML = html;

        // Events feuern, damit Redactor die Änderung mitbekommt
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));

        // Redactor-Sync anstoßen (falls jQuery + Redactor vorhanden)
        try {
            if (typeof $ !== 'undefined') {
                const $el = $(el);
                if ($el.redactor) {
                    $el.redactor('code.sync');
                }
            }
        } catch (e) { /* ok */ }
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // ── Hauptlogik ─────────────────────────────────────────────────

    function doFormat() {
        const el = getDescriptionEl();
        if (!el) {
            alert('Beschreibungsfeld nicht gefunden!');
            return;
        }

        if (!isEditMode()) {
            activateEditMode();
            setTimeout(() => doFormatInner(), 500);
        } else {
            doFormatInner();
        }
    }

    function doFormatInner() {
        const el = getDescriptionEl();
        if (!el) return;

        const raw = el.innerText || el.textContent || '';
        const lines = formatDescription(raw);

        console.log('── MFR Formatter v0.2 ──');
        console.log('VORHER:', JSON.stringify(raw));
        console.log('NACHHER (Zeilen):', lines);
        console.log('NACHHER (Text):', lines.join('\n'));

        applyToEditor(el, lines);
    }

    // ── Button einfügen ────────────────────────────────────────────

    function injectButton() {
        const target = document.querySelector('#descriptionOuterBox');
        if (!target) return false;

        if (document.querySelector('#mfr-format-btn')) return true;

        const btn = document.createElement('button');
        btn.id = 'mfr-format-btn';
        btn.textContent = '✨ Beschreibung formatieren';
        btn.style.cssText = [
            'margin: 6px 0',
            'padding: 6px 14px',
            'background: #1976d2',
            'color: #fff',
            'border: none',
            'border-radius: 4px',
            'cursor: pointer',
            'font-size: 13px',
        ].join(';');

        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            doFormat();
        });

        target.prepend(btn);
        return true;
    }

    // ── Init ───────────────────────────────────────────────────────

    function init() {
        if (injectButton()) return;
        const observer = new MutationObserver(() => {
            if (injectButton()) observer.disconnect();
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
