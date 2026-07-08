# PulsePoint AI RAG Methodology

PulsePoint AI converts weekly project delivery data into a Red/Amber/Green
health status that is clear enough for executives and rigorous enough for
delivery teams to audit. The key design decision is separation of duties: the
RAG status is computed by deterministic scoring logic, while the AI agent
investigates, explains, and recommends action after the score is fixed.

## 1. Signals Used

The model combines delivery, financial, risk, qualitative, and data-quality
signals. Each signal exists because it answers a different leadership question:

| Signal | What It Measures | Why It Matters |
|---|---|---|
| Schedule variance | Actual completion compared with expected completion based on elapsed time | A project can look calm in weekly notes while quietly falling behind the baseline plan. |
| Budget burn ratio | Percent budget spent divided by percent work complete | Overspending before equivalent delivery is one of the earliest signs of commercial risk. |
| Milestone health | Overdue milestones and near-term milestones with weak task progress | Milestones are the commitments clients and executives care about most. |
| Blocker/risk severity | Open blockers weighted by severity and age | A long-running high-severity blocker should not be averaged away by healthy metrics elsewhere. |
| Stakeholder sentiment | Tone of PM/client commentary, classified as positive, neutral, or negative | Delivery teams often describe risk before it appears in structured fields. |
| Scope stability | Frequency and size of recent scope changes | Scope churn is a leading indicator of future schedule and budget pressure. |
| Data completeness | Percent of expected fields that are present and parseable | Leaders need to know how much confidence to place in the computed status. |

## 2. Score Calculation

Each core signal is normalized to a 0-100 sub-score, where 100 is healthiest.
The composite score is then calculated using transparent weights:

```text
Composite = 0.25 * Schedule
          + 0.25 * Budget
          + 0.20 * Milestones
          + 0.20 * Blockers
          + 0.10 * Sentiment
          + Scope Penalty
```

Scope churn is handled as a penalty instead of a base weighted signal because
not every project plan tracks scope changes consistently. This lets the scoring
engine use scope data when it exists without unfairly punishing projects that do
not provide it.

Budget is also optional. If budget fields are entirely missing, the 25% budget
weight is redistributed proportionally across the available scored signals
rather than defaulting the budget score to zero. The same principle applies to
other unavailable optional fields: missing data reduces confidence, not
automatically health.

## 3. RAG Mapping

| Composite Score | Status | Interpretation |
|---:|---|---|
| 75-100 | Green | On track with no material intervention required. |
| 50-74 | Amber | At risk; needs management attention this week. |
| 0-49 | Red | Off track; active intervention is required. |

The scoring engine also applies override rules. For example, a critical blocker
open for more than 14 days or a budget burn ratio above 1.5x can cap the status
at Amber or force Red. This is intentional: a single severe delivery threat
should not disappear inside an average.

## 4. Messy Data Handling

Real project data is inconsistent, so the backend treats resilience as a core
requirement:

- Fuzzy column matching maps common variants such as `% Complete`,
  `PercentComplete`, and `pct_done` to the same normalized field.
- Unparseable rows are returned as parse warnings and are never silently
  dropped.
- Missing or malformed dates are treated as unknown rather than failed, unless
  enough evidence exists to identify schedule risk.
- Missing commentary defaults sentiment to neutral and lowers the confidence
  score.
- If a file cannot be parsed at all, the API should return `RAG: Unknown` with
  actionable guidance instead of crashing.

The data confidence score is shown beside every RAG result. A status of
`Amber - 62% confidence` communicates something different from
`Amber - 94% confidence`, and executives should see that distinction before
acting.

## 5. Role Of The AI Agent

The agent does not decide the RAG color. Its job starts after deterministic
scoring is complete. It can inspect project history, risk details, similar past
projects, scoring configuration, and sensitivity checks to produce a grounded
narrative, top risks, recommended actions, and a reasoning trace.

This makes the system both trustworthy and useful:

- Trustworthy, because the score can be reproduced from the data and
  `scoring_config.yaml`.
- Useful, because the agent explains what changed, why it matters, and what
  leadership should do next.
- Auditable, because the reasoning trace records which read-only tools were
  used to support each major claim.

## 6. Weekly Output Contract

Every weekly report should include:

- Project ID and project name
- Run date
- RAG status and composite score
- Data confidence
- Schedule, budget, milestone, blocker, and sentiment sub-scores
- Scope penalty, if applicable
- Plain-English narrative
- Top risks
- Recommended actions
- Trend versus last week
- Parse warnings
- Agent reasoning trace

This output structure is designed to satisfy both sides of the assignment:
clear executive communication and inspectable backend reasoning.

