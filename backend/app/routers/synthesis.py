"""Monthly synthesis and deck generation endpoints."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Body, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.audit import record_audit_event
from app.db.session import get_db
from app.schemas.synthesis import DeckGenerationRequest, DeckGenerationResponse, SynthesisHistoryItem, SynthesisResponse
from app.synthesis.deck_builder import OUTPUT_DIR, build_monthly_deck
from app.synthesis.trends import generate_monthly_synthesis


router = APIRouter(prefix="/synthesis", tags=["Synthesis"])
DbSession = Annotated[Session, Depends(get_db)]
PPTX_MEDIA_TYPE = "application/vnd.openxmlformats-officedocument.presentationml.presentation"


@router.get("/monthly", response_model=SynthesisResponse)
def monthly_synthesis(db: DbSession) -> SynthesisResponse:
    return generate_monthly_synthesis(db)


@router.post("/generate-deck", response_model=DeckGenerationResponse)
def generate_deck(db: DbSession, payload: DeckGenerationRequest | None = Body(default=None)) -> DeckGenerationResponse:
    synthesis = generate_monthly_synthesis(db)
    branding = payload.branding if payload else None
    path = build_monthly_deck(synthesis, branding=branding)
    branding_applied = bool(branding and not branding.use_default_branding)
    record_audit_event(
        db,
        event_type="deck_generated",
        entity_type="synthesis",
        entity_id=synthesis.generated_date.isoformat(),
        message="Monthly portfolio deck generated.",
        details={
            "filename": path.name,
            "storage": "backend outputs/decks",
            "branding_applied": branding_applied,
        },
    )
    db.commit()
    return DeckGenerationResponse(
        filename=path.name,
        path=str(path),
        download_url=f"/synthesis/decks/{path.name}/download",
        slides=7,
        branding_applied=branding_applied,
    )


@router.get("/history", response_model=list[SynthesisHistoryItem])
def synthesis_history() -> list[SynthesisHistoryItem]:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    items = []
    for path in sorted(OUTPUT_DIR.glob("*.pptx"), key=lambda item: item.stat().st_mtime, reverse=True):
        stat = path.stat()
        items.append(
            SynthesisHistoryItem(
                filename=path.name,
                path=str(path),
                download_url=f"/synthesis/decks/{path.name}/download",
                size_bytes=stat.st_size,
                modified_at=str(stat.st_mtime),
            )
        )
    return items


@router.get("/decks/{filename}/download")
def download_deck(filename: str) -> FileResponse:
    if "/" in filename or "\\" in filename or not filename.endswith(".pptx"):
        raise HTTPException(status_code=400, detail="Invalid deck filename.")

    path = OUTPUT_DIR / filename
    if not path.exists() or not path.is_file():
        raise HTTPException(status_code=404, detail="Deck file not found.")

    return FileResponse(path, media_type=PPTX_MEDIA_TYPE, filename=filename)
