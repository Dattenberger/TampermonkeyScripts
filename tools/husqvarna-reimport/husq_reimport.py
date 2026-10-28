#!/usr/bin/env python3
"""Husqvarna SAP order export → Ameise CSV for the reimport order (`D-BE…-I`).

Usage: python3 -I husq_reimport.py <export.xlsx> [--out-dir DIR] [--base-order D-BE…]

Writes into DIR, named after the SAP Vertriebsbeleg: `<Vertriebsbeleg>-ameise.csv` (the import
file), `<Vertriebsbeleg>-gegenprobe.md` (counts, sums, every discrepancy) and
`<Vertriebsbeleg>-jtl-snapshot.json` (the JTL data the run used).
Exit codes: 0 ok · 2 bad input · 3 blockers found (files written, do not import as is) ·
4 JTL lookup failed. See README.md.
"""

from __future__ import annotations

import argparse
import dataclasses
import datetime as dt
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))  # siblings, also under python3 -I

import jtl  # noqa: E402
import sap_xlsx  # noqa: E402
import transform  # noqa: E402


def _default_out_dir() -> Path:
    return Path.home() / "data" / "work" / "lukas" / f"{dt.date.today():%Y-%m-%d}-husqvarna-ameise"


def _fmt(value: float) -> str:
    return f"{value:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


def _qty(value: float) -> str:
    return transform.format_quantity(value)


def gegenprobe(sap_lines, base, existing_reimport, positions, result, csv_name) -> str:
    rows = result.rows
    vpe_lines = [l for l in result.lines if l["vpe"] > 1]
    priced = [l for l in result.lines if l["previous_ek"]]
    exact = [l for l in priced if abs(l["ek"] - l["previous_ek"]) <= 0.0001]
    off = sorted((l for l in priced if abs(l["ek"] / l["previous_ek"] - 1) > 0.02),
                 key=lambda l: -abs(l["ek"] / l["previous_ek"] - 1))
    sap_total = sum(l.total_net for l in sap_lines)
    csv_total = sum(l["quantity"] * l["ek"] for l in result.lines)

    out = [
        f"# Gegenprobe {sap_lines[0].sales_document} → {csv_name}",
        "",
        f"Erzeugt {dt.datetime.now():%Y-%m-%d %H:%M} von `husq_reimport.py`.",
        "",
        "| Prüfung | Wert |",
        "|---|---|",
        f"| Basisbestellung | {base.number} (k={base.k_order}, Status {base.status}) |",
        f"| Reimport-Bestellung `{base.number}-I` schon in JTL | "
        f"{'JA – Import würde doppeln' if existing_reimport else 'nein'} |",
        f"| Zeilen SAP / CSV | {len(sap_lines)} / {len(rows)} |",
        f"| Positionen Basisbestellung / davon in SAP gefunden | {len(positions)} / {result.matched_positions} |",
        f"| Summe Bestätigte Menge (SAP) | {_qty(sum(l.confirmed for l in sap_lines))} |",
        f"| Summe menge (CSV, nach VPE) | {_qty(sum(l['quantity'] for l in result.lines))} |",
        f"| Summe fMenge Basisbestellung | {_qty(sum(p.quantity for p in positions))} |",
        f"| Zeilen mit VPE > 1 | {len(vpe_lines)} |",
        f"| Net price tot (SAP) × 0,97 | {_fmt(sap_total * transform.DISCOUNT_FACTOR)} |",
        f"| Σ menge × EK netto (CSV) | {_fmt(csv_total)} |",
        f"| EK mit Vorgänger-Reimport vergleichbar / exakt gleich / > 2 % abweichend | "
        f"{len(priced)} / {len(exact)} / {len(off)} |",
        f"| Blocker / Warnungen / Hinweise | {len(result.blockers)} / {len(result.warnings)} / {len(result.notes)} |",
        "",
    ]

    def section(title, findings):
        out.extend([f"## {title}", ""])
        if not findings:
            out.extend(["keine", ""])
            return
        out.extend(["| Pos (SD) | Material | Bezeichnung | Befund |", "|---|---|---|---|"])
        for f in sorted(findings, key=lambda f: f.position):
            out.append(f"| {f.position} | {f.material} | {f.description} | {f.message} |")
        out.append("")

    section("Blocker (Import so nicht möglich)", result.blockers)
    section("Warnungen (Lukas entscheidet)", result.warnings)
    section("Hinweise", result.notes)

    out.extend(["## VPE-Zeilen", ""])
    if vpe_lines:
        out.extend(["| Pos (SD) | HAN | VPE | menge |", "|---|---|---|---|"])
        out += [f"| {l['position']} | {l['han']} | {l['vpe']} | {_qty(l['quantity'])} |" for l in vpe_lines]
    else:
        out.append("keine: alle Zeilen mit Faktor 1 (Basisposition und Lieferantenartikel ohne VPE)")
    out.extend(["", "## EK > 2 % abweichend vom letzten Reimport", "",
                "Verglichen wird mit dem jüngsten früheren `-I` derselben HAN; liegt der Monate zurück,",
                "zeigt die Abweichung meist eine Preisänderung, keinen Rechenfehler.", ""])
    if off:
        out.extend(["| Pos (SD) | HAN | EK neu | EK zuletzt | Bestellung |", "|---|---|---|---|---|"])
        out += [f"| {l['position']} | {l['han']} | {l['ek']:.4f} | {l['previous_ek']:.4f} | {l['previous_order']} |"
                for l in off]
    else:
        out.append("keine")
    out.append("")
    return "\n".join(out)


