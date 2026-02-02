// ==UserScript==
// @name         Gmail: Search Sender + Mark Read / Archive
// @namespace    https://github.com/Dattenberger/TampermonkeyScripts
// @version      1.9.0
// @description  Fügt Toolbar-Buttons hinzu: Suche nach Absender, Seite als gelesen markieren, Seite archivieren
// @author       Lukas Dattenberger
// @match        https://mail.google.com/mail/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=google.com
// @updateURL    https://raw.githubusercontent.com/Dattenberger/TampermonkeyScripts/main/gmail-search-by-sender.user.js
// @downloadURL  https://raw.githubusercontent.com/Dattenberger/TampermonkeyScripts/main/gmail-search-by-sender.user.js
// @grant        none
// ==/UserScript==

(function () {
    "use strict";

    // ----------------------------
    // Constants
    // ----------------------------

    const MODES = {
        READ: "read",
        ARCHIVE: "archive"
    };

    const STORAGE_KEY = "gmail-toolbar-mode";

    const SELECTORS = {
        toolbar: 'div[gh="mtb"]',
        toolbarContentContainer: 'div[gh="mtb"] > div > div',
        searchInput: 'input[name="q"]',
        searchForm: '#aso_search_form_anchor',
        searchButton: 'button.gb_Oe',
        senderEmailInMain: 'div[role="main"] span[email]',
        selectAllCheckbox: 'span[role="checkbox"]',
        toolbarIconCandidates: ".bAO"
    };

    const UI_IDS = {
        buttonsRoot: "gmail-toolbar-buttons-root",
        modeDropdown: "gmail-mode-dropdown",
        btnSearchSender: "gmail-btn-search-sender",
        btnMarkReadPage: "gmail-btn-mark-read-page",
        btnArchivePage: "gmail-btn-archive-page"
    };

    const MARK_AS_READ_SPRITE_PATTERN = /drafts/i;

    const GMAIL_SHORTCUTS = {
        markAsRead: { key: "I", shift: true },
        archive: { key: "E", shift: false }
    };

    // ----------------------------
    // State
    // ----------------------------

    let currentMode = localStorage.getItem(STORAGE_KEY) || MODES.ARCHIVE;

    function setMode(mode) {
        currentMode = mode;
        localStorage.setItem(STORAGE_KEY, mode);
        updateButtonVisibility();
    }

    // ----------------------------
    // DOM helpers
    // ----------------------------

    function $(selector) {
        return document.querySelector(selector);
    }

    function $$(selector) {
        return [...document.querySelectorAll(selector)];
    }

    function isVisible(el) {
        if (!el) return false;

        const style = window.getComputedStyle(el);
        if (!style) return true;

        if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") return false;

        let node = el;
        while (node && node.nodeType === 1) {
            if (node.style?.display === "none") return false;
            node = node.parentElement;
        }
        return true;
    }

    function delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    function simulateClick(element) {
        if (!element) return;
        element.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
        element.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true }));
        element.click?.();
    }

    function triggerInputEvent(inputEl) {
        inputEl.dispatchEvent(new Event("input", { bubbles: true }));
    }

    function sendKeyboardShortcut(key, useShift = false) {
        const eventInit = {
            bubbles: true,
            cancelable: true,
            key,
            shiftKey: useShift
        };

        document.dispatchEvent(new KeyboardEvent("keydown", eventInit));
        document.dispatchEvent(new KeyboardEvent("keypress", eventInit));
        document.dispatchEvent(new KeyboardEvent("keyup", eventInit));
    }

    // ----------------------------
    // Gmail DOM lookups
    // ----------------------------

    function getToolbar() {
        return $(SELECTORS.toolbar);
    }

    function getToolbarButtonContainer(toolbar) {
        if (!toolbar) return null;

        const container = toolbar.querySelector(":scope > div > div");
        return container || $(SELECTORS.toolbarContentContainer) || toolbar;
    }

    function getSearchInput() {
        return $(SELECTORS.searchInput);
    }

    function getCurrentEmailSender() {
        return $(SELECTORS.senderEmailInMain)?.getAttribute("email") ?? null;
    }

    function getSelectAllCheckbox() {
        return getToolbar()?.querySelector(SELECTORS.selectAllCheckbox) ?? null;
    }

    function findButtonByAriaLabel(toolbar, patterns) {
        if (!toolbar) return null;

        const candidates = $$('button, [role="button"]').filter(el => toolbar.contains(el));

        for (const el of candidates) {
            if (!isVisible(el)) continue;

            const label = (el.getAttribute("aria-label") || "").trim();
            if (patterns.some(pattern => pattern.test(label))) {
                return el;
            }
        }
        return null;
    }

    function getMarkAsReadButton() {
        const toolbar = getToolbar();
        if (!toolbar) return null;

        const ariaMatch = findButtonByAriaLabel(toolbar, [/mark as read/i, /als gelesen/i, /gelesen markieren/i]);
        if (ariaMatch) return ariaMatch;

        for (const icon of $$(SELECTORS.toolbarIconCandidates)) {
            if (!isVisible(icon)) continue;

            const bgImage = window.getComputedStyle(icon).backgroundImage || "";
            if (!MARK_AS_READ_SPRITE_PATTERN.test(bgImage)) continue;

            const clickable = icon.parentElement?.parentElement ?? icon;
            if (isVisible(clickable)) return clickable;
        }

        return null;
    }

    function getArchiveButton() {
        const toolbar = getToolbar();
        if (!toolbar) return null;

        const ariaMatch = findButtonByAriaLabel(toolbar, [/archive/i, /archiv/i, /archivieren/i]);
        if (ariaMatch) return ariaMatch;

        for (const icon of $$(SELECTORS.toolbarIconCandidates)) {
            if (!isVisible(icon)) continue;

            const bgImage = window.getComputedStyle(icon).backgroundImage || "";
            if (!/archive/i.test(bgImage)) continue;

            const clickable = icon.parentElement?.parentElement ?? icon;
            if (isVisible(clickable)) return clickable;
        }

        return null;
    }

    // ----------------------------
    // Actions
    // ----------------------------

    function searchBySender() {
        const input = getSearchInput();
        if (!input) return;

        const sender = getCurrentEmailSender();
        if (!sender) return;

        // Build search query based on mode
        const searchPrefix = currentMode === MODES.READ ? "is:unread" : "in:inbox";
        input.value = `${searchPrefix} from:${sender}`;

        input.focus();
        triggerInputEvent(input);

        // Execute search by clicking the Gmail search button
        const searchBtn = $(SELECTORS.searchButton);
        if (searchBtn) {
            simulateClick(searchBtn);
        }
    }

    async function markPageAsReadAndGoBack() {
        const selectAll = getSelectAllCheckbox();
        if (!selectAll) return;

        simulateClick(selectAll);
        await delay(60);

        const button = getMarkAsReadButton();
        if (button) {
            simulateClick(button);
        } else {
            sendKeyboardShortcut(GMAIL_SHORTCUTS.markAsRead.key, GMAIL_SHORTCUTS.markAsRead.shift);
        }

        await delay(30);
        history.back();
    }

    async function archivePageAndGoBack() {
        const selectAll = getSelectAllCheckbox();
        if (!selectAll) return;

        simulateClick(selectAll);
        await delay(60);

        const button = getArchiveButton();
        if (button) {
            simulateClick(button);
        } else {
            sendKeyboardShortcut(GMAIL_SHORTCUTS.archive.key, GMAIL_SHORTCUTS.archive.shift);
        }

        await delay(30);
        history.back();
    }

    // ----------------------------
    // UI
    // ----------------------------

    function updateButtonVisibility() {
        const markReadBtn = document.getElementById(UI_IDS.btnMarkReadPage);
        const archiveBtn = document.getElementById(UI_IDS.btnArchivePage);
        const dropdown = document.getElementById(UI_IDS.modeDropdown);

        if (markReadBtn) {
            markReadBtn.style.display = currentMode === MODES.READ ? "inline-block" : "none";
            Object.assign(markReadBtn.style, {
                background: "#4285f4",
                color: "white",
                border: "none"
            });
        }
        if (archiveBtn) {
            archiveBtn.style.display = currentMode === MODES.ARCHIVE ? "inline-block" : "none";
            Object.assign(archiveBtn.style, {
                background: "#34a853",
                color: "white",
                border: "none"
            });
        }
        if (dropdown) {
            const label = dropdown.querySelector("span");
            if (label) {
                label.textContent = currentMode === MODES.ARCHIVE ? "Archive" : "Read";
            }
        }
    }

    function createButton(id, label, onClick, tooltip) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.id = id;
        btn.textContent = label;
        btn.title = tooltip;

        Object.assign(btn.style, {
            marginRight: "0.5em",
            cursor: "pointer",
            padding: "0.35em 0.6em",
            borderRadius: "0.5em",
            border: "1px solid rgba(0,0,0,0.2)",
            background: "rgba(255,255,255,0.9)"
        });

        btn.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            onClick();
        });

        return btn;
    }

    function createModeDropdown() {
        const container = document.createElement("div");
        container.id = UI_IDS.modeDropdown;

        Object.assign(container.style, {
            position: "relative",
            display: "inline-block",
            marginLeft: "0.5em"
        });

        // Button that looks like "Search sender"
        const button = document.createElement("button");
        button.type = "button";
        button.title = "Modus wechseln: Archive (sucht in:inbox) oder Read (sucht is:unread)";

        Object.assign(button.style, {
            cursor: "pointer",
            padding: "0.35em 0.6em",
            borderRadius: "0.5em",
            border: "1px solid rgba(0,0,0,0.2)",
            background: "rgba(255,255,255,0.9)",
            display: "inline-flex",
            alignItems: "center",
            gap: "0.4em"
        });

        const label = document.createElement("span");
        label.textContent = currentMode === MODES.ARCHIVE ? "Archive" : "Read";

        const arrow = document.createElement("span");
        arrow.textContent = "▼";
        arrow.style.fontSize = "0.7em";

        button.appendChild(label);
        button.appendChild(arrow);

        // Dropdown menu
        const menu = document.createElement("div");
        Object.assign(menu.style, {
            position: "absolute",
            top: "100%",
            left: "0",
            marginTop: "2px",
            background: "white",
            border: "1px solid rgba(0,0,0,0.2)",
            borderRadius: "0.5em",
            boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
            zIndex: "10000",
            display: "none",
            minWidth: "100%"
        });

        const createOption = (mode, text) => {
            const option = document.createElement("div");
            option.textContent = text;
            Object.assign(option.style, {
                padding: "0.4em 0.8em",
                cursor: "pointer",
                whiteSpace: "nowrap"
            });
            option.addEventListener("mouseenter", () => {
                option.style.background = "#f1f3f4";
            });
            option.addEventListener("mouseleave", () => {
                option.style.background = "transparent";
            });
            option.addEventListener("click", (e) => {
                e.stopPropagation();
                setMode(mode);
                label.textContent = text;
                menu.style.display = "none";
            });
            return option;
        };

        menu.appendChild(createOption(MODES.ARCHIVE, "Archive"));
        menu.appendChild(createOption(MODES.READ, "Read"));

        button.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            menu.style.display = menu.style.display === "none" ? "block" : "none";
        });

        // Close menu when clicking outside
        document.addEventListener("click", () => {
            menu.style.display = "none";
        });

        container.appendChild(button);
        container.appendChild(menu);

        return container;
    }

    function createButtonsContainer() {
        const root = document.createElement("div");
        root.id = UI_IDS.buttonsRoot;

        Object.assign(root.style, {
            zIndex: "9999",
            display: "inline-flex",
            alignItems: "center"
        });

        // Order: Search sender, Action button (Read/Archive), Mode dropdown
        root.appendChild(createButton(
            UI_IDS.btnSearchSender,
            "Search sender",
            searchBySender,
            "Sucht alle E-Mails vom Absender der aktuell geöffneten E-Mail (im Archive-Modus: in:inbox, im Read-Modus: is:unread)"
        ));
        root.appendChild(createButton(
            UI_IDS.btnMarkReadPage,
            "Mark read (page)",
            markPageAsReadAndGoBack,
            "Wählt alle E-Mails auf dieser Seite aus, markiert sie als gelesen und navigiert zurück"
        ));
        root.appendChild(createButton(
            UI_IDS.btnArchivePage,
            "Archive (page)",
            archivePageAndGoBack,
            "Wählt alle E-Mails auf dieser Seite aus, archiviert sie und navigiert zurück"
        ));
        root.appendChild(createModeDropdown());

        return root;
    }

    function ensureToolbarUI() {
        const toolbar = getToolbar();
        if (!toolbar) return;

        const targetContainer = getToolbarButtonContainer(toolbar);
        if (!targetContainer) return;

        const existingRoot = document.getElementById(UI_IDS.buttonsRoot);

        if (existingRoot) {
            if (existingRoot.parentElement !== targetContainer) {
                targetContainer.appendChild(existingRoot);
            }
            return;
        }

        targetContainer.appendChild(createButtonsContainer());
        updateButtonVisibility();
    }

    // ----------------------------
    // Bootstrap
    // ----------------------------

    function init() {
        ensureToolbarUI();

        const observer = new MutationObserver(() => ensureToolbarUI());
        observer.observe(document.documentElement, { childList: true, subtree: true });
    }

    init();
})();
