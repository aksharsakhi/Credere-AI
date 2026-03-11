// ── Module 1 Types ──────────────────────────────────────────────────────────

export interface Document {
  document_id: string
  filename: string
  category: string
  page_count?: number
  extraction_status: string
}

export interface FinancialData {
  company_name?: string
  fiscal_year?: string
  revenue?: number
  profit?: number
  total_debt?: number
  total_assets?: number
  total_liabilities?: number
  cash_flow?: number
  equity?: number
  interest_expense?: number
  ebit?: number
  current_assets?: number
  current_liabilities?: number
  gst_revenue?: number
  bank_inflow?: number
  bank_outflow?: number
  source_document?: string
}

export interface RatioData {
  ratio_name: string
  value: number | null
  health: 'healthy' | 'warning' | 'critical'
  formula: string
  interpretation: string
}

export interface FinancialRatios {
  debt_to_equity?: RatioData
  interest_coverage?: RatioData
  current_ratio?: RatioData
  profit_margin?: RatioData
  revenue_growth?: RatioData
  overall_health: string
  financial_summary?: string
}

export interface CrossVerification {
  gst_revenue?: number
  bank_inflow?: number
  deviation_percentage?: number
  risk_summary?: string
  alerts?: Alert[]
}

export interface Alert {
  severity: 'low' | 'medium' | 'high' | 'critical'
  alert_type: string
  description: string
  recommendation?: string
}

export interface TrendData {
  metric_name: string
  trend_direction: 'increasing' | 'decreasing' | 'stable'
  average_growth: number | null
  data_points: Array<{ year: string; value: number }>
  chart_base64?: string
}

export interface FinancialTable {
  table_name?: string
  headers: string[]
  rows: Record<string, string>[]
}

export interface CompletenessReport {
  completeness_percentage: number
  can_proceed_with_analysis: boolean
  suggestions: string[]
}

export interface ExtractionResult {
  document_id?: string
  filename?: string
  category?: string
  financial_data?: FinancialData
  confidence_score?: number
  tables?: FinancialTable[]
}

export interface FullAnalysis {
  company_name?: string
  overall_risk_level: 'low' | 'medium' | 'high' | 'critical'
  consolidated_financials?: FinancialData
  financial_ratios?: FinancialRatios
  cross_verification?: CrossVerification
  risk_alerts?: Alert[]
  trends?: TrendData[]
  tables?: FinancialTable[]
  completeness?: CompletenessReport
}

// ── Module 2 Types ──────────────────────────────────────────────────────────

export interface ResearchInput {
  company_name: string
  promoters?: string
  directors?: string
  industry?: string
  location?: string
  manual_observations?: string
  financial_context?: string
}

export interface RiskScores {
  overall_external_risk: number
  news_risk: number
  legal_risk: number
  industry_risk: number
  promoter_risk: number
  operational_risk: number
}

export interface RiskSummary {
  overall_assessment: string
  news_risk_level: string
  legal_risk_level: string
  industry_risk_level: string
  promoter_risk_level: string
  operational_risk_level: string
  key_concerns: string[]
  positive_factors: string[]
}

export interface CompanyProfile {
  description: string
  year_established?: string
  employee_count_estimate?: string
  annual_revenue_estimate?: string
  business_areas?: string[]
}

export interface NewsItem {
  headline: string
  source: string
  date: string
  summary: string
  sentiment: 'positive' | 'negative' | 'neutral'
  impact: 'high' | 'medium' | 'low'
  risk_category: string
}

export interface LitigationRecord {
  case_type: string
  court: string
  date_filed: string
  status: string
  severity: 'high' | 'medium' | 'low'
  parties?: string
  claim_amount?: string
  summary: string
}

export interface NetworkEntity {
  entity_name: string
  entity_type: 'person' | 'company'
  relationship: string
  connection_to: string
  status: string
  risk_flag: boolean
  details: string
}

export interface DirectorInfo {
  name: string
  din: string
  designation: string
  appointment_date: string
  other_directorships?: Array<{ company_name: string; status: string }>
}

export interface CorporateRegistry {
  registration_number?: string
  date_of_incorporation?: string
  authorized_capital?: string
  paid_up_capital?: string
  directors: DirectorInfo[]
  compliance_status?: {
    annual_returns_filed: boolean
    financial_statements_filed: boolean
    any_defaults: boolean
  }
}

export interface IndustryAnalysis {
  sector: string
  growth_rate?: string
  market_size?: string
  outlook: 'positive' | 'neutral' | 'negative'
  regulatory_environment?: string
  key_trends?: string[]
  risks?: string[]
  opportunities?: string[]
}

export interface RiskSignal {
  signal: string
  category: string
  severity: 'high' | 'medium' | 'low'
  evidence: string
  recommendation: string
}

export interface FinancialMetrics {
  revenue_cr?: number | null
  net_profit_cr?: number | null
  total_debt_cr?: number | null
  total_assets_cr?: number | null
  equity_cr?: number | null
  interest_expense_cr?: number | null
  operating_cash_flow_cr?: number | null
  current_assets_cr?: number | null
  current_liabilities_cr?: number | null
  data_quality?: string
}

export interface ResearchResult {
  company_name: string
  risk_scores?: RiskScores
  risk_summary?: RiskSummary
  company_profile?: CompanyProfile
  news_intelligence?: NewsItem[]
  litigation_records?: LitigationRecord[]
  corporate_registry?: CorporateRegistry
  industry_analysis?: IndustryAnalysis
  promoter_network?: NetworkEntity[]
  risk_signals?: RiskSignal[]
  financial_metrics?: FinancialMetrics
  alerts?: string[]
}

export interface CompanySearchData {
  company_name: string
  industry: string
  location: string
  promoters: string[]
  directors: string[]
  summary: string
}

// ── Module 3 Types ──────────────────────────────────────────────────────────

export interface Module3FinancialInput {
  revenue: number
  net_profit: number
  total_debt: number
  total_assets: number
  equity: number
  interest_expense: number
  cash_flow: number
  current_assets: number
  current_liabilities: number
}

export interface Module3ExternalRiskInput {
  litigation_cases: number
  negative_news_score: number
  sector_risk_score: number
  promoter_risk_score: number
}

export interface Module3OperationalInput {
  factory_utilization: number
  management_rating: number
}

export interface Module3FactorImpact {
  factor: string
  raw_score: number
  weight: number
  weighted_contribution: number
}

export interface Module3ScoreData {
  financial_strength_score: number
  cash_flow_score: number
  legal_risk_score: number
  industry_risk_score: number
  promoter_score: number
  operational_score: number
  final_risk_score: number
  risk_category: 'Low' | 'Medium' | 'High'
  explanation: string[]
  contribution_breakdown: Record<string, number>
  explainable_score_impact: Module3FactorImpact[]
  intermediate_metrics?: Record<string, Record<string, number | null>>
}

export interface Module3ScoreResponse {
  success: boolean
  message: string
  data: Module3ScoreData
}

// ── Shared ──────────────────────────────────────────────────────────────────

export interface Toast {
  id: string
  message: string
  type: 'success' | 'error' | 'warning' | 'info'
}
