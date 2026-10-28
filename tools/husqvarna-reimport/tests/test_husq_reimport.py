"""Tests for the Husqvarna reimport tool. Synthetic data only: invented order numbers,
article numbers and prices, no customer data.

Run: python3 -m unittest discover -s tools/husqvarna-reimport/tests
"""

from __future__ import annotations

import sys
import tempfile
import unittest
import zipfile
from pathlib import Path
from xml.sax.saxutils import escape

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import husq_reimport  # noqa: E402
import jtl  # noqa: E402
import sap_xlsx  # noqa: E402
import transform  # noqa: E402
from jtl import OrderPosition, PreviousPrice, SupplierArticle  # noqa: E402

HEADER = ["Auftraggeber", "Name 1", "Belegdatum", "Verkaufsbelegart", "Vertriebsbeleg", "Bestellnummer",
          "Position (SD)", "Material", "Bezeichnung", "Bestätigte Menge", "Offene Auftragsmenge",
          "Warenausgangsmenge", "Warenausgangstermin", "Lieferdatum", "Net price tot", "Kundenbezirk",
          "Lieferpriorität", "Warenausgangsdatum"]


def sap_row(position, material, name, confirmed, total, issued=None, open_qty=0,
            dispatch="46322", delivery="46323", issue_date="46321"):
    issued = confirmed if issued is None else issued
    return ["1", "Kunde", "46321", "ZWO", "9000000001", "D-BE20990001-I", str(position), material, name,
            str(confirmed), str(open_qty), str(issued), dispatch, delivery, str(total), "1", "10", issue_date]


def write_xlsx(path: Path, rows: list[list[str]]) -> None:
    """Minimal XLSX like SAP writes it: shared strings for text, plain values for numbers."""
    strings: list[str] = []

    def column(i: int) -> str:
        name = ""
        i += 1
        while i:
            i, rem = divmod(i - 1, 26)
            name = chr(65 + rem) + name
        return name

    sheet_rows = []
    for r, row in enumerate(rows, start=1):
        cells = []
        for c, value in enumerate(row):
            ref = f"{column(c)}{r}"
            if value == "":
                continue
            try:
                float(value)
                cells.append(f'<c r="{ref}"><v>{value}</v></c>')
            except ValueError:
                strings.append(value)
                cells.append(f'<c r="{ref}" t="s"><v>{len(strings) - 1}</v></c>')
        sheet_rows.append(f'<row r="{r}">{"".join(cells)}</row>')
    ns = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"'
    rel_ns = 'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"'
    with zipfile.ZipFile(path, "w") as z:
        z.writestr("xl/workbook.xml",
                   f'<workbook {ns} {rel_ns}><sheets><sheet name="S" sheetId="1" r:id="rId1"/></sheets></workbook>')
        z.writestr("xl/_rels/workbook.xml.rels",
                   '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
                   '<Relationship Id="rId1" Type="worksheet" Target="worksheets/sheet1.xml"/></Relationships>')
        z.writestr("xl/sharedStrings.xml",
                   f'<sst {ns}>' + "".join(f"<si><t>{escape(s)}</t></si>" for s in strings) + "</sst>")
        z.writestr("xl/worksheets/sheet1.xml", f'<worksheet {ns}><sheetData>{"".join(sheet_rows)}</sheetData></worksheet>')


def lines_of(*rows):
    with tempfile.TemporaryDirectory() as tmp:
        path = Path(tmp) / "export.xlsx"
        write_xlsx(path, [HEADER, *rows])
        return transform.parse_sap(sap_xlsx.read_records(str(path)))


