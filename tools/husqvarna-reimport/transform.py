"""Turns a Husqvarna SAP order export into the Ameise CSV of the portal userscript.

The userscript `hsqvrn_protal_orders_exporter.js` (`prepareCsvDataToExport`) reads our
article number and the VPE from each line's comment, which our JTL export template
("Husqvarna Export", Liquid) writes as `<own order no> VPE=<n> <article no> <name>`.
SAP exports lack that comment, so this module takes both from the JTL base order
(the `D-BE…` order without `-I`) instead; everything else follows the userscript:

| Column                 | Userscript (portal)                     | Here (SAP export + JTL)                         |
|------------------------|-----------------------------------------|-------------------------------------------------|
| HAN                    | article no., leading zeros stripped     | Material, digits, resolved against tliefartikel |
| Interne Bestellnummer  | customer order no., first 14 chars      | Bestellnummer, first 14 chars                   |
| Artikelnummer          | from the comment                        | base order position, else tliefartikel          |
| Lieferantenbezeichnung | article name + description              | Bezeichnung                                     |
| menge                  | (delivered or requested) x VPE          | (Warenausgangsmenge or Bestätigte Menge) x VPE  |
| EK netto               | line net total x 0.97 / menge           | Net price tot x 0.97 / menge                    |
| Lieferdatum            | promised dispatch date                  | Warenausgangstermin, else -datum, else Lieferd. |
| Freiposition           | N                                       | N                                               |
| Fremdbelegnummer       | portal order no.                        | Vertriebsbeleg                                  |

Ameise template "WebOrder V2.1 - Inkl. Fremdbelegnummer" maps the columns by position, so
the order above is part of the contract.
"""

from __future__ import annotations

import re
from collections import defaultdict
from dataclasses import dataclass, field

from jtl import OrderPosition, PreviousPrice, SupplierArticle
from sap_xlsx import excel_serial_to_date

DISCOUNT_FACTOR = 0.97  # same as Config.business.DISCOUNT_FACTOR in the userscript
INTERNAL_ORDER_MAX = 14  # the userscript cuts the internal order number to 14 characters
SHORT_HAN_DIGITS = 9  # SAP sometimes prefixes the HAN (e.g. 625 + 505305125)

CSV_COLUMNS = [
    "HAN", "Interne Bestellnummer", "Artikelnummer", "Lieferantenbezeichnung", "menge",
    "EK netto", "Lieferdatum", "Freiposition", "Fremdbelegnummer",
]

SAP_COLUMNS = [
    "Vertriebsbeleg", "Bestellnummer", "Position (SD)", "Material", "Bezeichnung",
    "Bestätigte Menge", "Offene Auftragsmenge", "Warenausgangsmenge", "Warenausgangstermin",
    "Lieferdatum", "Warenausgangsdatum", "Net price tot",
]


class InputError(ValueError):
    """The SAP file does not have the shape this tool expects."""


@dataclass(frozen=True)
class SapLine:
    sales_document: str
    order_reference: str
    position: int
    material: str
    description: str
    confirmed: float
    open_quantity: float
    issued: float
    dispatch_date: str
    total_net: float


@dataclass
class Finding:
    position: int
    material: str
    description: str
    message: str


@dataclass
class Result:
    rows: list[dict[str, str]]
    blockers: list[Finding] = field(default_factory=list)
    warnings: list[Finding] = field(default_factory=list)
    notes: list[Finding] = field(default_factory=list)
    lines: list[dict] = field(default_factory=list)
    matched_positions: int = 0


def _float(value: str) -> float:
    return float(value) if value else 0.0


def _german_date(*serials: str) -> str:
    for serial in serials:
        date = excel_serial_to_date(serial)
        if date:
            return date.strftime("%d.%m.%Y")
    return ""


def parse_sap(records: list[dict[str, str]]) -> list[SapLine]:
    if not records:
        raise InputError("SAP export has no lines")
    missing = [c for c in SAP_COLUMNS if c not in records[0]]
    if missing:
        raise InputError(f"SAP export lacks columns: {', '.join(missing)}")
    lines = []
    for r in records:
        lines.append(SapLine(
            sales_document=r["Vertriebsbeleg"],
            order_reference=r["Bestellnummer"],
            position=int(float(r["Position (SD)"])),
            material=r["Material"],
            description=r["Bezeichnung"],
            confirmed=_float(r["Bestätigte Menge"]),
            open_quantity=_float(r["Offene Auftragsmenge"]),
            issued=_float(r["Warenausgangsmenge"]),
            dispatch_date=_german_date(r["Warenausgangstermin"], r["Warenausgangsdatum"], r["Lieferdatum"]),
            total_net=_float(r["Net price tot"]),
        ))
    for name, values in (("Vertriebsbeleg", {l.sales_document for l in lines}),
                         ("Bestellnummer", {l.order_reference for l in lines})):
        if len(values) != 1:
            raise InputError(f"SAP export mixes several values of {name}: {sorted(values)}")
    return lines


def base_order_number(lines: list[SapLine]) -> str:
    """`D-BE20262343-I` → `D-BE20262343`: the reimport reference names the exported base order."""
    reference = lines[0].order_reference
    if not reference.endswith("-I"):
        raise InputError(f"Bestellnummer {reference!r} does not end in -I; pass --base-order")
    return reference[:-2]


