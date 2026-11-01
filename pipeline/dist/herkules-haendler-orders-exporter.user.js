// ==UserScript==
// @name         HerkulesHaendlerOrdersExporter v1
// @namespace    https://github.com/Dattenberger/TampermonkeyScripts
// @version      0.1.2
// @author       Robotico
// @description  Exportiert Bestellungen aus der Herkules-Händler-Dokumenthistorie als CSV im JTL-Format der Husqvarna-Exporter.
// @downloadURL  https://raw.githubusercontent.com/Dattenberger/TampermonkeyScripts/main/pipeline/dist/herkules-haendler-orders-exporter.user.js
// @updateURL    https://raw.githubusercontent.com/Dattenberger/TampermonkeyScripts/main/pipeline/dist/herkules-haendler-orders-exporter.user.js
// @match        https://www.herkules-haendler.de/garten/de/account/*
// @grant        GM_addStyle
// @grant        GM_addValueChangeListener
// @grant        GM_getValue
// @grant        GM_setValue
// ==/UserScript==

(function() {
  'use strict';
	var PLAIN_DECIMAL = /^\d*[.,]?\d+$/;
	function formatFactor(value) {
		return value.toLocaleString("de-DE", {
			useGrouping: false,
			maximumFractionDigits: 20
		});
	}
	function parseFactor(input) {
		let value = NaN;
		if (typeof input === "number") value = input;
		if (typeof input === "string" && PLAIN_DECIMAL.test(input.trim())) value = Number(input.trim().replace(",", "."));
		const shown = Number.isFinite(value) ? Number(formatFactor(value).replace(",", ".")) : NaN;
		return value > 0 && value <= 1 && shown > 0 ? value : null;
	}
	function readFactor(setting) {
		return parseFactor(GM_getValue(setting.key));
	}
	function factorInput(setting) {
		const input = document.createElement("input");
		input.type = "text";
		input.inputMode = "decimal";
		input.autocomplete = "off";
		const show = () => {
			const value = readFactor(setting);
			input.value = value === null ? "" : formatFactor(value);
			input.setAttribute("aria-invalid", String(value === null));
		};
		show();
		input.addEventListener("input", () => {
			const value = parseFactor(input.value);
			GM_setValue(setting.key, value);
			input.setAttribute("aria-invalid", String(value === null));
		});
		GM_addValueChangeListener(setting.key, (_key, _old, _new, remote) => {
			if (remote && document.activeElement !== input) show();
		});
		return input;
	}
	var ROWS = ".modal .itemtable_list .itemtable_row";
	function parseNumber(text) {
		const cleaned = text.replaceAll(/[^\d,.-]/g, "").replaceAll(".", "").replace(",", ".");
		return Number.parseFloat(cleaned);
	}
	function cellText(row, selector) {
		const cell = row.querySelector(selector);
		if (!cell) return "";
		const clone = cell.cloneNode(true);
		for (const label of clone.querySelectorAll(".itemtable_label, [class*=\"visible-\"]")) label.remove();
		return (clone.textContent ?? "").replaceAll(/\s+/g, " ").trim();
	}
	function parsePosition(row) {
		const description = row.querySelector(".description_line");
		const match = /Artikel-Nr\.:\s*(\S+)/.exec(description?.textContent ?? "");
		if (!description || !match?.[1]) return null;
		return {
			articleNumber: match[1],
			name: (description.querySelector("strong")?.textContent ?? "").replaceAll(/\s+/g, " ").trim(),
			quantity: parseNumber(cellText(row, ".text-center")),
			unitPrice: parseNumber(cellText(row, ".text-right.hidden-xs"))
		};
	}
	function parsePositions(doc) {
		return [...doc.querySelectorAll(ROWS)].map((row) => parsePosition(row)).filter((p) => p !== null);
	}
	function parseReferences(doc) {
		const references = new Map();
		let lastArticle;
		for (const row of doc.querySelectorAll(ROWS)) {
			const text = cellText(row, ".description_line");
			const article = /Nr\.:\s*(\S+)/.exec(text)?.[1];
			const reference = /Ihre Referenz:\s*(.+?)\s*$/.exec(text)?.[1];
			if (article) lastArticle = article;
			else if (reference && lastArticle && !references.has(lastArticle)) references.set(lastArticle, reference);
		}
		return references;
	}
	function parseOrderDate(doc) {
		return /Datum:\s*(\d{2}\.\d{2}\.\d{4})/.exec(doc.querySelector(".modal")?.textContent ?? "")?.[1] ?? "";
	}
	var SEPARATOR = ";";
	var BOM = String.fromCodePoint(65279);
	function group(text, regex) {
		return regex.exec(text)?.[1] ?? "";
	}
	function reimportNumber(reference) {
		const orderNumber = group(reference, /^(D-BE\d+)/);
		return orderNumber && `${orderNumber}-I`;
	}
	function toJtlRows(positions, orderNumber, deliveryDate, references, discountFactor) {
		return positions.map((p) => {
			const reference = references.get(p.articleNumber) ?? "";
			const parsedVpe = Number.parseInt(group(reference, /^D-BE\S*\s*VPE=(\d+)/), 10);
			const vpe = Number.isFinite(parsedVpe) && parsedVpe >= 1 ? parsedVpe : 1;
			const quantity = p.quantity * vpe;
			const price = Number.isFinite(p.unitPrice) && quantity > 0 ? p.unitPrice * p.quantity * discountFactor / quantity : NaN;
			return {
				HAN: p.articleNumber,
				"Interne Bestellnummer": reimportNumber(reference),
				Artikelnummer: group(reference, /^D-BE\S*\s*(?:VPE=\d*)?\s*(\S*)/),
				Lieferantenbezeichnung: p.name,
				menge: Number.isFinite(quantity) ? quantity : "",
				"EK netto": Number.isFinite(price) ? price.toFixed(4).replace(".", ",") : "",
				Lieferdatum: deliveryDate,
				Freiposition: "N",
				Fremdbelegnummer: orderNumber
			};
		});
	}
	function csvField(value) {
		const text = value == null ? "" : String(value);
		return /[";\n\r]/.test(text) ? `"${text.replaceAll("\"", "\"\"")}"` : text;
	}
	function toCsv(rows) {
		if (rows.length === 0) return "";
		const header = Object.keys(rows[0]);
		return [header.map((h) => csvField(h)), ...rows.map((row) => header.map((h) => csvField(row[h])))].map((fields) => fields.join(SEPARATOR)).join("\r\n");
	}
	function downloadCsv(csv, filename) {
		const url = URL.createObjectURL(new Blob([BOM + csv], { type: "text/csv;charset=utf-8" }));
		const link = document.createElement("a");
		link.href = url;
		link.download = filename.replaceAll(/[\\/:*?"<>|]+/g, "_");
		document.body.append(link);
		link.click();
		link.remove();
		setTimeout(() => URL.revokeObjectURL(url), 1e4);
	}
	var CSV_BUTTON = "herkules-csv-btn";
	var REFERENCE = "herkules-reference";
	var PANEL_ID = "herkules-export-panel";
	var CSS = `
    .${CSV_BUTTON} {
        display: inline-flex; align-items: center; gap: .4rem;
        margin-left: 12px; padding: 6px 14px;
        border: 1px solid #3d3d3c; border-radius: 8px;
        background: #fff; color: #3d3d3c;
        font: 600 12px/16px Arial, sans-serif; letter-spacing: .03em; text-transform: uppercase;
        cursor: pointer; transition: background-color .15s ease, color .15s ease;
    }
    .${CSV_BUTTON}:hover { background: #3d3d3c; color: #fff; }
    .${CSV_BUTTON}:focus-visible, #${PANEL_ID} input:focus-visible { outline: 2px solid #3d3d3c; outline-offset: 2px; }
    .${CSV_BUTTON}.is-loading { background: #6f6f6f; border-color: #6f6f6f; color: #fff; cursor: progress; }
    .${CSV_BUTTON}.is-success { background: #28a745; border-color: #28a745; color: #fff; }
    .${CSV_BUTTON}.is-warning { background: #ffc107; border-color: #ffc107; color: #212529; }
    .${CSV_BUTTON}.is-error { background: #dc3545; border-color: #dc3545; color: #fff; }
    .${REFERENCE} { display: block; margin-top: 4px; color: #3d3d3c; font: 13px/18px Arial, sans-serif; text-align: right; }
    .${REFERENCE}.is-missing { color: #b02a37; }
    #${PANEL_ID} {
        float: right; box-sizing: border-box; width: 190px; margin: 0 0 12px 24px; padding: 12px 14px;
        background: #fff; border: 1px solid #e0e0e0; border-radius: 8px; box-shadow: 0 2px 10px rgba(0, 0, 0, .12);
        color: #3d3d3c; font: 13px/18px Arial, sans-serif;
    }
    #${PANEL_ID}.is-floating { float: none; position: fixed; right: 16px; bottom: 16px; z-index: 1000; margin: 0; }
    #${PANEL_ID} .herkules-panel-title { margin: 0 0 10px; font-weight: 600; text-transform: uppercase; letter-spacing: .03em; font-size: 12px; }
    #${PANEL_ID} label { display: block; font-weight: 600; }
    #${PANEL_ID} input {
        box-sizing: border-box; width: 100%; margin: 4px 0 6px; padding: 6px 8px;
        border: 1px solid #3d3d3c; border-radius: 6px; font: 14px/18px Arial, sans-serif;
    }
    #${PANEL_ID} input[aria-invalid='true'] { border-color: #dc3545; background: #fff5f5; }
    #${PANEL_ID} small { display: block; color: #6f6f6f; font-size: 11px; line-height: 14px; }
`;
	var BUTTON_TEXT = {
		idle: "CSV",
		loading: "Lädt …",
		success: "✓ CSV",
		warning: "⚠ CSV",
		error: "✗ CSV"
	};
	function setButtonState(button, state, detail) {
		button.textContent = BUTTON_TEXT[state];
		button.disabled = state === "loading";
		for (const name of [
			"is-loading",
			"is-success",
			"is-warning",
			"is-error"
		]) button.classList.remove(name);
		if (state !== "idle") button.classList.add(`is-${state}`);
		if (detail) button.title = detail;
	}
	function attachPanel(setting) {
		if (document.querySelector(`#${PANEL_ID}`)) return;
		GM_addStyle(CSS);
		const panel = document.createElement("aside");
		panel.id = PANEL_ID;
		const title = document.createElement("p");
		title.className = "herkules-panel-title";
		title.textContent = "CSV-Export";
		const label = document.createElement("label");
		label.textContent = "Skonto-Faktor";
		label.title = setting.label;
		label.append(factorInput(setting));
		const hint = document.createElement("small");
		hint.textContent = "Nur lokal in diesem Browser gespeichert.";
		panel.append(title, label, hint);
		const heading = document.querySelector("h1");
		if (heading) heading.before(panel);
		else {
			panel.classList.add("is-floating");
			document.body.append(panel);
		}
	}
	function focusFactor() {
		document.querySelector(`#${PANEL_ID} input`)?.focus();
	}
	var DISCOUNT_FACTOR = {
		key: "herkulesDiscountFactor",
		label: "Skonto-Faktor laut Lieferantenkonditionen (Faktor auf den Netto-Händlerpreis)."
	};
	function field(form, name) {
		return form.elements.namedItem(name)?.value;
	}
	async function fetchDocument(form) {
		const body = new FormData();
		for (const element of form.elements) {
			const { name, value } = element;
			if (name && name !== "request_document_pdf") body.append(name, value);
		}
		const response = await fetch(form.action, {
			method: "POST",
			body,
			credentials: "include"
		});
		if (!response.ok) throw new Error(`HTTP ${response.status}`);
		return new DOMParser().parseFromString(await response.text(), "text/html");
	}
	function relatedForms(orderForm) {
		const forms = [...orderForm.closest(".archiveTable__row")?.querySelectorAll("form") ?? []];
		const byType = (type) => forms.filter((f) => field(f, "document_no") && field(f, "document_type") === type);
		return [...byType("shipment"), ...byType("invoice")];
	}
	async function fetchFirstReference(orderForm) {
		for (const form of relatedForms(orderForm)) {
			const [reference] = parseReferences(await fetchDocument(form)).values();
			if (reference) return reference;
		}
	}
	async function fetchReferences(orderForm) {
		const references = new Map();
		for (const form of relatedForms(orderForm)) for (const [article, reference] of parseReferences(await fetchDocument(form))) if (!references.has(article)) references.set(article, reference);
		return references;
	}
	async function exportOrder(form, button) {
		const orderNumber = field(form, "document_no") ?? "";
		const discountFactor = readFactor(DISCOUNT_FACTOR);
		if (discountFactor === null) {
			setButtonState(button, "error", "Skonto-Faktor fehlt: bitte rechts im Feld eintragen.");
			focusFactor();
			return;
		}
		setButtonState(button, "loading");
		try {
			const doc = await fetchDocument(form);
			const positions = parsePositions(doc);
			if (positions.length === 0) throw new Error("keine Positionen gefunden");
			const rows = toJtlRows(positions, orderNumber, parseOrderDate(doc), await fetchReferences(form), discountFactor);
			downloadCsv(toCsv(rows), `herkules-${orderNumber}.csv`);
			const missing = rows.filter((row) => !row["Interne Bestellnummer"]).length;
			if (missing > 0) setButtonState(button, "warning", `${missing} von ${rows.length} Positionen ohne D-BE-Referenz: Der Import in JTL findet sie nicht.`);
			else setButtonState(button, "success");
		} catch (error) {
			console.error("[HerkulesExporter]", orderNumber, error);
			setButtonState(button, "error", error instanceof Error ? error.message : String(error));
		}
	}
	function makeButton(form) {
		const button = document.createElement("button");
		button.type = "button";
		button.className = `buttonLink ${CSV_BUTTON}`;
		button.title = "CSV für den JTL-Import (gleiches Format wie die Husqvarna-Exporter)";
		button.addEventListener("click", (event) => {
			event.preventDefault();
			event.stopPropagation();
			exportOrder(form, button);
		});
		setButtonState(button, "idle");
		return button;
	}
	var REFERENCE_REQUESTS = 2;
	var referenceQueue = [];
	var referenceWorkers = 0;
	async function runReferenceQueue() {
		if (referenceWorkers >= REFERENCE_REQUESTS) return;
		referenceWorkers += 1;
		for (let job = referenceQueue.shift(); job; job = referenceQueue.shift()) await job();
		referenceWorkers -= 1;
	}
	function makeReference(form) {
		const label = document.createElement("span");
		label.className = REFERENCE;
		label.textContent = "Referenz …";
		referenceQueue.push(async () => {
			try {
				const reference = await fetchFirstReference(form);
				label.textContent = reference ?? "Referenz fehlt";
				label.classList.toggle("is-missing", !reference?.startsWith("D-BE"));
				label.title = reference ? `Ihre Referenz: ${reference}` : "In Lieferschein und Rechnung steht keine „Ihre Referenz“.";
			} catch (error) {
				console.error("[HerkulesExporter]", field(form, "document_no"), error);
				label.textContent = "Referenz ?";
				label.classList.add("is-missing");
			}
		});
		return label;
	}
	function attachExport() {
		const forms = [...document.querySelectorAll("form[action*=\"webshop_document_history\"]")].filter((form) => field(form, "document_type") === "order" && !form.dataset.herkulesExport && form.querySelector("button[name=\"view_document_card\"]"));
		attachPanel(DISCOUNT_FACTOR);
		for (const form of forms) {
			form.dataset.herkulesExport = "1";
			form.querySelector("button[name=\"view_document_card\"]").after(makeButton(form), makeReference(form));
		}
		for (let i = 0; i < Math.min(forms.length, REFERENCE_REQUESTS); i += 1) runReferenceQueue();
	}
	if (/action=webshop_document_history/.test(globalThis.location.search)) {
		attachExport();
		new MutationObserver(() => attachExport()).observe(document.body, {
			childList: true,
			subtree: true
		});
	}
})();
