// ==UserScript==
// @name         HerkulesHaendlerOrdersExporter v1
// @namespace    https://github.com/Dattenberger/TampermonkeyScripts
// @version      0.1.3
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
	var PRECISION = 1e10;
	function formatDecimal(value) {
		return value.toLocaleString("de-DE", {
			useGrouping: false,
			maximumFractionDigits: 20
		});
	}
	function parseFactor(input) {
		let value = NaN;
		if (typeof input === "number") value = input;
		if (typeof input === "string" && PLAIN_DECIMAL.test(input.trim())) value = Number(input.trim().replace(",", "."));
		const shown = Number.isFinite(value) ? Number(formatDecimal(value).replace(",", ".")) : NaN;
		return value > 0 && value <= 1 && shown > 0 ? value : null;
	}
	function parseDiscountPercent(input) {
		const text = input.trim().replace(/\s*%$/, "");
		if (!PLAIN_DECIMAL.test(text)) return null;
		const percent = Number(text.replace(",", "."));
		if (percent >= 100) return null;
		return parseFactor(Math.round((1 - percent / 100) * PRECISION) / PRECISION);
	}
	function formatDiscountPercent(factor) {
		return formatDecimal(Math.round((1 - factor) * 100 * PRECISION) / PRECISION);
	}
	function readFactor(setting) {
		return parseFactor(GM_getValue(setting.key));
	}
	function discountPercentInput(setting) {
		const input = document.createElement("input");
		input.type = "text";
		input.inputMode = "decimal";
		input.autocomplete = "off";
		const show = () => {
			const value = readFactor(setting);
			input.value = value === null ? "" : formatDiscountPercent(value);
		};
		show();
		input.addEventListener("input", () => {
			const value = parseDiscountPercent(input.value);
			GM_setValue(setting.key, value);
			input.setAttribute("aria-invalid", String(value === null));
		});
		GM_addValueChangeListener(setting.key, (_key, _old, _new, remote) => {
			if (remote) show();
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
	var ORDER_NUMBERS_KEY = "herkulesOrderNumbers";
	function readAll() {
		return {
			version: 1,
			orders: GM_getValue("herkulesOrderNumbers")?.orders ?? {}
		};
	}
	function readOrderNumber(portalOrder) {
		return readAll().orders[portalOrder]?.orderNumber ?? "";
	}
	function writeOrderNumber(portalOrder, orderNumber) {
		const all = readAll();
		if (orderNumber) all.orders[portalOrder] = {
			orderNumber,
			updatedAt: new Date().toISOString()
		};
		else delete all.orders[portalOrder];
		GM_setValue(ORDER_NUMBERS_KEY, all);
	}
	var SEPARATOR = ";";
	var BOM = String.fromCodePoint(65279);
	function group(text, regex) {
		return regex.exec(text)?.[1] ?? "";
	}
	var ORDER_NUMBER = /^(D-BE\d+)(?:-I)?(?=\s|$)/i;
	function orderNumberOf(reference) {
		return ORDER_NUMBER.exec(reference.trim())?.[1].toUpperCase() ?? "";
	}
	function parseTypedOrderNumber(input) {
		return /^D-BE\d+(?:-I)?$/i.test(input.trim()) ? orderNumberOf(input) : null;
	}
	function toJtlRows(positions, orderNumber, deliveryDate, references, discountFactor, orderNumberInJtl) {
		return positions.map((p) => {
			const reference = references.get(p.articleNumber) ?? "";
			const parsedVpe = Number.parseInt(group(reference, /^D-BE\S*\s*VPE=(\d+)/), 10);
			const vpe = Number.isFinite(parsedVpe) && parsedVpe >= 1 ? parsedVpe : 1;
			const quantity = p.quantity * vpe;
			const price = Number.isFinite(p.unitPrice) && quantity > 0 ? p.unitPrice * p.quantity * discountFactor / quantity : NaN;
			return {
				HAN: p.articleNumber,
				"Interne Bestellnummer": orderNumberInJtl && `${orderNumberInJtl}-I`,
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
	var ORDER_FIELD = "herkules-order-field";
	var SUGGESTED = "is-suggested";
	var INVALID_TEXT = "Keine gültige D-BE-Nummer.";
	var TYPE_IT = "D-BE eintragen";
	function createOrderField(portalOrder, onEdit) {
		const input = document.createElement("input");
		input.type = "text";
		input.autocomplete = "off";
		input.className = ORDER_FIELD;
		input.setAttribute("aria-label", `D-BE-Nummer von Bestellung ${portalOrder}`);
		input.value = readOrderNumber(portalOrder);
		let source = "Die Referenz aus Lieferschein und Rechnung lädt.";
		let placeholder = "lädt …";
		let pending = true;
		let edited = Boolean(input.value);
		const describe = () => {
			input.title = `${edited && input.value ? "Von Hand eingetragen. " : ""}${source ?? ""}`;
			input.placeholder = placeholder;
		};
		describe();
		const commit = () => {
			const value = input.value.trim();
			const number = value ? parseTypedOrderNumber(value) : "";
			if (number === null) {
				input.setAttribute("aria-invalid", "true");
				onEdit(INVALID_TEXT);
				return;
			}
			input.value = number;
			input.removeAttribute("aria-invalid");
			writeOrderNumber(portalOrder, number);
			placeholder = TYPE_IT;
			describe();
			onEdit();
		};
		input.addEventListener("input", () => {
			edited = true;
			input.classList.remove(SUGGESTED);
			input.removeAttribute("aria-invalid");
		});
		input.addEventListener("change", commit);
		input.addEventListener("keydown", (event) => {
			if (event.key !== "Enter") return;
			event.preventDefault();
			commit();
		});
		input.addEventListener("click", (event) => event.stopPropagation());
		return {
			input,
			pending: () => pending,
			read: () => {
				const value = input.value.trim();
				return value ? parseTypedOrderNumber(value) : "";
			},
			showReferences: (references) => {
				pending = false;
				const texts = [...new Set(references.values())];
				const numbers = [...new Set(texts.map((text) => orderNumberOf(text)).filter(Boolean))];
				const portal = texts.length > 0 ? `„Ihre Referenz“ im Portal: ${texts.join(" · ")}` : "In Lieferschein und Rechnung steht keine „Ihre Referenz“.";
				const unique = numbers.length === 1 ? numbers[0] : void 0;
				source = unique ? portal : `Referenz nicht erkannt. ${portal}`;
				placeholder = TYPE_IT;
				if (unique && !edited) {
					input.value = unique;
					input.classList.add(SUGGESTED);
				}
				describe();
			},
			showLoadFailure: () => {
				pending = false;
				source = "Lieferschein oder Rechnung konnten nicht geladen werden. Seite neu laden.";
				placeholder = TYPE_IT;
				describe();
			},
			markInvalid: () => {
				input.setAttribute("aria-invalid", "true");
				input.focus({ preventScroll: true });
			}
		};
	}
	var CSV_BUTTON = "herkules-csv-btn";
	var STATUS = "herkules-status";
	var GROUP = "herkules-export";
	var COLUMN_LABEL = "herkules-column";
	var PANEL_ID = "herkules-export-panel";
	var TAG_TEXT = "Robotico · JTL-Export";
	var BUTTON_TITLE = "CSV dieser Bestellung für den JTL-Import herunterladen";
	var INK = "#3d3d3c";
	var MUTED = "#6f6f6f";
	var CSS = `
    @media (min-width: 768px) { .archiveTable__typeLine, .archiveTable__dateLine, .archiveTable__totalLine { width: 125px; } }
    form[data-herkules-export] { display: flex; align-items: center; justify-content: flex-end; gap: 16px; }
    .${COLUMN_LABEL} {
        display: inline-block; width: 214px; margin-left: 16px; text-align: left; vertical-align: middle;
        color: ${MUTED}; font: 600 11px/14px Arial, sans-serif; letter-spacing: .04em; text-transform: uppercase;
    }
    .${GROUP} {
        flex: 0 0 auto; box-sizing: border-box; width: 214px; max-width: 100%; margin: 0; padding: 6px 7px;
        border: 1px solid #dcdcdc; border-left: 3px solid ${INK}; border-radius: 6px; background: #fafafa;
        color: ${INK}; font: 12px/16px Arial, sans-serif; text-align: left;
    }
    .herkules-tag { display: block; margin: 0 0 8px; color: ${MUTED}; font: 600 10px/12px Arial, sans-serif; letter-spacing: .04em; text-transform: uppercase; }
    .herkules-export-line { display: flex; gap: 6px; align-items: center; }
    input.${ORDER_FIELD} {
        box-sizing: border-box; flex: 1 1 auto; width: 0; min-width: 0; height: 28px; margin: 0; padding: 3px 7px;
        border: 1px solid #bbb; border-radius: 5px; background: #fff; color: ${INK}; font: 13px/18px Arial, sans-serif;
    }
    input.${ORDER_FIELD}::placeholder { color: #8a8a8a; }
    input.${ORDER_FIELD}.is-suggested { color: #767676; }
    input.${ORDER_FIELD}:focus-visible { outline: 2px solid ${INK}; outline-offset: 1px; }
    input.${ORDER_FIELD}[aria-invalid='true'] { border-color: #dc3545; background: #fff5f5; }
    button.${CSV_BUTTON} {
        flex: 0 0 auto; box-sizing: border-box; min-width: 54px; height: 28px; margin: 0; padding: 0 8px;
        border: 1px solid ${INK}; border-radius: 5px; background: #fff; color: ${INK};
        font: 600 12px/16px Arial, sans-serif; letter-spacing: .03em; text-transform: uppercase; white-space: nowrap;
        cursor: pointer; transition: background-color .15s ease, color .15s ease;
    }
    button.${CSV_BUTTON}:hover { background: ${INK}; color: #fff; }
    button.${CSV_BUTTON}:focus-visible, #${PANEL_ID} input:focus-visible { outline: 2px solid ${INK}; outline-offset: 2px; }
    button.${CSV_BUTTON}.is-loading { background: ${MUTED}; border-color: ${MUTED}; color: #fff; cursor: progress; }
    button.${CSV_BUTTON}.is-success { background: #1e7e34; border-color: #1e7e34; color: #fff; }
    button.${CSV_BUTTON}.is-error { background: #dc3545; border-color: #dc3545; color: #fff; }
    button.${CSV_BUTTON}.is-success:hover { background: #155d27; border-color: #155d27; }
    button.${CSV_BUTTON}.is-error:hover { background: #bd2130; border-color: #bd2130; }
    .${STATUS} { display: block; margin: 5px 0 0; color: #b02a37; font: 11px/14px Arial, sans-serif; }
    .${STATUS}:empty { display: none; }
    .${STATUS}.is-info { color: #1e7e34; }
    #${PANEL_ID} {
        float: right; box-sizing: border-box; width: 210px; margin: 0 0 12px 24px; padding: 10px 12px 12px;
        background: #fafafa; border: 1px solid #dcdcdc; border-left: 3px solid ${INK}; border-radius: 6px;
        color: ${INK}; font: 13px/18px Arial, sans-serif;
    }
    #${PANEL_ID}.is-floating { float: none; position: fixed; right: 16px; bottom: 16px; z-index: 1000; margin: 0; box-shadow: 0 2px 10px rgba(0, 0, 0, .12); }
    #${PANEL_ID} label { display: block; color: ${INK}; font-weight: 600; }
    .herkules-percent { display: flex; align-items: center; gap: 6px; margin: 4px 0 6px; font-weight: 400; }
    #${PANEL_ID} input {
        box-sizing: border-box; width: 72px; margin: 0; padding: 5px 8px; text-align: right;
        border: 1px solid #bbb; border-radius: 5px; background: #fff; font: 14px/18px Arial, sans-serif;
    }
    #${PANEL_ID} input[aria-invalid='true'] { border-color: #dc3545; background: #fff5f5; }
    #${PANEL_ID} small { display: block; color: ${MUTED}; font-size: 11px; line-height: 14px; }
    @media (max-width: 880px) { #${PANEL_ID}:not(.is-floating) { float: none; width: auto; margin: 0 0 12px; } }
`;
	var BUTTON_TEXT = {
		idle: "CSV ↓",
		loading: "…",
		success: "✓ CSV",
		error: "✗ CSV"
	};
	function setButtonState(button, state, status, detail) {
		button.textContent = BUTTON_TEXT[state];
		button.disabled = state === "loading";
		for (const name of [
			"is-loading",
			"is-success",
			"is-error"
		]) button.classList.remove(name);
		if (state !== "idle") button.classList.add(`is-${state}`);
		button.title = detail ?? BUTTON_TITLE;
		status.textContent = detail ?? "";
		status.classList.toggle("is-info", state === "success");
	}
	function tag() {
		const element = document.createElement("span");
		element.className = "herkules-tag";
		element.textContent = TAG_TEXT;
		return element;
	}
	function exportGroup(field, button, status) {
		const group = document.createElement("div");
		group.className = GROUP;
		group.title = TAG_TEXT;
		const line = document.createElement("div");
		line.className = "herkules-export-line";
		line.append(field, button);
		group.append(line, status);
		return group;
	}
	function labelColumn() {
		const head = document.querySelector(".archiveTable__header .archiveTable__actionLine");
		if (!head || head.querySelector(`.${COLUMN_LABEL}`)) return;
		const label = document.createElement("span");
		label.className = COLUMN_LABEL;
		label.textContent = TAG_TEXT;
		head.append(label);
	}
	function attachPanel(setting) {
		if (document.querySelector(`#${PANEL_ID}`)) return;
		GM_addStyle(CSS);
		const panel = document.createElement("aside");
		panel.id = PANEL_ID;
		const label = document.createElement("label");
		label.textContent = "Skonto-Wert";
		label.title = setting.label;
		const percent = document.createElement("span");
		percent.className = "herkules-percent";
		const input = discountPercentInput(setting);
		input.placeholder = "–";
		percent.append(input, "%");
		label.append(percent);
		const hint = document.createElement("small");
		hint.textContent = "Wird in der CSV vom Netto-Händlerpreis abgezogen. Nur in diesem Browser gespeichert.";
		panel.append(tag(), label, hint);
		const heading = document.querySelector("h1");
		if (heading) heading.before(panel);
		else {
			panel.classList.add("is-floating");
			document.body.append(panel);
		}
	}
	function focusFactor() {
		const input = document.querySelector(`#${PANEL_ID} input`);
		input?.setAttribute("aria-invalid", "true");
		input?.focus({ preventScroll: true });
	}
	var DISCOUNT_FACTOR = {
		key: "herkulesDiscountFactor",
		label: "Skonto laut Lieferantenkonditionen, in Prozent vom Netto-Händlerpreis."
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
	var loadedReferences = new WeakMap();
	function referencesOf(form) {
		const known = loadedReferences.get(form);
		if (known) return known;
		const loading = fetchReferences(form);
		loadedReferences.set(form, loading);
		loading.catch(() => loadedReferences.delete(form));
		return loading;
	}
	function exportValues({ button, status, field }, allowEmpty) {
		const fail = (reason) => {
			setButtonState(button, "error", status, reason);
			return null;
		};
		const orderNumberInJtl = field.read();
		if (orderNumberInJtl === null || orderNumberInJtl === "" && !allowEmpty && !field.pending()) {
			field.markInvalid();
			return fail(orderNumberInJtl === null ? INVALID_TEXT : "D-BE fehlt. Doppelklick auf CSV exportiert ohne Nummer.");
		}
		if (orderNumberInJtl === "" && field.pending()) return fail("Referenz lädt noch, gleich erneut klicken.");
		const discountFactor = readFactor(DISCOUNT_FACTOR);
		if (discountFactor === null) {
			focusFactor();
			return fail("Skonto-Wert fehlt (oben rechts).");
		}
		return {
			orderNumberInJtl,
			discountFactor
		};
	}
	async function exportOrder(row, allowEmpty = false) {
		const { form, button, status } = row;
		const orderNumber = field(form, "document_no") ?? "";
		if (!exportValues(row, allowEmpty)) return;
		setButtonState(button, "loading", status);
		try {
			const doc = await fetchDocument(form);
			const positions = parsePositions(doc);
			if (positions.length === 0) throw new Error("keine Positionen gefunden");
			const references = await referencesOf(form);
			const values = exportValues(row, allowEmpty);
			if (!values) return;
			downloadCsv(toCsv(toJtlRows(positions, orderNumber, parseOrderDate(doc), references, values.discountFactor, values.orderNumberInJtl)), `herkules-${orderNumber}.csv`);
			setButtonState(button, "success", status, values.orderNumberInJtl ? `Heruntergeladen: ${values.orderNumberInJtl}-I` : "Ohne Nummer heruntergeladen, JTL vergibt eine.");
			row.field.input.removeAttribute("aria-invalid");
		} catch (error) {
			console.error("[HerkulesExporter]", orderNumber, error);
			setButtonState(button, "error", status, error instanceof Error ? error.message : String(error));
		}
	}
	function makeStatus() {
		const status = document.createElement("span");
		status.className = STATUS;
		status.setAttribute("role", "status");
		return status;
	}
	function makeRow(form) {
		const orderNumber = field(form, "document_no") ?? "";
		const status = makeStatus();
		const button = document.createElement("button");
		const orderField = createOrderField(orderNumber, (problem) => {
			if (!button.disabled) setButtonState(button, "idle", status, problem);
		});
		const row = {
			form,
			button,
			status,
			field: orderField
		};
		button.type = "button";
		button.className = CSV_BUTTON;
		button.setAttribute("aria-label", `CSV für Bestellung ${orderNumber}`);
		button.addEventListener("click", (event) => {
			event.preventDefault();
			event.stopPropagation();
			if (event.detail < 2) exportOrder(row);
		});
		button.addEventListener("dblclick", (event) => {
			event.preventDefault();
			event.stopPropagation();
			if (orderField.read() === "") exportOrder(row, true);
		});
		setButtonState(button, "idle", status);
		return row;
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
	function queueReferences({ form, field: orderField }) {
		referenceQueue.push(async () => {
			try {
				orderField.showReferences(await referencesOf(form));
			} catch (error) {
				console.error("[HerkulesExporter]", field(form, "document_no"), error);
				orderField.showLoadFailure();
			}
		});
	}
	function attachExport() {
		attachPanel(DISCOUNT_FACTOR);
		labelColumn();
		let added = 0;
		for (const form of document.querySelectorAll("form[action*=\"webshop_document_history\"]")) {
			const details = form.querySelector("button[name=\"view_document_card\"]");
			if (field(form, "document_type") !== "order" || form.dataset.herkulesExport || !details) continue;
			form.dataset.herkulesExport = "1";
			const row = makeRow(form);
			details.after(exportGroup(row.field.input, row.button, row.status));
			queueReferences(row);
			added += 1;
		}
		for (let i = 0; i < Math.min(added, REFERENCE_REQUESTS); i += 1) runReferenceQueue();
	}
	if (/action=webshop_document_history/.test(globalThis.location.search)) {
		attachExport();
		new MutationObserver(() => attachExport()).observe(document.body, {
			childList: true,
			subtree: true
		});
	}
})();
