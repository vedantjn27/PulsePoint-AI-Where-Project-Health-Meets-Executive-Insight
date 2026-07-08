# PulsePoint AI Manual Testing And Demo Workflow

Use this file to manually test the integrated frontend and backend, and to run a smooth end-to-end demo.

## 1. Local URLs

Backend API:

```text
http://127.0.0.1:8000
```

Backend Swagger docs:

```text
http://127.0.0.1:8000/docs
```

Frontend app:

```text
http://127.0.0.1:5173
```

The frontend is configured through:

```text
frontend/.env.local
VITE_API_BASE_URL=http://127.0.0.1:8000
```

## 2. First-Time Setup Check

1. Confirm the backend server is running.
2. Confirm the frontend dev server is running.
3. Open `http://127.0.0.1:5173`.
4. Create a local frontend account from the signup screen.
5. Sign in and open the app dashboard.
6. Open `System Health`.
7. Confirm:
   - Service is `PulsePoint AI`
   - Status is `ok`
   - Database is connected
   - API base URL is `http://127.0.0.1:8000`

Note: The frontend login is local browser storage only. It is for demo access, not backend authentication.

## 3. Recommended Demo Flow

### Step 1: Branding Page

Open:

```text
http://127.0.0.1:5173
```

Show the product positioning:

```text
Where project health meets executive insight
```

Then click into the app.

### Step 2: Sign Up Or Log In

Create a local account if needed.

Suggested demo account:

```text
Name: Demo User
Email: demo@pulsepoint.ai
Password: demo123
```

### Step 3: System Health

Open:

```text
/app/health
```

Demo message:

The frontend is connected to the FastAPI backend and the database is available.

### Step 4: Portfolio Dashboard

Open:

```text
/app/dashboard
```

Expected behavior:

- If the database is empty, the backend automatically seeds sample data from the internship-provided XLSX files.
- RAG distribution appears.
- Average data confidence appears.
- Open critical alert count appears.
- Latest project health table appears.

Demo message:

The dashboard is powered by real backend scoring, not frontend mock data. The sample projects are seeded from the provided workbooks.

### Step 5: Projects

Open:

```text
/app/projects
```

Test:

1. Confirm seeded demo projects are listed.
2. Create a new manual project.
3. Confirm it appears in the project list.
4. Open an existing demo project.

Optional create-project test:

```text
Name: Manual Demo Project
Client: Demo Client
PM: Demo PM
Budget: 250000
```

### Step 6: Project Overview

Inside a project detail page, open the `Overview` tab.

Confirm:

- Project metadata is visible.
- Latest RAG status is visible.
- Composite score is visible.
- Data confidence is visible.
- Latest run date is visible.

Demo message:

Every project has a scored snapshot, and the health summary is derived from persisted backend data.

### Step 7: Upload And Analyze

Open the `Upload & Analyze` tab.

Test with a file from:

```text
backend/sample_data
```

Useful files:

```text
Project Plan B.xlsx
S2P Project.xlsx
on_track_project.json
messy_project.csv
```

Test flow:

1. Select a file.
2. Click `Validate upload`.
3. Confirm normalized counts, data confidence, missing fields, and parse warnings appear.
4. Click `Analyze & score`.
5. Confirm RAG status, composite score, sub-scores, narrative, risks, actions, and reasoning trace are returned.

Demo message:

The backend accepts JSON, CSV, and XLSX. Messy data does not crash the pipeline; it produces parse warnings and lower confidence.

### Step 8: Score Breakdown

Open the `Score Breakdown` tab.

Confirm each scoring signal appears:

- Schedule
- Budget
- Milestones
- Blockers
- Sentiment

Confirm each signal shows:

- Score
- Availability
- Base weight
- Adjusted weight
- Reason

Demo message:

This is the key explainability screen. The RAG score is deterministic and auditable, not an LLM judgment.

### Step 9: Snapshots

Open the `Snapshots` tab.

Confirm:

- Historical snapshot rows appear.
- RAG status appears per snapshot.
- Composite score appears per snapshot.
- Data confidence appears per snapshot.
- The trend chart is populated.

Demo message:

The sample workbooks generate multiple weeks of history, which powers trends and synthesis.

### Step 10: Scenario Simulator

Open the `Scenario Simulator` tab.

Test:

1. Select `budget`.
2. Set delta to `-15`.
3. Run simulation.
4. Confirm current vs simulated composite score.
5. Confirm current vs simulated RAG status.
6. Confirm movement and explanatory note.

Then test:

```text
signal: blockers
delta: -25
```

Demo message:

The simulator is a what-if layer. It does not persist changes; it shows how a signal movement would affect the score.

### Step 11: Agent Reasoning

Open the `Agent Reasoning` tab after running an analysis.

Confirm:

- Narrative appears.
- Top risks appear.
- Recommended actions appear.
- Reasoning trace appears.

Demo message:

The agent investigates and explains the deterministic score. It does not decide the RAG color.

### Step 12: Project Exports

Open the `Exports` tab.

Test:

1. Click `View Markdown report`.
2. Confirm Markdown preview appears.
3. Click `Download weekly PDF`.
4. Confirm the PDF downloads or opens.

Demo message:

The weekly report is client-ready and generated by the backend from the latest scored snapshot.

### Step 13: Reports And Exports

Open:

```text
/app/reports
```

Test:

1. Select a project.
2. Open Markdown report.
3. Download PDF report.
4. Review deck generation history.

