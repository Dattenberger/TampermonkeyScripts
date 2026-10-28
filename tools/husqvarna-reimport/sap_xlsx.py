"""Reads the first sheet of an XLSX file into dicts keyed by the header row.

Stdlib only (zipfile + ElementTree), so the tool runs without installing openpyxl.
Covers what SAP list exports contain: shared strings, inline strings and plain values.
Cells come back as strings; dates stay Excel serial numbers (see `excel_serial_to_date`).
"""

from __future__ import annotations

import datetime as dt
import re
import zipfile
import xml.etree.ElementTree as ET

_NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
_REL_NS = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"
_PKG_REL_NS = "{http://schemas.openxmlformats.org/package/2006/relationships}"


def _column_index(cell_ref: str) -> int:
    letters = re.match(r"[A-Z]+", cell_ref).group()
    index = 0
    for letter in letters:
        index = index * 26 + (ord(letter) - 64)
    return index - 1


def _text(element: ET.Element) -> str:
    return "".join(t.text or "" for t in element.iter(f"{_NS}t"))


def _first_sheet_path(archive: zipfile.ZipFile) -> str:
    workbook = ET.fromstring(archive.read("xl/workbook.xml"))
    first = workbook.find(f"{_NS}sheets/{_NS}sheet")
    rel_id = first.get(f"{_REL_NS}id")
    rels = ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
    for rel in rels.iter(f"{_PKG_REL_NS}Relationship"):
        if rel.get("Id") == rel_id:
            target = rel.get("Target").lstrip("/")
            return target if target.startswith("xl/") else f"xl/{target}"
    raise ValueError("workbook has no first sheet")


def read_rows(path: str) -> list[list[str]]:
    """All rows of the first sheet as lists of strings (missing cells are '')."""
    with zipfile.ZipFile(path) as archive:
        names = set(archive.namelist())
        shared: list[str] = []
        if "xl/sharedStrings.xml" in names:
            root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
            shared = [_text(si) for si in root.findall(f"{_NS}si")]
        sheet = ET.fromstring(archive.read(_first_sheet_path(archive)))

    rows: list[list[str]] = []
    for row in sheet.iter(f"{_NS}row"):
        values: dict[int, str] = {}
        for cell in row.findall(f"{_NS}c"):
            kind = cell.get("t")
            value = cell.find(f"{_NS}v")
            if kind == "inlineStr":
                inline = cell.find(f"{_NS}is")
                text = _text(inline) if inline is not None else ""
            elif value is None or value.text is None:
                text = ""
            elif kind == "s":
                text = shared[int(value.text)]
            else:
                text = value.text
            values[_column_index(cell.get("r"))] = text
        width = max(values) + 1 if values else 0
        rows.append([values.get(i, "") for i in range(width)])
    return rows


def read_records(path: str) -> list[dict[str, str]]:
    """Rows below the header as dicts keyed by the (stripped) header text."""
    rows = read_rows(path)
    if not rows:
        return []
    header = [h.strip() for h in rows[0]]
    records = []
    for row in rows[1:]:
        if not any(cell.strip() for cell in row):
            continue
        padded = row + [""] * (len(header) - len(row))
        records.append({header[i]: padded[i].strip() for i in range(len(header)) if header[i]})
    return records


def excel_serial_to_date(value: str) -> dt.date | None:
    """Excel's 1900 date system (serial 1 = 1900-01-01, with the Lotus leap-year bug)."""
    if not value:
        return None
    return dt.date(1899, 12, 30) + dt.timedelta(days=int(float(value)))
