# 📂 PulsePoint AI — Project Folder Structure

> Annotated directory tree showing the purpose of every module and file.

---

```
PulsePoint AI/
│
├── 📄 README.md                          # Project overview, architecture, features
├── 📄 SETUP_GUIDE.md                     # Step-by-step local setup instructions
├── 📄 FOLDER_STRUCTURE.md                # This file — annotated directory tree
├── 📄 PulsePoint_AI_Implementation_Plan.md  # Full build specification document
├── 📄 MANUAL_TESTING_AND_DEMO_WORKFLOW.md   # 20-step manual testing guide
├── 📄 requirements.txt                   # Root-level Python dependencies
├── 📄 .gitignore                         # Git ignore rules
│
├── 📁 assets/                            # README images & animations
│   ├── 🎨 banner_animation.svg           # Animated SVG title banner
│   ├── 🎨 impact_line.svg               # Animated impact statement SVG
│   ├── 🖼️ architecture_diagram.png       # System architecture diagram
│   ├── 🖼️ workflow_diagram.png           # Agent reasoning workflow
│   ├── 🖼️ rag_scoring_visual.png         # RAG methodology infographic
│   └── 🖼️ dashboard_preview.png          # Dashboard UI mockup
│
├── 📁 backend/                           # FastAPI backend application
│   ├── 📄 .env                           # Environment variables (API keys, DB URL)
│   ├── 📄 .env.example                   # Template for .env
│   ├── 📄 requirements.txt               # Python dependencies
│   ├── 📄 Dockerfile                     # Container build config
│   ├── 📄 docker-compose.yml             # Docker orchestration
│   ├── 📄 README.md                      # Backend-specific documentation
│   ├── 📄 RAG_Methodology.md             # Standalone 1-page RAG methodology
│   ├── 📄 RAG_Methodology.pdf            # PDF version for submission
│   ├── 📄 RAG_Methodology.docx           # Word version
│   ├── 📄 pulsepoint.db                  # SQLite database (auto-created)
│   │
│   ├── 📁 app/                           # Main application package
│   │   ├── 📄 __init__.py                # Package init
│   │   ├── 📄 main.py                    # FastAPI app entrypoint, CORS, lifespan
│   │   ├── 📄 audit.py                   # Audit logging utility
│   │   ├── 📄 demo_seed.py              # Sample data seeding logic
│   │   │
│   │   ├── 📁 db/                        # Database layer
│   │   │   ├── 📄 models.py              # SQLAlchemy ORM models (8 tables)
│   │   │   │                              #   → projects, project_snapshots,
│   │   │   │                              #     score_results, narratives,
│   │   │   │                              #     milestones, risks_blockers,
│   │   │   │                              #     alerts, scoring_config
│   │   │   └── 📄 session.py             # DB session/engine management
│   │   │
│   │   ├── 📁 ingestion/                 # Data ingestion pipeline
│   │   │   ├── 📄 parsers.py             # Multi-format parser (XLSX/CSV/JSON)
│   │   │   │                              #   → Fuzzy column name matching
│   │   │   │                              #   → Row quarantining for bad data
│   │   │   ├── 📄 validators.py          # Field validation & data confidence calc
│   │   │   └── 📄 schemas.py             # Ingestion Pydantic schemas
│   │   │
│   │   ├── 📁 scoring/                   # Deterministic scoring engine
│   │   │   ├── 📄 engine.py              # 5-signal composite scorer
│   │   │   │                              #   → Schedule, Budget, Milestones,
│   │   │   │                              #     Blockers, Sentiment + Scope penalty
│   │   │   │                              #   → Override rules enforcement
│   │   │   ├── 📄 scoring_config.yaml    # Configurable weights & thresholds
│   │   │   └── 📄 schemas.py             # Scoring Pydantic schemas
│   │   │
│   │   ├── 📁 llm/                       # LLM provider abstraction
│   │   │   ├── 📄 client.py              # Provider-agnostic interface
│   │   │   │                              #   → generate(system, user, json_mode)
│   │   │   │                              #   → Automatic fallback chain
│   │   │   ├── 📄 mistral_adapter.py     # Mistral Large 2 (PRIMARY)
│   │   │   ├── 📄 groq_adapter.py        # Groq/Llama (FALLBACK)
│   │   │   └── 📄 gemini_adapter.py      # Google Gemini (SECONDARY)
│   │   │
│   │   ├── 📁 agent/                     # AI agent system (CORE)
│   │   │   ├── 📄 pipeline.py            # Full pipeline orchestrator
│   │   │   │                              #   → Ingest → Validate → Score
│   │   │   │                              #   → Agent Loop → Persist → Alert
│   │   │   ├── 📄 reasoning_loop.py      # Tool-calling reasoning loop
│   │   │   │                              #   → Plan → Call → Observe → Decide
│   │   │   │                              #   → MAX_ITERATIONS bounded
│   │   │   ├── 📄 tools.py               # 5 read-only investigation tools
│   │   │   │                              #   → get_project_history
│   │   │   │                              #   → get_risk_detail
│   │   │   │                              #   → get_similar_past_projects
│   │   │   │                              #   → get_scoring_config
│   │   │   │                              #   → recompute_subscore_sensitivity
│   │   │   ├── 📄 portfolio_ask.py       # Portfolio-wide /ask agent
│   │   │   └── 📄 prompts.py             # System prompts & constraints
│   │   │
│   │   ├── 📁 synthesis/                 # Monthly portfolio synthesis
│   │   │   ├── 📄 trends.py              # Cross-project trend analysis
│   │   │   │                              #   → Portfolio trend line
│   │   │   │                              #   → Movers (RAG flips)
│   │   │   │                              #   → Common root causes
│   │   │   │                              #   → Emerging risks
│   │   │   ├── 📄 deck_builder.py        # PPTX generation (6-7 slides)
│   │   │   │                              #   → Title, Portfolio Glance, Trends,
│   │   │   │                              #     Movers, Risks, Recommendations
│   │   │   ├── 📄 deck_theme.py          # Centralized fonts/colors/layout
│   │   │   └── 📄 consistency_check.py   # Cross-slide number consistency
│   │   │
│   │   ├── 📁 reports/                   # Report generation
│   │   │   └── 📄 weekly_pdf.py          # Weekly PDF/Markdown export
│   │   │
│   │   ├── 📁 schemas/                   # Shared Pydantic schemas
│   │   │
│   │   ├── 📁 routers/                   # FastAPI route handlers
│   │   │   ├── 📄 projects.py            # /projects CRUD + upload + analyze
│   │   │   ├── 📄 dashboard.py           # /dashboard/summary
│   │   │   ├── 📄 alerts.py              # /alerts + acknowledge
│   │   │   ├── 📄 synthesis.py           # /synthesis + deck generation
│   │   │   ├── 📄 explainability.py      # /score-breakdown + /scoring-config
│   │   │   │                              #   + /sensitivity simulation
│   │   │   ├── 📄 ask.py                 # /ask portfolio agent Q&A
│   │   │   ├── 📄 scheduler.py           # /scheduler status + run-now
│   │   │   ├── 📄 audit.py               # /audit-log retrieval
│   │   │   └── 📄 demo.py                # /demo/seed endpoint
│   │   │
│   │   ├── 📁 scheduler/                 # Job scheduling
│   │   │   └── 📄 weekly_job.py          # APScheduler weekly cron setup
│   │   │
│   │   └── 📁 core/                      # Core utilities & config
│   │
│   ├── 📁 sample_data/                   # Test project plans
│   │   ├── 📄 Project Plan B.xlsx        # Real internship workbook
│   │   ├── 📄 S2P Project.xlsx           # Real internship workbook
│   │   ├── 📄 on_track_project.json      # Synthetic green project
│   │   ├── 📄 messy_project.csv          # Deliberately messy data
│   │   └── 📁 manual_upload_templates/   # 6 RAG-specific test templates
│   │       ├── 📄 green_on_track.json
│   │       ├── 📄 green_ahead.json
│   │       ├── 📄 amber_budget.json
│   │       ├── 📄 amber_milestones.json
│   │       ├── 📄 red_critical.json
│   │       └── 📄 red_multiple.json
│   │
│   ├── 📁 outputs/                       # Generated artifacts
│   │   ├── 📁 weekly_reports/            # Saved JSON/PDF per run
│   │   └── 📁 decks/                     # Generated PPTX decks
│   │
│   ├── 📁 tests/                         # Backend test suite
│   │   └── 📄 test_scoring_engine.py     # Scoring engine unit tests
│   │
│   └── 📁 scripts/                       # Utility scripts
│       └── 📄 generate_sample_xlsx.py    # Sample data generation
│
└── 📁 frontend/                          # React/TanStack frontend
    ├── 📄 package.json                   # Dependencies & scripts
    ├── 📄 tsconfig.json                  # TypeScript configuration
    ├── 📄 vite.config.ts                 # Vite build configuration
    ├── 📄 components.json                # shadcn/ui component config
    ├── 📄 eslint.config.js               # Linting rules
    ├── 📄 .env.local                     # API URL configuration
    │
    ├── 📁 src/
    │   ├── 📄 router.tsx                 # TanStack Router setup
    │   ├── 📄 routeTree.gen.ts           # Auto-generated route tree
    │   ├── 📄 styles.css                 # Global styles + Tailwind
    │   │
    │   ├── 📁 routes/                    # File-based routing (pages)
    │   │   ├── 📄 index.tsx              # Landing / branding page
    │   │   ├── 📄 login.tsx              # Login page
    │   │   ├── 📄 signup.tsx             # Registration page
    │   │   ├── 📄 __root.tsx             # Root layout
    │   │   ├── 📄 app.tsx                # App shell (sidebar + layout)
    │   │   ├── 📄 app.dashboard.tsx      # Portfolio dashboard
    │   │   ├── 📄 app.projects.tsx       # Projects list
    │   │   ├── 📄 app.projects.$projectId.tsx  # Project detail (8 tabs)
    │   │   ├── 📄 app.ask.tsx            # Ask Portfolio Agent
    │   │   ├── 📄 app.synthesis.tsx      # Monthly synthesis + decks
    │   │   ├── 📄 app.alerts.tsx         # Alerts feed
    │   │   ├── 📄 app.reports.tsx        # Reports & exports
    │   │   ├── 📄 app.scoring-config.tsx # Scoring config editor
    │   │   ├── 📄 app.scheduler.tsx      # Scheduler dashboard
    │   │   ├── 📄 app.audit-log.tsx      # Audit log viewer
    │   │   ├── 📄 app.health.tsx         # System health
    │   │   └── 📄 app.demo.tsx           # Demo data management
    │   │
    │   ├── 📁 components/                # Reusable UI components
    │   │   ├── 📄 logo.tsx               # PulsePoint logo component
    │   │   ├── 📄 page-parts.tsx         # Shared page layout parts
    │   │   ├── 📄 theme-toggle.tsx       # Dark/light mode toggle
    │   │   └── 📁 ui/                    # shadcn/ui primitives
    │   │       └── (accordion, button, card, dialog, tabs, etc.)
    │   │
    │   ├── 📁 lib/                       # Utilities
    │   │   └── 📄 api.ts                 # API client & fetch helpers
    │   │
    │   └── 📁 hooks/                     # Custom React hooks
    │
    └── 📁 public/                        # Static assets
```

---

## 🔑 Key Architecture Decisions

| Decision | Rationale |
|:---|:---|
| **Scoring in `engine.py`, not in LLM** | RAG status must be deterministic and auditable — never an LLM guess |
| **Config in YAML, not hardcoded** | Weights/thresholds are transparent, versioned, tunable without code changes |
| **LLM adapters behind interface** | Swap providers or add fallbacks without touching business logic |
| **Agent tools are read-only** | The agent investigates and explains — it never modifies data or scores |
| **File-based routing (TanStack)** | Each page is self-contained; route structure mirrors feature set |
| **SQLite with ORM** | Zero-setup for development; ORM makes Postgres migration trivial |

---

<p align="center"><sub>📖 See <a href="README.md">README.md</a> for features · <a href="SETUP_GUIDE.md">SETUP_GUIDE.md</a> for installation</sub></p>
