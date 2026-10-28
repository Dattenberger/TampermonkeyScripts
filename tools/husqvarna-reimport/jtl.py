"""Read-only JTL-Wawi lookups for the Husqvarna reimport, through sqlcmd with Kerberos.

Every statement is a single SELECT. The only values inlined into SQL are validated first
(an order number matching `D-BE<digits>`, purely numeric HANs), so nothing from the
SAP file reaches the server unchecked.

The runner is injectable: tests pass a fake that returns canned sqlcmd output.
"""

from __future__ import annotations

import os
import re
import subprocess
from dataclasses import dataclass
from typing import Callable

Runner = Callable[[str], str]

_ORDER_RE = re.compile(r"^D-BE\d+$")
_SEPARATOR = "|"


class JtlError(RuntimeError):
    """sqlcmd failed or JTL returned something the tool cannot work with."""


@dataclass(frozen=True)
class BaseOrder:
    k_order: int
    number: str
    k_supplier: int
    status: int


@dataclass(frozen=True)
class OrderPosition:
    sort: int
    k_article: int
    article_number: str
    supplier_article_number: str
    quantity: float
    vpe: float


@dataclass(frozen=True)
class SupplierArticle:
    k_article: int
    article_number: str
    supplier_article_number: str
    vpe: float


@dataclass(frozen=True)
class PreviousPrice:
    supplier_article_number: str
    order_number: str
    ek_net: float


def sqlcmd_runner(sql: str) -> str:
    """Runs one statement against eazybusiness on VM-SQL2 (vm-dev2 setup: mssql-tools18, Kerberos)."""
    env = dict(os.environ)
    env.setdefault("KRB5CCNAME", "FILE:/tmp/krb5cc_1000")
    command = [
        os.environ.get("HUSQ_SQLCMD", "/opt/mssql-tools18/bin/sqlcmd"),
        "-S", os.environ.get("HUSQ_SQL_SERVER", "vm-sql2.zdbikes.local"),
        "-d", os.environ.get("HUSQ_SQL_DATABASE", "eazybusiness"),
        "-E", "-C", "-I", "-b", "-W", "-h", "-1", "-s", _SEPARATOR,
        "-Q", "SET NOCOUNT ON; " + sql,
    ]
    result = subprocess.run(command, capture_output=True, text=True, env=env, timeout=120)
    if result.returncode != 0:
        raise JtlError(f"sqlcmd exit {result.returncode}: {(result.stderr or result.stdout).strip()}")
    return result.stdout


def _rows(output: str) -> list[list[str]]:
    return [line.rstrip("\r").split(_SEPARATOR) for line in output.splitlines() if line.strip()]


def _number(value: str) -> float:
    return 0.0 if value in ("", "NULL") else float(value)


def _text(value: str) -> str:
    return "" if value == "NULL" else value.strip()


def validate_order_number(number: str) -> str:
    if not _ORDER_RE.match(number):
        raise JtlError(f"unexpected order number {number!r}, expected D-BE<digits>")
    return number


def load_order(run: Runner, number: str) -> BaseOrder | None:
    validate_order_number(number)
    rows = _rows(run(
        "SELECT kLieferantenBestellung, cEigeneBestellnummer, kLieferant, nStatus "
        "FROM dbo.tLieferantenBestellung "
        f"WHERE cEigeneBestellnummer = '{number}' AND nDeleted = 0"
    ))
    if not rows:
        return None
    if len(rows) > 1:
        raise JtlError(f"{len(rows)} supplier orders named {number}")
    k, name, supplier, status = rows[0]
    return BaseOrder(int(k), name, int(supplier), int(status))


def find_order_numbers(run: Runner, number: str) -> list[str]:
    """Live (not deleted) orders with exactly this own order number; used to spot an existing -I."""
    if not re.match(r"^D-BE\d+-I$", number):
        raise JtlError(f"unexpected reimport order number {number!r}")
    return [_text(r[0]) for r in _rows(run(
        "SELECT cEigeneBestellnummer FROM dbo.tLieferantenBestellung "
        f"WHERE cEigeneBestellnummer = '{number}' AND nDeleted = 0"
    ))]


def load_positions(run: Runner, k_order: int) -> list[OrderPosition]:
    rows = _rows(run(
        "SELECT nSort, ISNULL(kArtikel, 0), cArtNr, LTRIM(RTRIM(cLieferantenArtNr)), "
        "CAST(fMenge AS decimal(18,4)), CAST(ISNULL(nVPEMenge, 0) AS decimal(18,4)) "
        "FROM dbo.tLieferantenBestellungPos "
        f"WHERE kLieferantenBestellung = {int(k_order)} ORDER BY nSort"
    ))
    return [
        OrderPosition(int(s), int(k), _text(art), _text(han), _number(qty), _number(vpe))
        for s, k, art, han, qty, vpe in rows
    ]


def _han_list(hans: list[str]) -> str:
    unique = sorted(set(hans))
    for han in unique:
        if not han.isdigit():
            raise JtlError(f"non-numeric HAN {han!r}")
    return ",".join(f"'{han}'" for han in unique)


def load_supplier_articles(run: Runner, k_supplier: int, hans: list[str]) -> list[SupplierArticle]:
    if not hans:
        return []
    rows = _rows(run(
        "SELECT la.tArtikel_kArtikel, a.cArtNr, LTRIM(RTRIM(la.cLiefArtNr)), "
        "CAST(ISNULL(la.nVPEMenge, 0) AS decimal(18,4)) "
        "FROM dbo.tliefartikel la JOIN dbo.tArtikel a ON a.kArtikel = la.tArtikel_kArtikel "
        f"WHERE la.tLieferant_kLieferant = {int(k_supplier)} "
        f"AND LTRIM(RTRIM(la.cLiefArtNr)) IN ({_han_list(hans)})"
    ))
    return [SupplierArticle(int(k), _text(art), _text(han), _number(vpe)) for k, art, han, vpe in rows]


def load_previous_prices(run: Runner, k_supplier: int, hans: list[str]) -> list[PreviousPrice]:
    """The EK of each HAN in the newest earlier reimport order (`D-BE…-I`) of this supplier."""
    if not hans:
        return []
    rows = _rows(run(
        "SELECT han, cEigeneBestellnummer, CAST(fEKNetto AS decimal(18,4)) FROM ("
        "SELECT LTRIM(RTRIM(p.cLieferantenArtNr)) AS han, b.cEigeneBestellnummer, p.fEKNetto, "
        "ROW_NUMBER() OVER (PARTITION BY LTRIM(RTRIM(p.cLieferantenArtNr)) "
        "ORDER BY b.dErstellt DESC, p.kLieferantenBestellungPos DESC) AS rn "
        "FROM dbo.tLieferantenBestellungPos p "
        "JOIN dbo.tLieferantenBestellung b ON b.kLieferantenBestellung = p.kLieferantenBestellung "
        f"WHERE b.kLieferant = {int(k_supplier)} AND b.nDeleted = 0 "
        "AND b.cEigeneBestellnummer LIKE 'D-BE%-I' "
        f"AND LTRIM(RTRIM(p.cLieferantenArtNr)) IN ({_han_list(hans)})"
        ") x WHERE rn = 1"
    ))
    return [PreviousPrice(_text(h), _text(o), _number(ek)) for h, o, ek in rows]
