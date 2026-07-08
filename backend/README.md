# PulsePoint AI Backend

Backend service for project health scoring, agentic narrative generation,
portfolio synthesis, and executive deck generation.

## Current Status

Phase 1 foundation is implemented:

- FastAPI app entrypoint with `/health`
- Local `.env` configuration loading
- SQLite database session setup
- SQLAlchemy models for the core backend schema
- Startup-time table creation
- Foundation tests

Phase 2 ingestion and validation is implemented:

- Normalized project plan schemas
- JSON, CSV, and XLSX parsers
- Deterministic fuzzy field matching for messy headers
- Non-fatal parse warnings
- Data-confidence calculation
- Sample JSON and messy CSV project plans
- Ingestion tests

Phase 3 deterministic scoring is implemented:

- Config-driven scoring from `app/scoring/scoring_config.yaml`
- Schedule, budget, milestone, blocker, sentiment, and scope-penalty scoring
- Missing optional signal weight redistribution
- Green/Amber/Red mapping
- Critical override rules for budget burn and long-running blockers
- Score breakdown details for explainability
- Unit tests covering formulas, missing budget behavior, scope penalty, and overrides

Phase 4 project pipeline is implemented:

- Project create/list/detail/delete endpoints
- Upload endpoint for parse/validate without scoring
- Analyze endpoint for upload -> validate -> deterministic score -> persist snapshot
- Snapshot history and latest snapshot endpoints
- Score breakdown endpoint
- SQLite persistence for snapshots, score results, narratives, milestones, and risks
- API tests for the core project flow

Phase 5 LLM abstraction and agent reasoning is implemented:

- Provider-agnostic LLM interface
- Mistral primary adapter, Groq fallback adapter, Gemini secondary fallback adapter
- Fallback provider chain
- Read-only agent tools for history, risk detail, similar scored snapshots, scoring config, and sensitivity checks
- Bounded reasoning loop with deterministic fallback narrative
- Persisted reasoning trace on analyzed snapshots
- Tests use fake LLM clients and never require live API calls

Phase 6 operations layer is implemented:

- Alert generation for status flips, budget override spikes, and critical blockers
- Alert feed and acknowledgement endpoints
- Dashboard summary endpoint with RAG counts, confidence, and open critical alerts
- APScheduler-backed weekly scheduler shell
- Manual portfolio run-now endpoint
- Scheduler status and cron config endpoints

Phase 7 demo reliability is implemented:

- Dashboard auto-seeds demo data when the database is empty
- Manual demo seed/reset endpoint
- Internship-provided XLSX workbooks are used as the sample source data
- Four weeks of historical scored snapshots per sample project
- Demo data is isolated to `demo_` project IDs

Phase 8 monthly synthesis and deck backend is implemented:

- Portfolio trend synthesis endpoint
- RAG distribution and confidence summary
- Movers, systemic themes, emerging risks, and executive recommendations
- PowerPoint deck generator
- Generated decks saved under `outputs/decks/`

Phase 9 `/ask` portfolio agent is implemented:

- Portfolio-wide natural-language endpoint
- Uses read-only project history and similar-project tools
- Returns a grounded answer plus reasoning trace
- Falls back to deterministic response if providers are unavailable

Phase 10 executive reliability features are implemented:

- Client-ready weekly PDF report export per scored project
- Scenario simulator for signal-level what-if analysis
- Persistent audit log for key backend actions
- Versioned scoring configuration history
- Optional deck branding with default PulsePoint generation still supported

## Run Locally

```powershell
.\.venv\Scripts\Activate.ps1
uvicorn app.main:app --reload
```

API docs will be available at:

```text
http://127.0.0.1:8000/docs
```

## Test

```powershell
.\.venv\Scripts\python.exe -m pytest
```

## Ingestion Notes

The ingestion layer accepts structured JSON plus row-based CSV/XLSX files. CSV
and XLSX headers are normalized with deterministic aliases, so fields such as
`% Complete`, `PercentComplete`, and `pct_done` map to the same canonical field.
Bad rows and missing values are surfaced as warnings instead of crashing the
pipeline.

## Scoring Notes

The RAG score is deterministic and does not use an LLM. All weights and
thresholds are loaded from `app/scoring/scoring_config.yaml`. If optional
signals such as budget are missing, their weight is redistributed across the
available signals instead of forcing a zero score.

## Agent Notes

The agent explains and investigates the deterministic score; it does not decide
or change the RAG status. During analysis, the backend executes read-only tools
to collect evidence, then asks the configured LLM provider for an executive
narrative. If all providers fail or are unavailable, the response falls back to
a deterministic template and still returns a reasoning trace.

## Core Endpoints

```text
GET    /health
POST   /projects
GET    /projects
GET    /projects/{project_id}
DELETE /projects/{project_id}
POST   /projects/{project_id}/upload
POST   /projects/{project_id}/analyze
GET    /projects/{project_id}/snapshots
GET    /projects/{project_id}/snapshots/latest
GET    /projects/{project_id}/score-breakdown
POST   /projects/{project_id}/simulate
GET    /projects/{project_id}/export
GET    /projects/{project_id}/export/pdf
GET    /dashboard/summary
GET    /alerts
POST   /alerts/{alert_id}/acknowledge
GET    /audit-log
GET    /scoring-config
PUT    /scoring-config
GET    /scoring-config/history
GET    /scheduler/status
PUT    /scheduler/config
POST   /scheduler/run-all-now
POST   /demo/seed
GET    /synthesis/monthly
POST   /synthesis/generate-deck
GET    /synthesis/history
POST   /ask
```

## Demo Mode

Opening `GET /dashboard/summary` on an empty database automatically loads the
internship-provided XLSX sample workbooks from `sample_data/`. To manually reset
sample-backed demo data later, use:

```powershell
Invoke-RestMethod -Method Post http://127.0.0.1:8000/demo/seed
```

The seed endpoint resets only projects whose IDs start with `demo_`, then loads
historical snapshots derived from the provided workbooks for dashboard, alert,
scheduler, synthesis, and `/ask` testing.

## Monthly Synthesis

Generate portfolio synthesis JSON:

```powershell
Invoke-RestMethod http://127.0.0.1:8000/synthesis/monthly
```

Generate the PowerPoint deck:

```powershell
Invoke-RestMethod -Method Post http://127.0.0.1:8000/synthesis/generate-deck
```

Generate a branded deck:

```powershell
Invoke-RestMethod -Method Post http://127.0.0.1:8000/synthesis/generate-deck `
  -ContentType "application/json" `
  -Body '{"branding":{"use_default_branding":false,"client_name":"Executive Client","primary_color":"#123456","accent_color":"#AA5500"}}'
```

## Weekly Report And Simulation

Export the latest scored snapshot as a polished PDF:

```powershell
Invoke-WebRequest http://127.0.0.1:8000/projects/demo_project_plan_b/export/pdf -OutFile weekly_report.pdf
```

Run a what-if scenario by applying a point change to one scoring signal:

```powershell
Invoke-RestMethod -Method Post http://127.0.0.1:8000/projects/demo_project_plan_b/simulate `
  -ContentType "application/json" `
  -Body '{"signal":"budget","delta":-15}'
```

## Ask Endpoint

Ask a portfolio-level question:

```powershell
Invoke-RestMethod -Method Post http://127.0.0.1:8000/ask `
  -ContentType "application/json" `
  -Body '{"question":"Which project is most at risk and why?"}'
```
