// ==UserScript==
// @name         HerkulesHaendlerOrdersExporter v1
// @namespace    https://github.com/Dattenberger/TampermonkeyScripts
// @version      0.1.0
// @author       Robotico
// @description  Exportiert Bestellungen aus der Herkules-Händler-Dokumenthistorie als CSV im JTL-Format der Husqvarna-Exporter (und optional Artikel;Menge).
// @downloadURL  https://raw.githubusercontent.com/Dattenberger/TampermonkeyScripts/main/pipeline/dist/herkules-haendler-orders-exporter.user.js
// @updateURL    https://raw.githubusercontent.com/Dattenberger/TampermonkeyScripts/main/pipeline/dist/herkules-haendler-orders-exporter.user.js
// @match        https://www.herkules-haendler.de/garten/de/account/*
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
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
	function askFactor(setting) {
		const current = parseFactor(GM_getValue(setting.key));
		for (;;) {
			const input = globalThis.prompt(`${setting.label}\nWird nur lokal in Tampermonkey gespeichert.`, current === null ? "" : formatFactor(current));
			if (input === null) return null;
			const value = parseFactor(input);
			if (value !== null) {
				GM_setValue(setting.key, value);
				return value;
			}
			globalThis.alert("Bitte eine Zahl größer 0 und höchstens 1 eingeben.");
		}
	}
	function getFactor(setting) {
		return parseFactor(GM_getValue(setting.key)) ?? askFactor(setting);
	}
	function registerFactorMenu(setting, caption) {
		GM_registerMenuCommand(caption, () => {
			askFactor(setting);
		});
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
	function toJtlRows(positions, orderNumber, deliveryDate, references, discountFactor) {
		return positions.map((p) => {
			const reference = references.get(p.articleNumber) ?? "";
			const parsedVpe = Number.parseInt(group(reference, /^D-BE\S*\s*VPE=(\d+)/), 10);
			const vpe = Number.isFinite(parsedVpe) && parsedVpe >= 1 ? parsedVpe : 1;
			const quantity = p.quantity * vpe;
			const price = Number.isFinite(p.unitPrice) && quantity > 0 ? p.unitPrice * p.quantity * discountFactor / quantity : NaN;
			return {
				HAN: p.articleNumber,
				"Interne Bestellnummer": group(reference, /^(D-BE\S*)/).slice(0, 14),
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
	function toArticleQuantityRows(positions) {
		return positions.map((p) => ({
			Artikel: p.articleNumber,
			Menge: Number.isFinite(p.quantity) ? p.quantity : ""
		}));
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
	async function fetchReferences(orderForm) {
		const references = new Map();
		for (const form of relatedForms(orderForm)) for (const [article, reference] of parseReferences(await fetchDocument(form))) if (!references.has(article)) references.set(article, reference);
		return references;
	}
	async function exportOrder(form, button, format) {
		const orderNumber = field(form, "document_no") ?? "";
		const label = (button.textContent ?? "").replace(/^[✓✗] /, "");
		button.disabled = true;
		try {
			const discountFactor = format === "jtl" ? getFactor(DISCOUNT_FACTOR) : 1;
			if (discountFactor === null) throw new Error("Export abgebrochen: kein Skonto-Faktor hinterlegt");
			button.textContent = "Lädt…";
			const doc = await fetchDocument(form);
			const positions = parsePositions(doc);
			if (positions.length === 0) throw new Error("keine Positionen gefunden");
			downloadCsv(toCsv(format === "jtl" ? toJtlRows(positions, orderNumber, parseOrderDate(doc), await fetchReferences(form), discountFactor) : toArticleQuantityRows(positions)), `herkules-${orderNumber}${format === "jtl" ? "" : "-artikel-menge"}.csv`);
			button.textContent = `✓ ${label}`;
		} catch (error) {
			console.error("[HerkulesExporter]", orderNumber, error);
			button.textContent = `✗ ${label}`;
			button.title = error instanceof Error ? error.message : String(error);
		} finally {
			button.disabled = false;
		}
	}
	function makeButton(form, text, title, format) {
		const button = document.createElement("button");
		button.type = "button";
		button.className = "buttonLink herkules-export-btn";
		button.textContent = text;
		button.title = title;
		button.style.marginLeft = "12px";
		button.addEventListener("click", (event) => {
			event.preventDefault();
			event.stopPropagation();
			exportOrder(form, button, format);
		});
		return button;
	}
	function attachButtons() {
		for (const form of document.querySelectorAll("form[action*=\"webshop_document_history\"]")) {
			const details = form.querySelector("button[name=\"view_document_card\"]");
			if (field(form, "document_type") !== "order" || form.dataset.herkulesExport || !details) continue;
			form.dataset.herkulesExport = "1";
			details.after(makeButton(form, "CSV", "Export CSV für JTL (gleiches Format wie Husqvarna-Exporter)", "jtl"), makeButton(form, "Artikel;Menge", "Export Artikel;Menge (Reimport)", "artikel-menge"));
		}
	}
	registerFactorMenu(DISCOUNT_FACTOR, "Skonto-Faktor ändern");
	if (/action=webshop_document_history/.test(globalThis.location.search)) {
		attachButtons();
		new MutationObserver(() => attachButtons()).observe(document.body, {
			childList: true,
			subtree: true
		});
	}
})();
