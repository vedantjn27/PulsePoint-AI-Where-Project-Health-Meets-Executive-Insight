"""Consistency checks for monthly synthesis deck content."""

from app.schemas.synthesis import SynthesisResponse


def validate_synthesis_consistency(synthesis: SynthesisResponse) -> None:
    counted = sum(synthesis.rag_distribution.values())
    if counted and counted != synthesis.total_projects:
        raise ValueError("RAG distribution does not match total project count.")
    if synthesis.average_confidence < 0 or synthesis.average_confidence > 1:
        raise ValueError("Average confidence must be between 0 and 1.")
