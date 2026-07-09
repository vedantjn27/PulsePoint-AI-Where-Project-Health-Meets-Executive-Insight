// PulsePoint AI API client
function normalizeApiBase(url: string) {
  return url.trim().replace(/\/+$/, "");
}

export const DEFAULT_API_BASE_URL = normalizeApiBase(
  (import.meta as any).env?.VITE_API_BASE_URL || "http://127.0.0.1:8000"
);

export const API_BASE_URL = DEFAULT_API_BASE_URL;

export function setApiBase(url: string) {
  if (typeof window !== "undefined") localStorage.setItem("pp_api_base", normalizeApiBase(url));
}
export function getApiBase() {
  if (typeof window !== "undefined") {
    const saved = localStorage.getItem("pp_api_base");
    return saved ? normalizeApiBase(saved) : DEFAULT_API_BASE_URL;
  }
  return DEFAULT_API_BASE_URL;
}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const j = await res.json();
      detail = j.detail || JSON.stringify(j);
    } catch {}
    throw new Error(`${res.status}: ${detail}`);
  }
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) return res.json();
  return (await res.text()) as unknown as T;
}

export async function api<T = any>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const url = `${getApiBase()}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init.body && !(init.body instanceof FormData)
        ? { "Content-Type": "application/json" }
        : {}),
      ...(init.headers || {}),
    },
  });
  return handle<T>(res);
}

export const apiUrl = (path: string) => `${getApiBase()}${path}`;

// Types
export interface DashboardSummary {
  total_projects: number;
  rag_counts: { Green: number; Amber: number; Red: number };
  average_data_confidence: number;
  open_critical_alerts: number;
  latest_projects: Array<{
    project_id: string;
    project_name: string;
    rag_status: "Green" | "Amber" | "Red" | null;
    composite_score: number | null;
    data_confidence: number | null;
  }>;
}

export interface Project {
  id: string;
  name: string;
  client_name?: string;
  pm_name?: string;
  start_date?: string;
  planned_end_date?: string;
  budget_total?: number;
  latest_health?: {
    snapshot_id: number;
    rag_status: string;
    composite_score: number;
    data_confidence: number;
    run_date: string;
  } | null;
}

export interface Snapshot {
  id?: number;
  snapshot_id: number;
  project_id: string;
  run_date: string;
  data_confidence: number;
  parse_warnings: string[];
  rag_status?: string;
  composite_score?: number;
  score: {
    snapshot_id: number;
    run_date: string;
    rag_status: string;
    composite_score: number;
    data_confidence: number;
  } | null;
}

export interface ProjectOverviewRow {
  row_type: string;
  index: number;
  name: string;
  status?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  percent_complete?: number | null;
  critical: boolean;
  schedule_slippage: string;
  budget_burn: string;
  milestone_health: string;
  blockers: string;
  stakeholder_sentiment: string;
  other_indicators: Record<string, any>;
}

export interface ProjectOverviewTable {
  project_id: string;
  snapshot_id: number;
  run_date: string;
  rows: ProjectOverviewRow[];
}

export interface UploadValidationResult {
  project_id: string;
  source_type: string;
  data_confidence: number;
  parse_warnings: string[];
  missing_fields: string[];
  normalized_counts: Record<string, number>;
}

export interface AnalyzeResult {
  project_id: string;
  project_name: string;
  run_date: string;
  rag_status: string;
  composite_score: number;
  data_confidence: number;
  sub_scores: Record<string, number>;
  scope_penalty: number;
  narrative: string;
  top_risks: string[];
  recommended_actions: string[];
  trend_vs_last_week: string;
  parse_warnings: string[];
  reasoning_trace: Array<{ step?: string; tool?: string; observation?: string; [k: string]: any }>;
}

export interface ScoreBreakdown {
  project_id: string;
  snapshot_id: number;
  rag_status: string;
  composite_score: number;
  data_confidence: number;
  sub_scores: Record<string, number>;
  scope_penalty: number;
  breakdown: Record<
    string,
    { score: number; available: boolean; weight: number; adjusted_weight: number; reason: string }
  >;
  override_reasons: string[];
}

export interface Alert {
  id: number;
  project_id: string;
  snapshot_id: number | null;
  alert_type: string;
  message: string;
  created_at: string;
  acknowledged: boolean;
}