def main(argv: list[str] | None = None, run: jtl.Runner = jtl.sqlcmd_runner) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("xlsx", help="SAP order export (.xlsx) from Husqvarna")
    parser.add_argument("--out-dir", type=Path, default=None, help="default ~/data/work/lukas/<today>-husqvarna-ameise")
    parser.add_argument("--base-order", help="JTL base order (D-BE…); default: Bestellnummer without -I")
    args = parser.parse_args(argv)

    try:
        sap_lines = transform.parse_sap(sap_xlsx.read_records(args.xlsx))
        base_number = args.base_order or transform.base_order_number(sap_lines)
    except (transform.InputError, OSError, KeyError, ValueError) as error:
        print(f"husq-reimport: {error}", file=sys.stderr)
        return 2

    try:
        base = jtl.load_order(run, base_number)
        if base is None:
            print(f"husq-reimport: base order {base_number} not found in JTL", file=sys.stderr)
            return 2
        reimport = f"{base.number}-I"
        existing = jtl.find_order_numbers(run, reimport)
        positions = jtl.load_positions(run, base.k_order)
        hans = sorted({c for l in sap_lines for c in transform.han_candidates(l.material)}
                      | {p.supplier_article_number for p in positions if p.supplier_article_number.isdigit()})
        articles = jtl.load_supplier_articles(run, base.k_supplier, hans)
        previous = jtl.load_previous_prices(run, base.k_supplier, hans, reimport)
    except jtl.JtlError as error:
        print(f"husq-reimport: JTL: {error}", file=sys.stderr)
        return 4

    result = transform.transform(sap_lines, positions, articles, reimport, previous)

    out_dir = args.out_dir or _default_out_dir()
    out_dir.mkdir(parents=True, exist_ok=True)
    stem = sap_lines[0].sales_document  # one order per run; several orders may share the folder
    csv_name = f"{stem}-ameise.csv"
    (out_dir / csv_name).write_text(transform.to_csv(result.rows), encoding="utf-8", newline="")
    (out_dir / f"{stem}-gegenprobe.md").write_text(
        gegenprobe(sap_lines, base, existing, positions, result, csv_name), encoding="utf-8")
    snapshot = {
        "base_order": dataclasses.asdict(base),
        "existing_reimport": existing,
        "positions": [dataclasses.asdict(p) for p in positions],
        "supplier_articles": [dataclasses.asdict(a) for a in articles],
        "previous_prices": [dataclasses.asdict(p) for p in previous],
    }
    (out_dir / f"{stem}-jtl-snapshot.json").write_text(json.dumps(snapshot, indent=1, ensure_ascii=False), encoding="utf-8")

    print(f"{out_dir / csv_name}: {len(result.rows)} rows; blockers {len(result.blockers)}, "
          f"warnings {len(result.warnings)}, notes {len(result.notes)}; see {stem}-gegenprobe.md")
    if existing:
        print(f"husq-reimport: {base.number}-I already exists in JTL", file=sys.stderr)
    return 3 if result.blockers or existing else 0


if __name__ == "__main__":
    sys.exit(main())
