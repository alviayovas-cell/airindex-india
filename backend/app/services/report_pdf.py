"""Government-style PDF rendering of a full report (spec §Part 16).

Uses reportlab. When reportlab is not installed (a trimmed deployment — see
``requirements-ml.txt``) ``PDF_AVAILABLE`` is False and the endpoint offers CSV /
JSON instead. Every number comes from the report dict built by
``report_service.build_full_report`` — no separate calculations.
"""

from __future__ import annotations

import io
from datetime import datetime

try:
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
    from reportlab.lib.units import mm
    from reportlab.platypus import (
        Paragraph,
        SimpleDocTemplate,
        Spacer,
        Table,
        TableStyle,
    )

    PDF_AVAILABLE = True
except ImportError:  # pragma: no cover - trimmed deployment
    PDF_AVAILABLE = False


class PdfUnavailable(RuntimeError):
    """Raised when a PDF is requested but reportlab is not installed."""


def _c(hex_: str):
    return colors.HexColor(hex_)


def _styles():
    _MUTED = _c("#64748b")
    _ACCENT = _c("#5b5bd6")
    ss = getSampleStyleSheet()
    ss.add(ParagraphStyle("Sub", parent=ss["Normal"], textColor=_MUTED, fontSize=9))
    ss.add(
        ParagraphStyle(
            "H2b",
            parent=ss["Heading2"],
            textColor=_ACCENT,
            spaceBefore=14,
            spaceAfter=6,
            fontSize=12,
        )
    )
    ss.add(
        ParagraphStyle(
            "Disc",
            parent=ss["Normal"],
            textColor=_MUTED,
            fontSize=8,
            leading=11,
            borderPadding=6,
            backColor=colors.HexColor("#f8fafc"),
        )
    )
    return ss


def _fmt_money(v) -> str:
    return "-" if v is None else f"INR {v:,.0f}"


def _fmt_pct(v) -> str:
    return "-" if v is None else f"{v:+.2f}%"


