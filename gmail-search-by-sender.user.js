// ==UserScript==
// @name         Gmail: Search Sender + Mark Read / Archive (Clean, ES5-safe)
// @namespace    https://latinsud.com/
// @supportURL   https://github.com/LatinSuD/gmail-search-by-sender/
// @version      1.2.0
// @description  Adds toolbar buttons: search by sender of opened email, mark current page as read, archive current page.
// @author       LatinSuD (refactor)
// @match        https://mail.google.com/mail/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=google.com
// @grant        none
// ==/UserScript==

(function () {
    "use strict";

    /**
     * Why this version:
     * - No optional chaining, no async/await, no template literals, no CSS.escape
     *   → avoids syntax errors in some userscript engines / older runtimes.
     * - Gmail DOM is a moving target → defensive checks + fallbacks (keyboard shortcuts).
     */

        // ----------------------------
        // Selectors / constants
        // ----------------------------

    var SELECTORS = {
            toolbar: 'div[gh="mtb"]',
            toolbarContentContainer: 'div[gh="mtb"] > div > div',
            searchInput: 'input[name="q"]',
            emailSpanInMain: 'div[role="main"] span[email]',
            selectAllCheckbox: 'span[role="checkbox"]',
            toolbarIconCandidates: ".bAO"
        };

    var UI = {
        rootId: "gmail-clean-tools-root",
        btnSearchSenderId: "gmail-btn-search-sender",
        btnMarkReadId: "gmail-btn-mark-read-page",
        btnArchiveId: "gmail-btn-archive-page"
    };

    // Original heuristic from the old script (fragile, language-agnostic)
    var MARK_AS_READ_ICON_BG_REGEX = /drafts/i;

    // Keyboard shortcuts (work if Gmail shortcuts are enabled):
    // Mark as read: Shift + I :contentReference[oaicite:0]{index=0}
    // Archive: E :contentReference[oaicite:1]{index=1}
    var SHORTCUTS = {
        markReadKey: "I",
        markReadShift: true,
        archiveKey: "E",
        archiveShift: false
    };

    // ----------------------------
    // DOM helpers
    // ----------------------------

    function query(selector) {
        return document.querySelector(selector);
    }

    function queryAll(selector) {
        return Array.prototype.slice.call(document.querySelectorAll(selector));
    }

    function isDisplayed(el) {
        if (!el) return false;

        var style = window.getComputedStyle(el);
        if (!style) return true;

        if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") return false;

        // Walk up: if any ancestor is display:none, treat as hidden
        var node = el;
        while (node && node.nodeType === 1) {
            if (node.style && node.style.display === "none") return false;
            node = node.parentElement;
        }
        return true;
    }

    function wait(ms, fn) {
        window.setTimeout(fn, ms);
    }

    function clickLikeUser(element) {
        if (!element) return;
        element.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
        element.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true }));
        if (typeof element.click === "function") element.click();
    }

    function dispatchInputEvent(inputEl) {
        // Gmail often listens to input events to update internal state
        try {
            inputEl.dispatchEvent(new Event("input", { bubbles: true }));
        } catch (e) {
            // very old engines
            var evt = document.createEvent("Event");
            evt.initEvent("input", true, true);
            inputEl.dispatchEvent(evt);
        }
    }

    function sendGmailShortcut(key, useShift) {
        // Works if Gmail keyboard shortcuts are enabled and focus is in a context Gmail listens to.
        // We dispatch key events on document.
        var init = {
            bubbles: true,
            cancelable: true,
            key: key,
            shiftKey: !!useShift
        };

        try {
            document.dispatchEvent(new KeyboardEvent("keydown", init));
            document.dispatchEvent(new KeyboardEvent("keypress", init));
            document.dispatchEvent(new KeyboardEvent("keyup", init));
        } catch (e) {
            // Some browsers restrict KeyboardEvent construction; do best-effort fallback.
            var down = document.createEvent("KeyboardEvent");
            if (down.initKeyboardEvent) {
                down.initKeyboardEvent("keydown", true, true, window, key, 0, useShift, false, false, false);
                document.dispatchEvent(down);
            }
        }
    }

    // ----------------------------
    // Gmail DOM lookups
    // ----------------------------

    function findToolbar() {
        return query(SELECTORS.toolbar);
    }

    function findToolbarContainer(toolbar) {
        if (!toolbar) return null;

        // Prefer the historical injection point
        var container = toolbar.querySelector(":scope > div > div");
        if (container) return container;

        container = query(SELECTORS.toolbarContentContainer);
        return container || toolbar;
    }

    function findSearchInput() {
        return query(SELECTORS.searchInput);
    }

    function getOpenedEmailSenderAddress() {
        var senderSpan = query(SELECTORS.emailSpanInMain);
        return senderSpan ? senderSpan.getAttribute("email") : null;
    }

    function findSelectAllCheckbox() {
        var toolbar = findToolbar();
        if (!toolbar) return null;
        return toolbar.querySelector(SELECTORS.selectAllCheckbox);
    }

    function getToolbarIconCandidates() {
        return queryAll(SELECTORS.toolbarIconCandidates);
    }

    function findControlByAriaLabel(toolbar, patterns) {
        if (!toolbar) return null;

        var candidates = queryAll('button, [role="button"]');
        // Narrow candidates to toolbar subtree
        candidates = candidates.filter(function (el) {
            return toolbar.contains(el);
        });

        for (var i = 0; i < candidates.length; i++) {
            var el = candidates[i];
            if (!isDisplayed(el)) continue;

            var label = (el.getAttribute("aria-label") || "").trim();
            for (var p = 0; p < patterns.length; p++) {
                if (patterns[p].test(label)) return el;
            }
        }
        return null;
    }

    function findMarkAsReadControl() {
        var toolbar = findToolbar();
        if (!toolbar) return null;

        // 1) Prefer aria-label (language-dependent but relatively stable)
        var aria = findControlByAriaLabel(toolbar, [/mark as read/i, /als gelesen/i, /gelesen markieren/i]);
        if (aria) return aria;

        // 2) Fallback: old sprite heuristic (language-agnostic but fragile)
        var icons = getToolbarIconCandidates();
        for (var i = 0; i < icons.length; i++) {
            var icon = icons[i];
            if (!isDisplayed(icon)) continue;

            var bg = window.getComputedStyle(icon).backgroundImage || "";
            if (!MARK_AS_READ_ICON_BG_REGEX.test(bg)) continue;

            var clickable = icon.parentElement && icon.parentElement.parentElement ? icon.parentElement.parentElement : icon;
            if (clickable && isDisplayed(clickable)) return clickable;
        }

        return null;
    }

    function findArchiveControl() {
        var toolbar = findToolbar();
        if (!toolbar) return null;

        // 1) Prefer aria-label (DE+EN)
        var aria = findControlByAriaLabel(toolbar, [/archive/i, /archiv/i, /archivieren/i]);
        if (aria) return aria;

        // 2) Optional icon heuristic (super fragile; kept minimal)
        var icons = getToolbarIconCandidates();
        for (var i = 0; i < icons.length; i++) {
            var icon = icons[i];
            if (!isDisplayed(icon)) continue;

            var bg = window.getComputedStyle(icon).backgroundImage || "";
            if (!/archive/i.test(bg)) continue;

            var clickable = icon.parentElement && icon.parentElement.parentElement ? icon.parentElement.parentElement : icon;
            if (clickable && isDisplayed(clickable)) return clickable;
        }

        return null;
    }

    // ----------------------------
    // Actions
    // ----------------------------

    function searchByOpenedEmailSender() {
        var input = findSearchInput();
        if (!input) return;

        var sender = getOpenedEmailSenderAddress();
        if (!sender) return;

        var current = (input.value || "").replace(/\s+$/, "");
        input.value = current + " from:" + sender;

        // Trigger Gmail's internal listeners and run search via Enter
        input.focus();
        dispatchInputEvent(input);

        // Press Enter
        sendGmailShortcut("Enter", false);
    }

    function markSelectedMessagesOnPageAsReadAndGoBack() {
        var selectAll = findSelectAllCheckbox();
        if (!selectAll) return;

        clickLikeUser(selectAll);

        wait(60, function () {
            var control = findMarkAsReadControl();
            if (control) {
                clickLikeUser(control);
            } else {
                // Fallback: Shift+I = mark as read :contentReference[oaicite:2]{index=2}
                sendGmailShortcut(SHORTCUTS.markReadKey, SHORTCUTS.markReadShift);
            }

            wait(30, function () {
                history.back();
            });
        });
    }

    function archiveSelectedMessagesOnPageAndGoBack() {
        var selectAll = findSelectAllCheckbox();
        if (!selectAll) return;

        clickLikeUser(selectAll);

        wait(60, function () {
            var control = findArchiveControl();
            if (control) {
                clickLikeUser(control);
            } else {
                // Fallback: E = archive :contentReference[oaicite:3]{index=3}
                sendGmailShortcut(SHORTCUTS.archiveKey, SHORTCUTS.archiveShift);
            }

            wait(30, function () {
                history.back();
            });
        });
    }

    // ----------------------------
    // UI injection
    // ----------------------------

    function createToolbarButton(id, label, onClick) {
        var btn = document.createElement("button");
        btn.type = "button";
        btn.id = id;
        btn.textContent = label;

        btn.style.marginRight = "0.5em";
        btn.style.cursor = "pointer";
        btn.style.padding = "0.35em 0.6em";
        btn.style.borderRadius = "0.5em";
        btn.style.border = "1px solid rgba(0,0,0,0.2)";
        btn.style.background = "rgba(255,255,255,0.9)";

        btn.addEventListener("click", function (e) {
            e.preventDefault();
            e.stopPropagation();
            onClick();
        });

        return btn;
    }

    function ensureToolbarUI() {
        //if new buttons already exist -> return
        if (document.getElementById(UI.rootId)) return;

        var toolbar = findToolbar();
        if (!toolbar) return;

        var container = findToolbarContainer(toolbar);
        if (!container) return;

        var root = document.createElement("div");
        root.id = UI.rootId;
        root.style.zIndex = "9999";
        root.style.display = "inline-flex";
        root.style.alignItems = "center";

        root.appendChild(createToolbarButton(UI.btnSearchSenderId, "Search sender", searchByOpenedEmailSender));
        root.appendChild(createToolbarButton(UI.btnMarkReadId, "Mark read (page)", markSelectedMessagesOnPageAsReadAndGoBack));
        root.appendChild(createToolbarButton(UI.btnArchiveId, "Archive (page)", archiveSelectedMessagesOnPageAndGoBack));

        container.appendChild(root);
    }

    // ----------------------------
    // Bootstrap (MutationObserver > setInterval)
    // ----------------------------

    function start() {
        ensureToolbarUI();

        var observer = new MutationObserver(function () {
            ensureToolbarUI();
        });

        observer.observe(document.documentElement, { childList: true, subtree: true });
    }

    start();
})();
