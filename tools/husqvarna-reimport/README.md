---
date: 2026-10-28
author: Lukas Dattenberger + Claude (agent session husq-ameise)
status: Accepted
context: Turns a Husqvarna SAP order export (XLSX from Husqvarna's sales office) into the Ameise CSV the portal userscript would have produced, for when the portal export does not work.
related-plan: n/a (board ticket LUK-88)
related-adrs: —
---

# husqvarna-reimport

Fallback for the Husqvarna reimport: when the portal userscript `hsqvrn_protal_orders_exporter.js`
cannot fetch an order, Husqvarna's sales office can send the order as an SAP export (XLSX). This
tool turns that file into the same Ameise CSV, taking the article number and the VPE that the
SAP file lacks from JTL-Wawi, and writes a cross-check next to it.

<!-- toc -->
**Contents**

- [1. Vision and Motivation](#1-vision-and-motivation)
  - [1.1 The Husqvarna order round](#11-the-husqvarna-order-round)
  - [1.2 What the SAP export lacks](#12-what-the-sap-export-lacks)
  - [1.3 Discarded Alternatives](#13-discarded-alternatives)
- [2. Outcomes](#2-outcomes)
- [3. Running it](#3-running-it)
  - [3.1 Import in JTL-Ameise](#31-import-in-jtl-ameise)
- [4. Column mapping](#4-column-mapping)
- [5. Testing](#5-testing)
- [6. Known Limitations](#6-known-limitations)
- [7. References](#7-references)
<!-- /toc -->

## 1. Vision and Motivation

### 1.1 The Husqvarna order round

Each round has up to three supplier orders in JTL:

1. the order from the purchase proposal ("Übernahme in JTL"); usually not kept as its own order;
2. the **base order** `D-BE<n>`: exported with the Lieferantenbestellung export template
   "Husqvarna Export" (Liquid, `Report.tVorlage`) and uploaded to the portal cart; closed by hand
   (status 500) once the reimport exists;
3. the **reimport order** `D-BE<n>-I`: created by the Ameise import of the portal export, carrying
   Husqvarna's prices, the confirmed quantities and Husqvarna's order number as Fremdbelegnummer.

The export template writes per position: Husqvarna article number; quantity divided by the
position's VPE; and the comment `<own order no> VPE=<VPE> <our article no> <name>`. The portal
keeps that comment per line, and the userscript reads VPE and article number back from it.

### 1.2 What the SAP export lacks

The SAP export has no comment column. Its `Position (SD)` is the position in the uploaded cart
times ten, and its `Material` is the HAN with a zero-padded (sometimes `625`-) prefix. The tool
maps each line to the base order position `Position (SD) / 10`, resolves the HAN against the
supplier articles in JTL, and takes the VPE from the base position (what the comment carried),
falling back to the supplier article's VPE.

### 1.3 Discarded Alternatives

- **Inside `pipeline/`** (TypeScript, Vitest): that pipeline bundles userscripts for Tampermonkey;
  a local CLI that shells out to sqlcmd does not belong in its build.
- **Node script next to the userscripts**: reading XLSX needs a zip/XML library in Node; Python's
  standard library has both, so the tool runs with nothing installed.

## 2. Outcomes

1. `<Vertriebsbeleg>-ameise.csv`: byte format of the userscript (jquery-csv `fromObjects`,
   separator `;`, `"` only where needed, header row, LF, UTF-8 without BOM), columns in its order.
2. `<Vertriebsbeleg>-gegenprobe.md`: line counts, quantity and value sums, the base-order positions found, every
   discrepancy (blockers, warnings, notes), VPE lines, and the EK against the latest earlier
   reimport of each HAN.
3. `<Vertriebsbeleg>-jtl-snapshot.json`: the JTL data the run used, so a result can be checked later.

## 3. Running it

On vm-dev2 (sqlcmd with Kerberos, `robotico-core:sqlcmd`):

```bash
python3 -I tools/husqvarna-reimport/husq_reimport.py \
  ~/data/inbound/husqvarna/<date>-<topic>/<order>.XLSX \
  --out-dir ~/data/work/lukas/<date>-husqvarna-ameise
```

- `--base-order D-BE<n>` when the SAP `Bestellnummer` does not end in `-I`; the CSV still names
  the reimport order `D-BE<n>-I`.
- `--out-dir` defaults to `~/data/work/lukas/<today>-husqvarna-ameise`; several orders can share
  it, every file carries the Vertriebsbeleg.
- Environment: `HUSQ_SQLCMD`, `HUSQ_SQL_SERVER`, `HUSQ_SQL_DATABASE` override the sqlcmd binary,
  server and database; `KRB5CCNAME` defaults to `FILE:/tmp/krb5cc_1000`.
- JTL is only read: single SELECTs; inlined values are validated (`D-BE<digits>`, numeric HANs).

| Exit | Meaning |
|---|---|
| 0 | files written, no blocker |
| 2 | bad input (file shape, base order not found) |
| 3 | files written, but a blocker exists (HAN without supplier article, HAN shared by several articles, `-I` already in JTL) — do not import as is |
| 4 | JTL lookup failed (Kerberos ticket, network) |

Read the Gegenprobe before importing. Warnings name lines Husqvarna changed (quantity,
substituted article, added line) — decide whether they stay.

### 3.1 Import in JTL-Ameise

1. Ameise → Import → Lieferantenbestellungen, template **"WebOrder V2.1 - Inkl.
   Fremdbelegnummer"** (supplier Husqvarna Group, warehouse WMS, company robotico; articles are
   found by supplier article number = column HAN; unknown articles are rejected, not imported as
   free positions).
2. Pick the CSV; the import creates the order `D-BE<n>-I` with Fremdbelegnummer = Husqvarna's
   order number.
3. Close the base order `D-BE<n>` by hand, as after a portal reimport.

## 4. Column mapping

| Column | Userscript (portal) | This tool (SAP export + JTL) |
|---|---|---|
| HAN | article no., leading zeros stripped | `Material` digits, zeros stripped; if unknown, its last 9 digits |
| Interne Bestellnummer | customer order no., first 14 chars | `<base order>-I`, first 14 chars (the SAP `Bestellnummer` normally is exactly that) |
| Artikelnummer | from the comment | base position, else supplier article |
| Lieferantenbezeichnung | name + description | `Bezeichnung` |
| menge | (delivered or requested) × VPE | (`Warenausgangsmenge` if > 0, else `Bestätigte Menge`) × VPE |
| EK netto | line net total × 0.97 / menge, 4 decimals | `Net price tot` × 0.97 / menge |
| Lieferdatum | promised dispatch date | `Warenausgangstermin`, else `Warenausgangsdatum`, else `Lieferdatum` |
| Freiposition | `N` | `N` |
| Fremdbelegnummer | portal order no. | `Vertriebsbeleg` |

Lines come out in `Position (SD)` order, i.e. the base order's sequence.

## 5. Testing

`python3 -m unittest discover -s tools/husqvarna-reimport/tests` — synthetic XLSX files built in
the test, a fake sqlcmd runner, no customer data. Covers the XLSX reader, VPE from position and
from supplier article, prefixed HANs, added and missing lines, open lines, the CSV quoting, the
CLI end to end and SQL input validation.

## 6. Known Limitations

1. **SAP column names** are those of the export of 2026-10-28 (order 2013716309); another export
   layout stops with exit 2 and the missing column names.
2. **Price check** compares with the latest earlier `-I` of each HAN; months-old reimports differ
   by price changes, not by error.
3. **No Ameise run is automated**: the import stays a manual step in JTL-Ameise.

## 7. References

- Userscript: [`hsqvrn_protal_orders_exporter.js`](../../hsqvrn_protal_orders_exporter.js) (`prepareCsvDataToExport`)
- JTL: export template "Husqvarna Export" (`Report.tVorlage`, set "Lieferantenbestellung");
  Ameise import template "WebOrder V2.1 - Inkl. Fremdbelegnummer"
- Board ticket LUK-88