def _table(data: list[list[str]], col_widths=None) -> Table:
    _MUTED, _LINE = _c("#64748b"), _c("#e2e8f0")
    t = Table(data, colWidths=col_widths, hAlign="LEFT")
    t.setStyle(
        TableStyle(
            [
                ("FONTSIZE", (0, 0), (-1, -1), 8),
                ("TEXTCOLOR", (0, 0), (-1, 0), _MUTED),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("LINEBELOW", (0, 0), (-1, 0), 0.75, _LINE),
                ("LINEBELOW", (0, 1), (-1, -2), 0.25, _LINE),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    return t


def build_report_pdf(report: dict) -> bytes:
    if not PDF_AVAILABLE:
        raise PdfUnavailable(
            "PDF export is not available on this deployment. Use format=csv or "
            "format=json."
        )
    ss = _styles()
    story: list = []

    freq = report.get("frequency", "daily").capitalize()
    story.append(Paragraph(f"AIRINDEX &mdash; {freq} Airfare Price Report", ss["Title"]))
    gen = report.get("generated_at", "")
    try:
        gen = datetime.fromisoformat(gen).strftime("%d %b %Y %H:%M UTC")
    except ValueError:
        pass
    scope = report.get("route_id") or "All basket routes"
    story.append(Paragraph(f"Scope: {scope} &nbsp;|&nbsp; Generated: {gen}", ss["Sub"]))
    story.append(Spacer(1, 6))
    story.append(Paragraph(report.get("disclaimer", ""), ss["Disc"]))

    # --- Index summary ---
    idx = report.get("index")
    if idx:
        story.append(Paragraph("Airfare Price Index", ss["H2b"]))
        story.append(
            _table(
                [
                    ["Metric", "Value"],
                    ["Index level", f"{idx['value']:.2f}"],
                    ["Base period", str(idx.get("base_period"))],
                    ["Change (1d / 7d / 30d)",
                     f"{_fmt_pct(idx.get('change_1d'))} / "
                     f"{_fmt_pct(idx.get('change_7d'))} / "
                     f"{_fmt_pct(idx.get('change_30d'))}"],
                ],
                col_widths=[70 * mm, 90 * mm],
            )
        )

    summ = report.get("summary", {})
    story.append(Paragraph("Period summary", ss["H2b"]))
    story.append(
        _table(
            [
                ["Metric", "Value"],
                ["Average fare", _fmt_money(summ.get("average_fare"))],
                ["Index start -> end",
                 f"{summ.get('index_start')} -> {summ.get('index_end')} "
                 f"({_fmt_pct(summ.get('index_change_pct'))})"],
                ["Observations",
                 f"{summ.get('observations', 0):,} "
                 f"({summ.get('valid_observations', 0):,} valid, "
                 f"{summ.get('quality_pct')}%)"],
                ["Periods", str(summ.get("period_count", 0))],
            ],
            col_widths=[70 * mm, 90 * mm],
        )
    )

    # --- Per-period table ---
    rows = report.get("rows", [])
    if rows:
        story.append(Paragraph("By period", ss["H2b"]))
        data = [["Period", "Avg fare", "Index", "Obs", "Valid", "Quality"]]
        for r in rows:
            data.append(
                [
                    str(r["period"]),
                    _fmt_money(r["average_fare"]),
                    "-" if r["index_value"] is None else f"{r['index_value']:.2f}",
                    f"{r['observations']:,}",
                    f"{r['valid_observations']:,}",
                    f"{r['quality_pct']}%",
                ]
            )
        story.append(_table(data, col_widths=[32 * mm] + [26 * mm] * 5))

    # --- Route indexes ---
    ri = report.get("route_indexes", [])
    if ri:
        story.append(Paragraph("Route-level indexes", ss["H2b"]))
        data = [["Route", "Index", "7d", "30d", "Avg fare", "Weight"]]
        for r in ri:
            data.append(
                [
                    r["label"],
                    "-" if r["current_index"] is None else f"{r['current_index']:.2f}",
                    _fmt_pct(r["change_7d"]),
                    _fmt_pct(r["change_30d"]),
                    _fmt_money(r["average_fare"]),
                    f"{(r['weight'] or 0) * 100:.0f}%",
                ]
            )
        story.append(_table(data, col_widths=[34 * mm, 22 * mm, 22 * mm, 22 * mm, 30 * mm, 18 * mm]))

    # --- Observed contributors ---
    oc = report.get("observed_contributors", [])
    if oc:
        story.append(Paragraph("Observed contributors to the latest index change", ss["H2b"]))
        data = [["Route", "Route index chg", "Avg fare chg", "Contribution delta"]]
        for c in oc:
            data.append(
                [
                    c["label"],
                    f"{c['route_index_change']:+.2f}",
                    _fmt_pct(c.get("avg_fare_change_pct")),
                    f"{c['contribution_delta']:+.3f}",
                ]
            )
        story.append(_table(data, col_widths=[40 * mm, 36 * mm, 34 * mm, 40 * mm]))
        story.append(
            Paragraph(
                "Observed contributors only &mdash; the largest measured movements, "
                "not a causal explanation.",
                ss["Sub"],
            )
        )

    # --- Volatility ---
    vol = report.get("volatility", [])
    if vol:
        story.append(Paragraph("Route price volatility (experimental score)", ss["H2b"]))
        data = [["Route", "Score", "Category", "Daily return std"]]
        for v in vol:
            data.append(
                [v["label"], f"{v['volatility_score']:.0f}", v["category"],
                 f"{v['daily_return_std_pct']:.2f}%"]
            )
        story.append(_table(data, col_widths=[40 * mm, 22 * mm, 30 * mm, 40 * mm]))

    # --- Fare spikes ---
    fs = report.get("fare_spikes", {})
    story.append(Paragraph("Fare spike alerts", ss["H2b"]))
    summ_fs = fs.get("summary", {})
    story.append(
        Paragraph(
            f"Window {fs.get('window_days')}d &mdash; "
            f"Moderate {summ_fs.get('Moderate Increase', 0)}, "
            f"High {summ_fs.get('High Increase', 0)}, "
            f"Critical {summ_fs.get('Critical Increase', 0)}.",
            ss["Normal"],
        )
    )
    if fs.get("top"):
        data = [["Route", "Window", "Baseline", "Current", "Change", "Severity"]]
        for a in fs["top"]:
            data.append(
                [
                    a["route_label"],
                    a["advance_window"],
                    _fmt_money(a["baseline_avg_fare"]),
                    _fmt_money(a["current_avg_fare"]),
                    f"{a['pct_change']:+.1f}%",
                    a["severity"].replace(" Increase", ""),
                ]
            )
        story.append(_table(data, col_widths=[30 * mm, 18 * mm, 28 * mm, 28 * mm, 22 * mm, 24 * mm]))

    # --- Lead time ---
    lt = report.get("lead_time", [])
    if lt:
        story.append(Paragraph("Lead-time analysis", ss["H2b"]))
        data = [["Window", "Avg fare", "Median fare", "Observations"]]
        for w in lt:
            data.append(
                [w["window"], _fmt_money(w["average_fare"]),
                 _fmt_money(w["median_fare"]), f"{w['observation_count']:,}"]
            )
        story.append(_table(data, col_widths=[24 * mm, 34 * mm, 34 * mm, 34 * mm]))

    # --- Data quality ---
    dq = report.get("data_quality", {})
    bd = dq.get("breakdown", {})
    story.append(Paragraph("Data quality", ss["H2b"]))
    story.append(
        _table(
            [
                ["Status", "Count"],
                ["Total", f"{bd.get('total', 0):,}"],
                ["Valid", f"{bd.get('valid', 0):,}"],
                ["Missing", f"{bd.get('missing', 0):,}"],
                ["Duplicate", f"{bd.get('duplicate', 0):,}"],
                ["Potential outlier", f"{bd.get('outlier', 0):,}"],
                ["Cancelled / sold out",
                 f"{bd.get('cancelled', 0) + bd.get('sold_out', 0):,}"],
                ["Quality score", f"{dq.get('overall_quality_pct')}%"],
            ],
            col_widths=[70 * mm, 90 * mm],
        )
    )

    # --- Methodology ---
    m = report.get("methodology", {})
    story.append(Paragraph("Methodology", ss["H2b"]))
    story.append(Paragraph(f"Version {m.get('version')} &nbsp;|&nbsp; base period "
                           f"{m.get('base_period')}", ss["Sub"]))
    story.append(Paragraph(m.get("formula", ""), ss["Normal"]))
    story.append(Spacer(1, 4))
    story.append(Paragraph(m.get("disclaimer", ""), ss["Disc"]))

    ds = report.get("data_source", {})
    story.append(Spacer(1, 6))
    story.append(
        Paragraph(
            f"Data source: {ds.get('source')} "
            f"({'synthetic demonstration data' if ds.get('is_synthetic') else 'authorized API'})"
            f" &mdash; last updated {ds.get('last_updated')}.",
            ss["Sub"],
        )
    )

    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        topMargin=18 * mm,
        bottomMargin=18 * mm,
        leftMargin=16 * mm,
        rightMargin=16 * mm,
        title="AIRINDEX Airfare Price Report",
    )
    doc.build(story)
    return buf.getvalue()
