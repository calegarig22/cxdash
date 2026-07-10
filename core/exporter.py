"""Excel / CSV export helpers."""
import io
import re

import pandas as pd

_INJECT = re.compile(r"^[=+\-@\t\r]")


def _sanitize_cell(v):
    """Neutraliza injeção de fórmula em exports (CSV/Excel)."""
    if isinstance(v, str) and _INJECT.match(v):
        return "'" + v
    return v


def to_excel_bytes(df: pd.DataFrame, sheet_name="Dados") -> bytes:
    safe = df.applymap(_sanitize_cell)
    buffer = io.BytesIO()
    with pd.ExcelWriter(buffer, engine="openpyxl") as writer:
        safe.to_excel(writer, index=False, sheet_name=sheet_name[:31])
    return buffer.getvalue()


def to_csv_bytes(df: pd.DataFrame) -> bytes:
    safe = df.applymap(_sanitize_cell)
    return safe.to_csv(index=False).encode("utf-8-sig")
