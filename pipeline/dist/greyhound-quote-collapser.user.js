// ==UserScript==
// @name         Greyhound Quote Collapser
// @namespace    https://robotico.de/
// @version      2.0.0
// @author       Lukas Dattenberger
// @description  Klappt Signatur+Verlauf in Greyhound-E-Mails ein. Manipuliert das iframe-Document direkt (kein Klon), weil Greyhound die Mail in <iframe srcdoc> rendert und React den iframe-Inhalt nicht reconciliert.
// @downloadURL  https://raw.githubusercontent.com/Dattenberger/TampermonkeyScripts/main/pipeline/dist/greyhound-quote-collapser.user.js
// @updateURL    https://raw.githubusercontent.com/Dattenberger/TampermonkeyScripts/main/pipeline/dist/greyhound-quote-collapser.user.js
// @match        https://greyhound.dattenberger.com/web/unity/*
// @run-at       document-idle
// ==/UserScript==

(function() {
  'use strict';
	function cleanupLegacyClones(root = document) {
		for (const el of root.querySelectorAll(".gh-qc-clone")) el.remove();
		for (const el of root.querySelectorAll(".gh-qc-original-hidden")) el.classList.remove("gh-qc-original-hidden");
		for (const el of root.querySelectorAll(".gh-qc-processed")) el.classList.remove("gh-qc-processed");
	}
	function debounce(fn, ms) {
		let timer;
		return (...args) => {
			if (timer !== void 0) clearTimeout(timer);
			timer = setTimeout(() => {
				timer = void 0;
				fn(...args);
			}, ms);
		};
	}
	var CFG = {
		itemSelector: "[class*=\"chatView__itemContent___\"]",
		outgoingSelector: "[class*=\"chatView__itemOutgoing\"]",
		iframeSelector: "iframe[srcdoc]",
		wrapperClass: "gh-qc-collapsed",
		visibleClass: "gh-qc-visible",
		btnClass: "gh-qc-toggle",
		btnQuoteClass: "gh-qc-toggle-quote",
		btnDetectedSigClass: "gh-qc-toggle-detected-sig",
		legacyCloneClass: "gh-qc-clone",
		quotePatterns: [
			/-{3,}\s*Urspr(ü|ue)ngliche Daten\s*-{3,}/i,
			/-{3,}\s*Original Message\s*-{3,}/i,
			/-{3,}\s*Forwarded message\s*-{3,}/i,
			/^Am .{1,120} schrieb .+:?$/m
		],
		footerPatterns: [
			/^[-_]{2,}\s*$/m,
			/^Robotico\.de\s*$/im,
			/^Datenschutz\s*:/im,
			/^Mährobotertechnik\b/im
		],
		debounceMs: 80,
		threadSigMaxIterations: 10
	};
	var STYLE_MARKER_ATTR = "data-gh-qc";
	var IFRAME_CSS = `
    .${CFG.wrapperClass} { display: none; }
    .${CFG.wrapperClass}.${CFG.visibleClass} { display: block; }
    .${CFG.btnClass} {
        display: inline-block;
        margin: 6px 6px 6px 0;
        padding: 3px 10px;
        font-size: 11px;
        background: #f0f0f0;
        border: 1px solid #ccc;
        border-radius: 3px;
        cursor: pointer;
        color: #555;
        font-family: inherit;
        user-select: none;
    }
    .${CFG.btnClass}:hover { background: #e5e5e5; }
    .${CFG.btnDetectedSigClass} {
        background: #e8f4fd;
        border-color: #a8d4f4;
        color: #2c5d8a;
    }
    .${CFG.btnDetectedSigClass}:hover { background: #d4ecfc; }
`;
	function collectTextNodes(container) {
		const doc = container.ownerDocument;
		const nodes = [];
		const walker = doc.createTreeWalker(container, NodeFilter.SHOW_TEXT, { acceptNode(node) {
			const text = node;
			let parent = text.parentNode;
			while (parent !== null && parent !== container) {
				if (parent instanceof Element && parent.classList.contains(CFG.wrapperClass)) return NodeFilter.FILTER_REJECT;
				parent = parent.parentNode;
			}
			if (text.parentElement?.closest(`.${CFG.btnClass}`) != null) return NodeFilter.FILTER_REJECT;
			if ((text.nodeValue ?? "").trim().length === 0) return NodeFilter.FILTER_REJECT;
			return NodeFilter.FILTER_ACCEPT;
		} });
		let current = walker.nextNode();
		while (current !== null) {
			nodes.push(current);
			current = walker.nextNode();
		}
		return nodes;
	}
	function makeToggleBtn(doc, label, typeClass) {
		const btn = doc.createElement("button");
		btn.type = "button";
		btn.className = `${CFG.btnClass} ${typeClass}`;
		btn.dataset.label = label;
		btn.textContent = `↓ ${label} anzeigen`;
		return btn;
	}
	function findInRange(container, patterns, startAfter, endBefore) {
		const nodes = collectTextNodes(container);
		let startIdx = 0;
		if (startAfter !== null) {
			const idx = nodes.indexOf(startAfter);
			if (idx === -1) return null;
			startIdx = idx + 1;
		}
		let endIdx = nodes.length;
		if (endBefore !== null) {
			const idx = nodes.indexOf(endBefore);
			if (idx !== -1) endIdx = idx;
		}
		for (let i = startIdx; i < endIdx; i++) {
			const node = nodes[i];
			if (!node) continue;
			const text = node.nodeValue ?? "";
			let bestIndex = -1;
			for (const pattern of patterns) {
				const m = pattern.exec(text);
				if (m && (bestIndex < 0 || m.index < bestIndex)) bestIndex = m.index;
			}
			if (bestIndex >= 0) return {
				type: "text",
				node,
				index: bestIndex
			};
		}
		return null;
	}
	function findQuoteCutoff(container) {
		const textHit = findInRange(container, CFG.quotePatterns, null, null);
		if (textHit !== null) return textHit;
		const blockquotes = container.querySelectorAll("blockquote");
		for (const bq of blockquotes) {
			let cursor = bq.parentNode;
			let inNestedWrapper = false;
			while (cursor !== null && cursor !== container) {
				if (cursor instanceof Element && cursor.classList.contains(CFG.wrapperClass)) {
					inNestedWrapper = true;
					break;
				}
				cursor = cursor.parentNode;
			}
			if (!inNestedWrapper) return {
				type: "element",
				node: bq
			};
		}
		return null;
	}
	function findFooterCutoff(container, beforeCutoff) {
		const endBefore = beforeCutoff !== null && beforeCutoff.type === "text" ? beforeCutoff.node : null;
		return findInRange(container, CFG.footerPatterns, null, endBefore);
	}
	function liftToTopLevel(container, startNode) {
		let current = startNode;
		while (current.parentNode !== null && current.parentNode !== container) {
			const parent = current.parentNode;
			const restSibling = parent.cloneNode(false);
			let cursor = current;
			while (cursor !== null) {
				const next = cursor.nextSibling;
				restSibling.append(cursor);
				cursor = next;
			}
			if (parent.parentNode !== null) parent.parentNode.insertBefore(restSibling, parent.nextSibling);
			current = restSibling;
		}
		return current;
	}
	function applyCutoff(container, cutoff, label, endNode = null, typeClass = CFG.btnQuoteClass) {
		const doc = container.ownerDocument;
		const topNode = liftToTopLevel(container, cutoff.type === "text" ? cutoff.index === 0 ? cutoff.node : cutoff.node.splitText(cutoff.index) : cutoff.node);
		const wrapper = doc.createElement("div");
		wrapper.className = CFG.wrapperClass;
		const btn = makeToggleBtn(doc, label, typeClass);
		topNode.before(btn);
		topNode.before(wrapper);
		let cursor = topNode;
		while (cursor !== null && cursor !== endNode) {
			const next = cursor.nextSibling;
			wrapper.append(cursor);
			cursor = next;
		}
		return {
			btn,
			wrapper
		};
	}
	function applyCutoffWithLiftedEnd(container, sigCutoff, endCutoff, label, typeClass) {
		let endTopNode = null;
		let endStart = null;
		if (endCutoff !== null) {
			endStart = endCutoff.index === 0 ? endCutoff.node : endCutoff.node.splitText(endCutoff.index);
			endTopNode = liftToTopLevel(container, endStart);
		}
		return {
			...applyCutoff(container, sigCutoff, label, endTopNode, typeClass),
			endStart
		};
	}
	var INTERACTIVE_OR_MEDIA_SELECTOR = "img, svg, video, audio, button, input, iframe, a";
	var WHITESPACE_INCLUDING_NBSP = /[\u00A0\s]/g;
	function isVisuallyEmpty(el) {
		if (el.classList.contains(CFG.wrapperClass)) return false;
		if (el.classList.contains(CFG.btnClass)) return false;
		if (el.querySelector(INTERACTIVE_OR_MEDIA_SELECTOR) !== null) return false;
		return (el.textContent ?? "").replaceAll(WHITESPACE_INCLUDING_NBSP, "").length === 0;
	}
	function cleanupWhitespace(root) {
		const toRemove = [];
		for (const el of root.querySelectorAll("p")) if (isVisuallyEmpty(el)) toRemove.push(el);
		for (const el of toRemove) el.remove();
	}
	function detectSigsInThread(threadWrapper, skipUntilFirstQuote) {
		let searchAfterNode = null;
		if (skipUntilFirstQuote) {
			const firstQuote = findInRange(threadWrapper, CFG.quotePatterns, null, null);
			if (firstQuote === null) return;
			searchAfterNode = firstQuote.node;
		}
		for (let i = 0; i < CFG.threadSigMaxIterations; i++) {
			const sig = findInRange(threadWrapper, CFG.footerPatterns, searchAfterNode, null);
			if (sig === null) break;
			const result = applyCutoffWithLiftedEnd(threadWrapper, sig, findInRange(threadWrapper, CFG.quotePatterns, sig.node, null), "Signatur", CFG.btnDetectedSigClass);
			if (result.endStart === null) break;
			searchAfterNode = result.endStart;
		}
	}
	function processBody(body, direction) {
		const quote = findQuoteCutoff(body);
		let outerCutoff = null;
		let outerLabel = "Älteren Verlauf";
		let cutoffIsFooter = false;
		if (direction === "outgoing") {
			const footer = findFooterCutoff(body, quote);
			if (footer !== null) {
				outerCutoff = footer;
				cutoffIsFooter = true;
				outerLabel = "Signatur & Verlauf";
			}
		}
		if (outerCutoff === null) outerCutoff = quote;
		if (outerCutoff !== null) detectSigsInThread(applyCutoff(body, outerCutoff, outerLabel, null, CFG.btnQuoteClass).wrapper, cutoffIsFooter);
		cleanupWhitespace(body);
	}
	function injectStyles(doc) {
		if (doc.querySelector(`style[data-gh-qc]`) !== null) return;
		const style = doc.createElement("style");
		style.setAttribute(STYLE_MARKER_ATTR, "1");
		style.textContent = IFRAME_CSS;
		(doc.head ?? doc.documentElement).append(style);
	}
	function updateIframeHeight(iframe) {
		const doc = iframe.contentDocument;
		if (doc === null) return;
		const root = doc.documentElement;
		const body = doc.body;
		const newHeight = Math.max(root.scrollHeight, body.scrollHeight);
		if (newHeight > 0) iframe.style.height = `${newHeight}px`;
	}
	var delegatedDocs = new WeakSet();
	function setupClickDelegation(iframe, doc) {
		if (delegatedDocs.has(doc)) return;
		delegatedDocs.add(doc);
		doc.addEventListener("click", (event) => {
			const target = event.target;
			if (target === null) return;
			const closest = target.closest(`.${CFG.btnClass}`);
			if (closest === null) return;
			const btn = closest;
			event.preventDefault();
			event.stopPropagation();
			const wrapper = btn.nextElementSibling;
			if (wrapper === null || !wrapper.classList.contains(CFG.wrapperClass)) return;
			const nowVisible = wrapper.classList.toggle(CFG.visibleClass);
			const label = btn.dataset.label ?? "";
			btn.textContent = `${nowVisible ? "↑ " : "↓ "}${label}${nowVisible ? " ausblenden" : " anzeigen"}`;
			(doc.defaultView?.requestAnimationFrame ?? globalThis.requestAnimationFrame)(() => {
				updateIframeHeight(iframe);
			});
		});
	}
	var processedDocs = new WeakSet();
	var setupIframes = new WeakSet();
	function safeContentDoc(iframe) {
		try {
			return iframe.contentDocument;
		} catch {
			return null;
		}
	}
	function processIframe(iframe, direction) {
		const doc = safeContentDoc(iframe);
		if (doc === null) return;
		if (processedDocs.has(doc)) return;
		if (doc.body === null) return;
		processedDocs.add(doc);
		injectStyles(doc);
		setupClickDelegation(iframe, doc);
		processBody(doc.body, direction);
		(doc.defaultView?.requestAnimationFrame ?? globalThis.requestAnimationFrame)(() => {
			updateIframeHeight(iframe);
		});
	}
	function setupIframe(iframe, direction) {
		if (setupIframes.has(iframe)) return;
		setupIframes.add(iframe);
		const handleLoad = () => {
			const doc = safeContentDoc(iframe);
			if (doc !== null) processedDocs.delete(doc);
			processIframe(iframe, direction);
		};
		iframe.addEventListener("load", handleLoad);
		const doc = safeContentDoc(iframe);
		if (doc !== null && doc.readyState === "complete" && doc.body !== null) processIframe(iframe, direction);
	}
	var processedItems = new WeakSet();
	function getDirection(itemEl) {
		return itemEl.closest(CFG.outgoingSelector) === null ? "incoming" : "outgoing";
	}
	function setupItem(itemEl) {
		if (processedItems.has(itemEl)) return;
		if (itemEl.classList.contains(CFG.legacyCloneClass)) return;
		processedItems.add(itemEl);
		const direction = getDirection(itemEl);
		const setupAllIframes = () => {
			for (const iframe of itemEl.querySelectorAll(CFG.iframeSelector)) setupIframe(iframe, direction);
		};
		setupAllIframes();
		new MutationObserver(setupAllIframes).observe(itemEl, {
			childList: true,
			subtree: true
		});
	}
	function scanForItems() {
		for (const itemEl of document.querySelectorAll(CFG.itemSelector)) {
			if (itemEl.classList.contains(CFG.legacyCloneClass)) continue;
			setupItem(itemEl);
		}
	}
	var triggerScan = debounce(scanForItems, CFG.debounceMs);
	var discoveryObserver = new MutationObserver((mutations) => {
		let needsScan = false;
		for (const mutation of mutations) for (const added of mutation.addedNodes) {
			if (added.nodeType !== Node.ELEMENT_NODE) continue;
			const el = added;
			if (el.matches(CFG.itemSelector) || el.querySelector(CFG.itemSelector) !== null) needsScan = true;
		}
		if (needsScan) triggerScan();
	});
	function startDiscovery() {
		discoveryObserver.observe(document.body, {
			childList: true,
			subtree: true
		});
		scanForItems();
	}
	cleanupLegacyClones();
	startDiscovery();
	console.log("[Greyhound Quote Collapser v2.0] aktiv – iframe-direkter Ansatz");
})();