class XlsxTest(unittest.TestCase):
    def test_reads_shared_strings_numbers_and_gaps(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "a.xlsx"
            write_xlsx(path, [["A", "B", "C"], ["x", "", "3.5"]])
            self.assertEqual(sap_xlsx.read_records(str(path)), [{"A": "x", "B": "", "C": "3.5"}])

    def test_excel_serial_to_date(self):
        self.assertEqual(str(sap_xlsx.excel_serial_to_date("46321")), "2026-10-26")
        self.assertIsNone(sap_xlsx.excel_serial_to_date(""))


class TransformTest(unittest.TestCase):
    def test_plain_line_matches_userscript_columns(self):
        lines = lines_of(sap_row(10, "00059-12.345.67", "Luftfilter", 3, "7.83"))
        result = transform.transform(
            lines, [OrderPosition(1, 11, "4711", "591234567", 3, 0)],
            [SupplierArticle(11, "4711", "591234567", 0)])
        self.assertEqual(result.rows, [{
            "HAN": "591234567", "Interne Bestellnummer": "D-BE20990001-I", "Artikelnummer": "4711",
            "Lieferantenbezeichnung": "Luftfilter", "menge": "3", "EK netto": "2,5317",
            "Lieferdatum": "27.10.2026", "Freiposition": "N", "Fremdbelegnummer": "9000000001"}])
        self.assertEqual((result.blockers, result.warnings, result.notes), ([], [], []))

    def test_vpe_of_base_position_multiplies_quantity(self):
        lines = lines_of(sap_row(10, "00057-77.537.01", "Messer 10er", 4, "100"))
        result = transform.transform(
            lines, [OrderPosition(1, 12, "4712", "577753701", 40, 10)],
            [SupplierArticle(12, "4712", "577753701", 10)])
        self.assertEqual(result.rows[0]["menge"], "40")
        self.assertEqual(result.rows[0]["EK netto"], "2,4250")
        self.assertEqual(result.warnings, [])

    def test_supplier_article_vpe_used_when_position_has_none_and_flagged(self):
        lines = lines_of(sap_row(10, "00057-77.537.01", "Messer 10er", 4, "100"))
        result = transform.transform(
            lines, [OrderPosition(1, 12, "4712", "577753701", 4, 0)],
            [SupplierArticle(12, "4712", "577753701", 10)])
        self.assertEqual(result.rows[0]["menge"], "40")
        self.assertIn("VPE differs", result.warnings[0].message)

    def test_prefixed_material_resolves_to_short_han(self):
        lines = lines_of(sap_row(10, "62550-53.051.25", "Starterseil", 1, "2"))
        result = transform.transform(
            lines, [OrderPosition(1, 13, "4713", "505305125", 1, 0)],
            [SupplierArticle(13, "4713", "505305125", 0)])
        self.assertEqual(result.rows[0]["HAN"], "505305125")
        self.assertIn("prefix", result.notes[0].message)

    def test_line_added_by_husqvarna_uses_supplier_article(self):
        lines = lines_of(sap_row(10, "00059-12.345.67", "A", 1, "1"), sap_row(20, "00053-10.177.15", "Messer", 30, "9"))
        result = transform.transform(
            lines, [OrderPosition(1, 11, "4711", "591234567", 1, 0)],
            [SupplierArticle(11, "4711", "591234567", 0), SupplierArticle(14, "4714", "531017715", 0)])
        self.assertEqual(result.rows[1]["Artikelnummer"], "4714")
        self.assertEqual(result.rows[1]["menge"], "30")
        self.assertEqual([w.message for w in result.warnings], ["no position in the base order; added by Husqvarna"])

    def test_unknown_han_is_a_blocker(self):
        lines = lines_of(sap_row(10, "00059-99.999.99", "Neu", 1, "1"))
        result = transform.transform(lines, [], [])
        self.assertEqual(len(result.blockers), 1)

    def test_changed_quantity_open_line_and_missing_position_are_reported(self):
        lines = lines_of(sap_row(10, "00059-12.345.67", "Kerze", 10, "20", issued=0, open_qty=10,
                                 dispatch="", issue_date="46330"))
        result = transform.transform(
            lines, [OrderPosition(1, 11, "4711", "591234567", 1, 0), OrderPosition(2, 15, "4715", "591111111", 1, 0)],
            [SupplierArticle(11, "4711", "591234567", 0)])
        self.assertEqual(result.rows[0]["menge"], "10")
        self.assertEqual(result.rows[0]["Lieferdatum"], "04.11.2026")
        messages = [w.message for w in result.warnings]
        self.assertIn("quantity changed by Husqvarna: sent 1, confirmed 10", messages)
        self.assertIn("base order position missing from the SAP export", messages)
        self.assertIn("not yet shipped", result.notes[0].message)

    def test_rejects_mixed_orders_and_missing_columns(self):
        row = sap_row(10, "00059-12.345.67", "A", 1, "1")
        other = list(row)
        other[4] = "9000000002"
        with self.assertRaises(transform.InputError):
            lines_of(row, other)
        with self.assertRaises(transform.InputError):
            transform.parse_sap([{"Material": "x"}])


class CsvTest(unittest.TestCase):
    def test_quotes_like_jquery_csv(self):
        row = dict.fromkeys(transform.CSV_COLUMNS, "x")
        row["Lieferantenbezeichnung"] = 'Schiene 28"/70cm; neu'
        text = transform.to_csv([row])
        self.assertTrue(text.startswith("HAN;Interne Bestellnummer;Artikelnummer;Lieferantenbezeichnung;menge;"
                                        "EK netto;Lieferdatum;Freiposition;Fremdbelegnummer\n"))
        self.assertIn(';"Schiene 28""/70cm; neu";', text)
        self.assertTrue(text.endswith("x\n"))
        self.assertNotIn("\r", text)


class CliTest(unittest.TestCase):
    """End to end with a fake sqlcmd: the SQL text decides which canned answer comes back."""

    def fake_run(self, sql: str) -> str:
        if "FROM dbo.tLieferantenBestellung WHERE cEigeneBestellnummer = 'D-BE20990001'" in sql \
                and "kLieferantenBestellung," in sql:
            return "77|D-BE20990001|2|20\n"
        if "cEigeneBestellnummer = 'D-BE20990001-I'" in sql:
            return ""
        if "FROM dbo.tLieferantenBestellungPos WHERE kLieferantenBestellung = 77" in sql:
            return "1|11|4711|591234567|3.0000|NULL\n"
        if "FROM dbo.tliefartikel" in sql:
            return "11|4711|591234567|.0000\n"
        if "ROW_NUMBER()" in sql:
            return "591234567|D-BE20990000-I|2.5317\n"
        raise AssertionError(sql)

    def test_writes_csv_gegenprobe_and_snapshot(self):
        with tempfile.TemporaryDirectory() as tmp:
            xlsx = Path(tmp) / "export.xlsx"
            write_xlsx(xlsx, [HEADER, sap_row(10, "00059-12.345.67", "Luftfilter", 3, "7.83")])
            out = Path(tmp) / "out"
            code = husq_reimport.main([str(xlsx), "--out-dir", str(out)], run=self.fake_run)
            self.assertEqual(code, 0)
            csv = (out / "9000000001-ameise.csv").read_text(encoding="utf-8")
            self.assertEqual(csv.splitlines()[1],
                             "591234567;D-BE20990001-I;4711;Luftfilter;3;2,5317;27.10.2026;N;9000000001")
            report = (out / "gegenprobe.md").read_text(encoding="utf-8")
            self.assertIn("| Zeilen SAP / CSV | 1 / 1 |", report)
            self.assertIn("1 / 1 / 0 |", report)
            self.assertTrue((out / "jtl-snapshot.json").exists())

    def test_existing_reimport_order_returns_3(self):
        def run(sql):
            if "cEigeneBestellnummer = 'D-BE20990001-I'" in sql:
                return "D-BE20990001-I\n"
            return self.fake_run(sql)
        with tempfile.TemporaryDirectory() as tmp:
            xlsx = Path(tmp) / "export.xlsx"
            write_xlsx(xlsx, [HEADER, sap_row(10, "00059-12.345.67", "Luftfilter", 3, "7.83")])
            self.assertEqual(husq_reimport.main([str(xlsx), "--out-dir", str(Path(tmp) / "o")], run=run), 3)

    def test_sql_inputs_are_validated(self):
        with self.assertRaises(jtl.JtlError):
            jtl.load_order(self.fake_run, "D-BE1'; DROP TABLE x--")
        with self.assertRaises(jtl.JtlError):
            jtl.load_supplier_articles(self.fake_run, 2, ["12a"])


if __name__ == "__main__":
    unittest.main()
