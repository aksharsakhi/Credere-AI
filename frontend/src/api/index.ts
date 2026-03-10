import type {
  Document, FullAnalysis, CompletenessReport, ExtractionResult,
  ResearchInput, ResearchResult,
  CompanySearchData,
  Module3FinancialInput, Module3ExternalRiskInput,
  Module3OperationalInput, Module3ScoreResponse,
} from '../types'

async function req<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const res = await fetch(endpoint, options)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { detail?: string }).detail || `HTTP ${res.status}`)
  }
  return res.json()
}

export const api = {
  // ── Module 1 ─────────────────────────────────────────────────────────────
  health: () =>
    req<{ status: string; gemini_configured: boolean }>('/api/health'),

  uploadDocument: (file: File, category: string) => {
    const form = new FormData()
    form.append('file', file)
    form.append('category', category)
    return req<ExtractionResult>('/api/upload', { method: 'POST', body: form })
  },

  getDocuments: () =>
    req<{ data: Document[] }>('/api/documents'),

  deleteDocument: (id: string) =>
    req<void>(`/api/documents/${id}`, { method: 'DELETE' }),

  getCompleteness: () =>
    req<{ report: CompletenessReport }>('/api/completeness'),

  runFullAnalysis: () =>
    req<FullAnalysis>('/api/analysis/full'),

  getConsolidated: () =>
    req<{ data: Record<string, unknown> }>('/api/consolidated'),

  resetModule1: () =>
    req<void>('/api/reset', { method: 'POST' }),

  // ── Module 2 ─────────────────────────────────────────────────────────────
  m2Health: () =>
    req<{ status: string; gemini_configured: boolean }>('/api/module2/health'),

  m2Research: (input: ResearchInput) =>
    req<{ success: boolean; message: string; data: ResearchResult }>(
      '/api/module2/research',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      },
    ),

  m2LastResult: () =>
    req<{ success: boolean; data?: ResearchResult }>('/api/module2/last-result'),

  m2Reset: () =>
    req<void>('/api/module2/reset', { method: 'POST' }),

  m2SearchCompany: (companyName: string) =>
    req<{ success: boolean; message: string; data: CompanySearchData }>(
      '/api/module2/search-company',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_name: companyName }),
      },
    ),

  // ── Module 3 ─────────────────────────────────────────────────────────────
  m3Health: () =>
    req<{ status: string; module: string }>('/api/module3/health'),

  m3Score: (
    financial_data: Module3FinancialInput,
    external_risk_data: Module3ExternalRiskInput,
    operational_data: Module3OperationalInput,
  ) =>
    req<Module3ScoreResponse>('/api/module3/score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ financial_data, external_risk_data, operational_data }),
    }),

  m3StressRevenueDrop: (
    drop_percent: number,
    financial_data: Module3FinancialInput,
    external_risk_data: Module3ExternalRiskInput,
    operational_data: Module3OperationalInput,
  ) =>
    req<Module3ScoreResponse>('/api/module3/stress/revenue-drop', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        drop_percent,
        financial_data,
        external_risk_data,
        operational_data,
      }),
    }),
}