def han_candidates(material: str) -> list[str]:
    """HANs a SAP material may stand for, most likely first."""
    digits = re.sub(r"\D", "", material)
    stripped = digits.lstrip("0")
    candidates = [stripped]
    if len(stripped) > SHORT_HAN_DIGITS:
        candidates.append(stripped[-SHORT_HAN_DIGITS:])
    return candidates


def _vpe(value: float) -> int:
    return int(value) if value >= 1 else 0


def format_quantity(value: float) -> str:
    return str(int(value)) if float(value).is_integer() else str(value)


def transform(
    lines: list[SapLine],
    positions: list[OrderPosition],
    supplier_articles: list[SupplierArticle],
    previous_prices: list[PreviousPrice] = (),
) -> Result:
    by_sort = {p.sort: p for p in positions}
    articles_by_han: dict[str, list[SupplierArticle]] = defaultdict(list)
    for article in supplier_articles:
        articles_by_han[article.supplier_article_number].append(article)
    previous = {p.supplier_article_number: p for p in previous_prices}

    result = Result(rows=[])
    used_positions: set[int] = set()

    for line in sorted(lines, key=lambda l: l.position):  # base order sequence
        def finding(message: str) -> Finding:
            return Finding(line.position, line.material, line.description, message)

        position = by_sort.get(line.position // 10) if line.position % 10 == 0 else None
        candidates = han_candidates(line.material)
        han = next((c for c in candidates if c in articles_by_han), None)

        if han is None and position and position.supplier_article_number in candidates:
            han = position.supplier_article_number
        if han is None:
            result.blockers.append(finding(
                f"HAN {'/'.join(candidates)} not found as supplier article; Ameise would reject the line"))
            han = candidates[0]
        elif han != candidates[0]:
            result.notes.append(finding(f"SAP material carries a prefix; HAN resolved to {han}"))

        matches = articles_by_han.get(han, [])
        article = None
        if position:
            used_positions.add(position.sort)
            article = next((a for a in matches if a.k_article == position.k_article), None)
            if position.supplier_article_number != han:
                result.warnings.append(finding(
                    f"base position {position.sort} holds HAN {position.supplier_article_number} "
                    f"(article {position.article_number}); Husqvarna delivered {han} instead"))
        else:
            result.warnings.append(finding("no position in the base order; added by Husqvarna"))
        if article is None and len(matches) > 1:
            result.blockers.append(finding(
                f"HAN {han} belongs to several articles ({', '.join(a.article_number for a in matches)})"))
        if article is None and matches:
            article = matches[0]

        # VPE: what the Liquid export wrote into the comment (position), else the supplier article.
        position_vpe = _vpe(position.vpe) if position else 0
        article_vpe = _vpe(article.vpe) if article else 0
        vpe = position_vpe or article_vpe or 1
        if position and article and position_vpe != article_vpe:
            result.warnings.append(finding(
                f"VPE differs: base position {position_vpe or '-'}, supplier article {article_vpe or '-'}; used {vpe}"))

        base_quantity = line.issued if line.issued > 0 else line.confirmed
        quantity = max(1, base_quantity * vpe)
        if line.open_quantity > 0:
            result.notes.append(finding(
                f"not yet shipped: confirmed {format_quantity(line.confirmed)}, "
                f"open {format_quantity(line.open_quantity)}"))
        if position:
            sent = position.quantity / position_vpe if position_vpe else position.quantity
            if abs(sent - line.confirmed) > 1e-9:
                result.warnings.append(finding(
                    f"quantity changed by Husqvarna: sent {format_quantity(sent)}, "
                    f"confirmed {format_quantity(line.confirmed)}"))

        ek = line.total_net * DISCOUNT_FACTOR / quantity
        article_number = position.article_number if position else (article.article_number if article else "")
        result.rows.append({
            "HAN": han,
            "Interne Bestellnummer": line.order_reference[:INTERNAL_ORDER_MAX],
            "Artikelnummer": article_number,
            "Lieferantenbezeichnung": line.description,
            "menge": format_quantity(quantity),
            "EK netto": f"{ek:.4f}".replace(".", ","),
            "Lieferdatum": line.dispatch_date,
            "Freiposition": "N",
            "Fremdbelegnummer": line.sales_document,
        })
        last = previous.get(han)
        result.lines.append({
            "position": line.position, "han": han, "vpe": vpe, "quantity": quantity, "ek": round(ek, 4),
            "previous_ek": last.ek_net if last else None, "previous_order": last.order_number if last else None,
        })

    result.matched_positions = len(used_positions)
    for sort in sorted(set(by_sort) - used_positions):
        p = by_sort[sort]
        result.warnings.append(Finding(sort * 10, p.supplier_article_number, p.article_number,
                                       "base order position missing from the SAP export"))
    return result


def to_csv(rows: list[dict[str, str]]) -> str:
    """Same text as jquery-csv 1.0.21 `fromObjects(rows, {separator: ';'})`: header row, `;`,
    `"` only around values containing `;`, `"` or a line break, `\\n` line ends, no BOM."""
    def cell(value: str) -> str:
        value = value.replace('"', '""')
        return f'"{value}"' if re.search(r'[;"\r\n]', value) else value

    lines = [";".join(CSV_COLUMNS)]
    lines += [";".join(cell(row[c]) for c in CSV_COLUMNS) for row in rows]
    return "\n".join(lines) + "\n"
