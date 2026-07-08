"""Client-ready weekly project PDF report generation."""

from __future__ import annotations

import json
from pathlib import Path
import textwrap

import matplotlib

matplotlib.use("Agg")
from matplotlib.backends.backend_pdf import PdfPages
import matplotlib.pyplot as plt
from matplotlib.patches import Rectangle

from app.db import models


OUTPUT_DIR = Path(__file__).resolve().parents[2] / "outputs" / "weekly_reports"

COLORS = {
    "navy": "#1F2A44",
    "blue": "#2F6FED",
    "green": "#2E7D32",
    "amber": "#B26A00",
    "red": "#B00020",
    "gray": "#5C6470",
    "light": "#F3F6FA",
    "line": "#D8DEE8",
}
RAG_COLORS = {"Green": COLORS["green"], "Amber": COLORS["amber"], "Red": COLORS["red"]}


def build_weekly_report_pdf(project: models.Project, snapshot: models.ProjectSnapshot) -> Path:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    filename = f"{project.id}_{snapshot.id}_weekly_status_report.pdf"
    path = OUTPUT_DIR / filename

    score = snapshot.score_result
    if score is None:
        raise ValueError("A scored snapshot is required for PDF export.")

    narrative = snapshot.narrative
    top_risks = json.loads(narrative.top_risks_json or "[]") if narrative else []
    actions = json.loads(narrative.recommended_actions_json or "[]") if narrative else []
    warnings = [warning["message"] for warning in json.loads(snapshot.parse_warnings_json or "[]")]

    with PdfPages(path) as pdf:
        fig = _new_page()
        ax = fig.axes[0]
        y = 0.94
        y = _header(ax, project.name, snapshot.run_date.isoformat(), y)
        y = _summary_band(ax, project, score, snapshot.data_confidence, y)
        y = _section(ax, "Executive Narrative", [narrative.narrative_text if narrative else "No narrative available."], y)
        y = _subscores(ax, score, y)
        y = _section(ax, "Top Risks", top_risks or ["No top risks recorded."], y)
        y = _section(ax, "Recommended Actions", actions or ["Continue weekly monitoring."], y)
        y = _section(ax, "Data Quality Notes", warnings or ["No parse warnings."], y)
        _footer(ax, project.id, snapshot.id)
        pdf.savefig(fig, bbox_inches="tight")
        plt.close(fig)

    return path


def _new_page():
    fig, ax = plt.subplots(figsize=(8.5, 11.0))
    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1)
    ax.axis("off")
    fig.patch.set_facecolor("white")
    return fig


def _header(ax, title: str, run_date: str, y: float) -> float:
    ax.add_patch(Rectangle((0.05, y - 0.07), 0.9, 0.07, facecolor=COLORS["navy"], edgecolor="none"))
    ax.text(0.075, y - 0.027, "Weekly Project Health Report", fontsize=18, weight="bold", color="white", va="center")
    ax.text(0.075, y - 0.092, title, fontsize=17, weight="bold", color=COLORS["navy"], va="top")
    ax.text(0.075, y - 0.123, f"Reporting week: {run_date}", fontsize=10.5, color=COLORS["gray"], va="top")
    return y - 0.165


def _summary_band(ax, project: models.Project, score: models.ScoreResult, confidence: float, y: float) -> float:
    ax.add_patch(Rectangle((0.05, y - 0.14), 0.9, 0.14, facecolor=COLORS["light"], edgecolor=COLORS["line"], linewidth=0.8))
    items = [
        ("RAG", score.rag_status, RAG_COLORS.get(score.rag_status, COLORS["gray"])),
        ("Composite", f"{score.composite_score:.1f}", COLORS["blue"]),
        ("Confidence", f"{confidence:.0%}", COLORS["navy"]),
        ("Client", project.client_name or "Not specified", COLORS["navy"]),
    ]
    for index, (label, value, color) in enumerate(items):
        x = 0.08 + index * 0.22
        ax.text(x, y - 0.04, value, fontsize=18 if index < 3 else 11, weight="bold", color=color, va="top")
        ax.text(x, y - 0.088, label, fontsize=9.5, color=COLORS["gray"], va="top")
    return y - 0.18


def _section(ax, title: str, lines: list[str], y: float) -> float:
    if y < 0.15:
        return y
    ax.text(0.06, y, title, fontsize=13, weight="bold", color=COLORS["navy"], va="top")
    ax.plot([0.06, 0.94], [y - 0.015, y - 0.015], color=COLORS["line"], linewidth=0.8)
    y -= 0.04
    for line in lines[:6]:
        wrapped = textwrap.wrap(str(line), width=95) or [""]
        prefix = "- " if title != "Executive Narrative" else ""
        for index, part in enumerate(wrapped[:4]):
            ax.text(0.075, y, f"{prefix if index == 0 else '  '}{part}", fontsize=10.2, color="#1B1F2A", va="top")
            y -= 0.022
        y -= 0.006
    return y - 0.018


def _subscores(ax, score: models.ScoreResult, y: float) -> float:
    ax.text(0.06, y, "Signal Scores", fontsize=13, weight="bold", color=COLORS["navy"], va="top")
    ax.plot([0.06, 0.94], [y - 0.015, y - 0.015], color=COLORS["line"], linewidth=0.8)
    y -= 0.045
    values = [
        ("Schedule", score.schedule_score),
        ("Budget", score.budget_score),
        ("Milestones", score.milestone_score),
        ("Blockers", score.blocker_score),
        ("Sentiment", score.sentiment_score),
        ("Scope Penalty", score.scope_penalty),
    ]
    for index, (label, value) in enumerate(values):
        x = 0.075 + (index % 3) * 0.29
        row_y = y - (index // 3) * 0.055
        rendered = "N/A" if value is None else f"{value:.1f}"
        ax.add_patch(Rectangle((x - 0.005, row_y - 0.035), 0.24, 0.042, facecolor="white", edgecolor=COLORS["line"], linewidth=0.7))
        ax.text(x + 0.005, row_y - 0.006, label, fontsize=9.3, color=COLORS["gray"], va="top")
        ax.text(x + 0.18, row_y - 0.006, rendered, fontsize=10.5, weight="bold", color=COLORS["navy"], va="top", ha="right")
    return y - 0.13


def _footer(ax, project_id: str, snapshot_id: int) -> None:
    ax.plot([0.05, 0.95], [0.055, 0.055], color=COLORS["line"], linewidth=0.8)
    ax.text(0.05, 0.035, f"Project ID: {project_id} | Snapshot: {snapshot_id}", fontsize=8.5, color=COLORS["gray"], va="center")
    ax.text(0.95, 0.035, "PulsePoint AI", fontsize=8.5, color=COLORS["gray"], va="center", ha="right")