Demo message:

This is the centralized artifact area for weekly project reports and monthly portfolio decks.

### Step 14: Monthly Synthesis

Open:

```text
/app/synthesis
```

Confirm:

- Period
- Total projects
- Average confidence
- Portfolio trend
- RAG distribution
- Trend points
- Movers
- Systemic themes
- Emerging risks
- Recommendations

Test default deck:

1. Click `Default deck`.
2. Confirm deck generation success toast.
3. Confirm deck history refreshes.

Test branded deck:

1. Click `Branded deck`.
2. Enter a client name.
3. Pick primary/accent colors.
4. Optionally provide a logo path.
5. Generate deck.
6. Confirm `executive_client` or the chosen client name appears in the generated filename.

Demo message:

This converts weekly project-level scoring into portfolio-level executive insight and a PowerPoint artifact.

### Step 15: Ask Portfolio Agent

Open:

```text
/app/ask
```

Test starter questions:

```text
Which project is most at risk and why?
What changed since last week?
Which risks need leadership attention?
Are there systemic issues across the portfolio?
```

Confirm:

- Answer appears.
- Projects considered appears.
- LLM provider used appears.
- Reasoning trace appears.

Demo message:

The agent answers across the portfolio using persisted project health data and a traceable reasoning process.

### Step 16: Alerts

Open:

```text
/app/alerts
```

Test:

1. Review all alerts.
2. Filter open alerts.
3. Acknowledge one alert.
4. Confirm it moves to acknowledged.
5. Return to dashboard and confirm open alert count updates.

Demo message:

Operational changes like critical blockers, budget spikes, and status flips surface as alerts.

### Step 17: Scoring Configuration

Open:

```text
/app/scoring-config
```

Confirm:

- Current config JSON appears.
- Weights are visible.
- Thresholds are visible.
- Overrides are visible.
- Version history appears.

Safe manual test:

1. Do not change the config during the main demo unless needed.
2. If testing updates, copy the full existing config first.
3. Make a small valid change.
4. Enter a change reason.
5. Save.
6. Confirm version history updates.
7. Restore original config if necessary.

Demo message:

The scoring model is configurable and versioned, which makes methodology changes auditable.

### Step 18: Scheduler

Open:

```text
/app/scheduler
```

Confirm:

- Scheduler status appears.
- Cron expression appears.
- Next run time appears if available.
- Last run time/result appears if available.

Test:

1. Keep the cron expression unchanged unless needed.
2. Click `Run portfolio now`.
3. Confirm the run result updates.
4. Refresh dashboard, projects, alerts, synthesis, and audit log.

Demo message:

The backend supports recurring portfolio scoring and manual run-now for demos.

### Step 19: Audit Log

Open:

```text
/app/audit-log
```

Confirm entries exist for actions such as:

- Sample data seeded
- Project created
- Project analyzed
- Weekly PDF exported
- Deck generated
- Alert acknowledged
- Scoring config updated

Expand entries to inspect details JSON.

Demo message:

Every important backend action is inspectable, which supports trust and debugging.

### Step 20: Demo Data

Open:

```text
/app/demo
```

Test:

1. Click `Reload sample workbook data`.
2. Confirm success toast.
3. Return to dashboard.
4. Confirm sample projects are visible.

Demo message:

The demo can be reset to a known state using the internship-provided sample workbooks.

## 4. Full Feature Checklist

Use this checklist before the final demo.

- [ ] Frontend opens at `http://127.0.0.1:5173`
- [ ] Backend docs open at `http://127.0.0.1:8000/docs`
- [ ] Signup works
- [ ] Login works
- [ ] System Health shows backend/database connected
- [ ] Dashboard loads and auto-seeds sample data if empty
- [ ] Projects list loads
- [ ] Project creation works
- [ ] Project detail opens
- [ ] Upload validation works
- [ ] Analyze and score works
- [ ] Score breakdown works
- [ ] Snapshot history works
- [ ] Scenario simulator works
- [ ] Agent reasoning trace appears after analysis
- [ ] Markdown report preview works
- [ ] Weekly PDF download works
- [ ] Reports page project selection works
- [ ] Monthly synthesis loads
- [ ] Default deck generation works
- [ ] Branded deck generation works
- [ ] Deck history displays generated files
- [ ] Ask Agent answers portfolio questions
- [ ] Alerts load
- [ ] Alert acknowledgement works
- [ ] Scoring config loads
- [ ] Scoring config history loads
- [ ] Scheduler status loads
- [ ] Run portfolio now works
- [ ] Audit log shows recorded actions
- [ ] Demo seed reload works

## 5. Troubleshooting

If the frontend cannot connect:

1. Open `System Health`.
2. Confirm API base URL is:

```text
http://127.0.0.1:8000
```

3. Save the base URL.
4. Refresh the page.
5. Confirm the backend is running.

If PDF export fails:

1. Confirm the project has at least one scored snapshot.
2. Run `Analyze & score`.
3. Try the export again.

If Agent Reasoning is empty:

1. Run a fresh analysis from `Upload & Analyze`.
2. Stay on the same browser session.
3. Open `Agent Reasoning`.

If deck history looks empty:

1. Open Monthly Synthesis.
2. Generate a default deck.
3. Generate a branded deck.
4. Refresh deck history.

If sample data is missing:

1. Open Demo Data.
2. Click `Reload sample workbook data`.
3. Return to Dashboard.

