import { useEffect, useState } from 'react'
import {
  AlertTriangle,
  BarChart3,
  RefreshCw,
  Activity,
  Gauge,
  LineChart,
  TrendingDown,
  TrendingUp,
  Download,
  Sparkles,
  ShieldAlert,
  Target,
} from 'lucide-react'
import { api } from '../../api'
import { useAppStore } from '../../store'
import { downloadDocReport, downloadPdfReport } from '../../utils/exportUtils'
import type {
  Module3ExternalRiskInput,
  Module3FinancialInput,
  Module3OperationalInput,
} from '../../types'

type SavedScenario = {
  id: string
  name: string
  financial: Module3FinancialInput
  external: Module3ExternalRiskInput
  operational: Module3OperationalInput
}

const FINANCIAL_FIELDS: Array<{ key: keyof Module3FinancialInput; label: string }> = [
  { key: 'revenue', label: 'Revenue (Cr)' },
  { key: 'net_profit', label: 'Net Profit (Cr)' },
  { key: 'total_debt', label: 'Total Debt (Cr)' },
  { key: 'total_assets', label: 'Total Assets (Cr)' },
  { key: 'equity', label: 'Equity (Cr)' },
  { key: 'interest_expense', label: 'Interest Expense (Cr)' },
  { key: 'cash_flow', label: 'Operating Cash Flow (Cr)' },
  { key: 'current_assets', label: 'Current Assets (Cr)' },
  { key: 'current_liabilities', label: 'Current Liabilities (Cr)' },
]

const EXTERNAL_FIELDS: Array<{ key: keyof Module3ExternalRiskInput; label: string }> = [
  { key: 'litigation_cases', label: 'Litigation Cases' },
  { key: 'negative_news_score', label: 'Negative News Score (0-100)' },
  { key: 'sector_risk_score', label: 'Sector Risk Score (0-100)' },
  { key: 'promoter_risk_score', label: 'Promoter Risk Score (0-100)' },
]

const OPS_FIELDS: Array<{ key: keyof Module3OperationalInput; label: string }> = [
  { key: 'factory_utilization', label: 'Factory Utilization (%)' },
  { key: 'management_rating', label: 'Management Rating (0-100)' },
]

const M3_TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'factors', label: 'Factors' },
  { id: 'scenarios', label: 'Scenarios' },
  { id: 'metrics', label: 'Metrics' },
  { id: 'recommendations', label: 'Recommendations' },
] as const

const FACTOR_META = [
  { key: 'financial_strength_score', label: 'Financial Strength', accent: 'from-cyan-400 to-blue-500' },
  { key: 'cash_flow_score', label: 'Cash Flow', accent: 'from-emerald-400 to-teal-500' },
  { key: 'legal_risk_score', label: 'Legal', accent: 'from-rose-400 to-orange-500' },
  { key: 'industry_risk_score', label: 'Industry', accent: 'from-violet-400 to-fuchsia-500' },
  { key: 'promoter_score', label: 'Promoter', accent: 'from-amber-400 to-yellow-500' },
  { key: 'operational_score', label: 'Operational', accent: 'from-sky-400 to-cyan-500' },
] as const

function scoreTone(score: number) {
  if (score >= 80) {
    return {
      text: 'text-emerald-300',
      chip: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
      bar: 'linear-gradient(90deg,#34d399,#22c55e)',
      label: 'Strong',
    }
  }
  if (score >= 60) {
    return {
      text: 'text-amber-300',
      chip: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
      bar: 'linear-gradient(90deg,#fbbf24,#f97316)',
      label: 'Watch',
    }
  }
  return {
    text: 'text-rose-300',
    chip: 'bg-rose-500/10 text-rose-300 border-rose-500/20',
    bar: 'linear-gradient(90deg,#fb7185,#ef4444)',
    label: 'Weak',
  }
}

function formatFactorName(value: string) {
  return value.replace(/_score$/i, '').replace(/_/g, ' ')
}

function formatMetricName(value: string) {
  return value.replace(/_/g, ' ')
}

function formatMetricValue(value: number | null) {
  if (value == null || Number.isNaN(value)) return 'N/A'
  if (Math.abs(value) >= 1000) return value.toLocaleString(undefined, { maximumFractionDigits: 0 })
  if (Math.abs(value) >= 100) return value.toFixed(1)
  if (Math.abs(value) >= 1) return value.toFixed(2)
  return value.toFixed(3)
}

function metricStrength(value: number | null) {
  if (value == null || Number.isNaN(value)) return 0
  const abs = Math.abs(value)
  if (abs <= 1) return Math.min(100, abs * 100)
  if (abs <= 10) return Math.min(100, abs * 10)
  return Math.min(100, abs)
}

function chartPath(points: Array<{ x: number; y: number }>) {
  return points.map((point) => `${point.x},${point.y}`).join(' ')
}

function num(v: string) {
  const parsed = Number(v)
  return Number.isFinite(parsed) ? parsed : 0
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const cleaned = value.replace(/[^0-9.-]/g, '')
    const parsed = Number(cleaned)
    return Number.isFinite(parsed) ? parsed : undefined
  }
  return undefined
}

function normalizedMap(source: Record<string, unknown> | undefined) {
  if (!source) return {}
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(source)) {
    out[k.toLowerCase().replace(/[^a-z0-9]+/g, '_')] = v
  }
  return out
}

function pickNumber(source: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const v = asNumber(source[key])
    if (v != null) return v
  }
  return undefined
}

export default function Module3() {
  const {
    m1Analysis,
    m1LastExtraction,
    m2Research,
    m3Result,
    setM3Result,
    setM2Research,
    addToast,
  } = useAppStore()

  const [apiOnline, setApiOnline] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(false)
  const [stressLoading, setStressLoading] = useState(false)
  const [curveLoading, setCurveLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<(typeof M3_TABS)[number]['id']>('overview')
  const [stressDrop, setStressDrop] = useState('20')
  const [stressScore, setStressScore] = useState<number | null>(null)
  const [stressCurve, setStressCurve] = useState<Array<{ drop: number; score: number }>>([])
  const [scenarioName, setScenarioName] = useState('')
  const [savedScenarios, setSavedScenarios] = useState<SavedScenario[]>([])

  const [financial, setFinancial] = useState<Module3FinancialInput>({
    revenue: 0,
    net_profit: 0,
    total_debt: 0,
    total_assets: 0,
    equity: 0,
    interest_expense: 0,
    cash_flow: 0,
    current_assets: 0,
    current_liabilities: 0,
  })

  const [externalRisk, setExternalRisk] = useState<Module3ExternalRiskInput>({
    litigation_cases: 0,
    negative_news_score: 40,
    sector_risk_score: 50,
    promoter_risk_score: 50,
  })

  const [operational, setOperational] = useState<Module3OperationalInput>({
    factory_utilization: 70,
    management_rating: 70,
  })

  useEffect(() => {
    api.m3Health()
      .then(() => setApiOnline(true))
      .catch(() => setApiOnline(false))
  }, [])

  async function runScoreWithInputs(
    financialInput: Module3FinancialInput,
    externalInput: Module3ExternalRiskInput,
    operationalInput: Module3OperationalInput,
  ) {
    setLoading(true)
    try {
      const res = await api.m3Score(
        financialInput,
        externalInput,
        operationalInput,
      )
      setM3Result(res.data)
      setActiveTab('overview')
      setStressScore(null)
      addToast('Module 3 risk score computed', 'success')
    } catch (e: unknown) {
      addToast(`Risk scoring failed: ${(e as Error).message}`, 'error')
    } finally {
      setLoading(false)
    }
  }

  async function importFromOtherModules(autoRun = false) {
    let cf = m1Analysis?.consolidated_financials
    let research = m2Research

    // Module 1 fallback: use last extraction if full analysis isn't available.
    if (!cf && m1LastExtraction?.financial_data) {
      cf = m1LastExtraction.financial_data
    }

    // Module 1 fallback: fetch consolidated data from backend.
    if (!cf) {
      try {
        const consolidated = await api.getConsolidated()
        cf = consolidated.data as Record<string, unknown>
      } catch {
        // Keep silent and continue with available sources.
      }
    }

    // Module 2 fallback: pull last backend result when store is empty.
    if (!research) {
      try {
        const last = await api.m2LastResult()
        if (last?.success && last.data) {
          research = last.data
          setM2Research(last.data)
        }
      } catch {
        // Keep silent and continue with available sources.
      }
    }

    if (!cf && !research) {
      addToast(
        'No Module 1/2 data found. Upload/process in Module 1 or run Module 2 first.',
        'warning',
      )
      return
    }

    const rs = research?.risk_scores
    const fm = research?.financial_metrics
    const cfObj = normalizedMap(cf as Record<string, unknown> | undefined)

    // Helper: prefer Module 1 extracted value, fall back to Module 2 estimated
    const m2Val = (v: number | null | undefined) =>
      v != null ? v : undefined

    const importedRevenue =
      pickNumber(cfObj, ['revenue', 'gst_revenue', 'bank_inflow', 'turnover'])
      ?? m2Val(fm?.revenue_cr)

    const importedNetProfit =
      pickNumber(cfObj, ['net_profit', 'profit', 'pat', 'ebit'])
      ?? m2Val(fm?.net_profit_cr)

    const importedTotalDebt =
      pickNumber(cfObj, ['total_debt', 'borrowings', 'total_liabilities'])
      ?? m2Val(fm?.total_debt_cr)

    const importedTotalAssets =
      pickNumber(cfObj, ['total_assets', 'assets'])
      ?? m2Val(fm?.total_assets_cr)

    const importedEquity =
      pickNumber(cfObj, ['equity', 'shareholders_equity', 'net_worth'])
      ?? m2Val(fm?.equity_cr)

    const importedInterestExpense =
      pickNumber(cfObj, ['interest_expense', 'finance_cost'])
      ?? m2Val(fm?.interest_expense_cr)

    const importedCurrentAssets =
      pickNumber(cfObj, ['current_assets'])
      ?? m2Val(fm?.current_assets_cr)

    const importedCurrentLiabilities =
      pickNumber(cfObj, ['current_liabilities'])
      ?? m2Val(fm?.current_liabilities_cr)

    const bankInflow = pickNumber(cfObj, ['bank_inflow'])
    const bankOutflow = pickNumber(cfObj, ['bank_outflow'])

    const importedCashFlow =
      pickNumber(cfObj, ['cash_flow', 'operating_cash_flow'])
      ?? m2Val(fm?.operating_cash_flow_cr)
      ?? (
        bankInflow != null && bankOutflow != null
          ? bankInflow - bankOutflow
          : undefined
      )
    const importedFrom: string[] = []
    let importedFields = 0

    if (cf) importedFrom.push('Module 1')
    if (research) importedFrom.push('Module 2')

    const nextFinancial: Module3FinancialInput = {
      ...financial,
      revenue: importedRevenue ?? financial.revenue,
      net_profit: importedNetProfit ?? financial.net_profit,
      total_debt: importedTotalDebt ?? financial.total_debt,
      total_assets: importedTotalAssets ?? financial.total_assets,
      equity: importedEquity ?? financial.equity,
      interest_expense: importedInterestExpense ?? financial.interest_expense,
      cash_flow: importedCashFlow ?? financial.cash_flow,
      current_assets: importedCurrentAssets ?? financial.current_assets,
      current_liabilities: importedCurrentLiabilities ?? financial.current_liabilities,
    }
    importedFields += [
      importedRevenue,
      importedNetProfit,
      importedTotalDebt,
      importedTotalAssets,
      importedEquity,
      importedInterestExpense,
      importedCashFlow,
      importedCurrentAssets,
      importedCurrentLiabilities,
    ].filter((v) => v != null).length

    const nextExternalRisk: Module3ExternalRiskInput = {
      ...externalRisk,
      litigation_cases:
        research?.litigation_records?.length ?? externalRisk.litigation_cases,
      negative_news_score: rs?.news_risk != null
        ? clamp(rs.news_risk, 0, 100)
        : externalRisk.negative_news_score,
      sector_risk_score: rs?.industry_risk != null
        ? clamp(rs.industry_risk, 0, 100)
        : externalRisk.sector_risk_score,
      promoter_risk_score: rs?.promoter_risk != null
        ? clamp(rs.promoter_risk, 0, 100)
        : externalRisk.promoter_risk_score,
    }
    importedFields += [
      research?.litigation_records?.length,
      rs?.news_risk,
      rs?.industry_risk,
      rs?.promoter_risk,
    ].filter((v) => v != null).length

    const nextOperational: Module3OperationalInput = {
      ...operational,
      management_rating: rs?.operational_risk != null
        ? clamp(100 - rs.operational_risk, 0, 100)
        : operational.management_rating,
    }
    if (rs?.operational_risk != null) importedFields += 1

    setFinancial(nextFinancial)
    setExternalRisk(nextExternalRisk)
    setOperational(nextOperational)

    if (importedFields === 0) {
      addToast('No usable fields found in Module 1/2 outputs yet.', 'warning')
      return
    }

    addToast(
      `Imported ${importedFields} field(s) from ${importedFrom.join(' + ')}`,
      'success',
    )

    if (autoRun) {
      void runScoreWithInputs(nextFinancial, nextExternalRisk, nextOperational)
    }
  }

  async function runScore() {
    await runScoreWithInputs(financial, externalRisk, operational)
  }

  async function runStress() {
    setStressLoading(true)
    try {
      const res = await api.m3StressRevenueDrop(num(stressDrop), financial, externalRisk, operational)
      setStressScore(res.data.final_risk_score)
      addToast('Stress simulation completed', 'info')
    } catch (e: unknown) {
      addToast(`Stress simulation failed: ${(e as Error).message}`, 'error')
    } finally {
      setStressLoading(false)
    }
  }

  async function runStressCurve() {
    setCurveLoading(true)
    try {
      const drops = [0, 10, 20, 30, 40, 50]
      const points: Array<{ drop: number; score: number }> = []
      for (const drop of drops) {
        const res = await api.m3StressRevenueDrop(
          drop,
          financial,
          externalRisk,
          operational,
        )
        points.push({ drop, score: res.data.final_risk_score })
      }
      setStressCurve(points)
      addToast('Stress curve generated', 'success')
    } catch (e: unknown) {
      addToast(`Stress curve failed: ${(e as Error).message}`, 'error')
    } finally {
      setCurveLoading(false)
    }
  }

  const score = m3Result?.final_risk_score ?? 0
  const hasM1Data = Boolean(m1Analysis || m1LastExtraction)
  const hasM2Data = Boolean(m2Research)
  const riskColor = m3Result?.risk_category === 'Low'
    ? 'text-emerald-400'
    : m3Result?.risk_category === 'Medium'
      ? 'text-amber-400'
      : 'text-red-400'
  const filledInputs = [
    ...Object.values(financial),
    ...Object.values(externalRisk),
    ...Object.values(operational),
  ].filter((v) => Number(v) > 0).length
  const totalInputs =
    Object.keys(financial).length
    + Object.keys(externalRisk).length
    + Object.keys(operational).length
  const inputFillPct = Math.round((filledInputs / totalInputs) * 100)
  const topDrivers = (m3Result?.explanation || [])
    .slice(0, 5)
  const metrics = m3Result?.intermediate_metrics
  const factorCards = m3Result
    ? FACTOR_META.map((item) => ({
        ...item,
        score: m3Result[item.key],
        tone: scoreTone(m3Result[item.key]),
      })).sort((a, b) => b.score - a.score)
    : []
  const strongestFactor = factorCards[0]
  const weakestFactor = factorCards[factorCards.length - 1]
  const totalContribution = m3Result
    ? Math.max(
        1,
        m3Result.explainable_score_impact.reduce(
          (sum, row) => sum + row.weighted_contribution,
          0,
        ),
      )
    : 1
  const stressBasePoint = stressCurve[0]
  const stressWorstPoint = stressCurve.length
    ? stressCurve.reduce((worst, point) => (point.score < worst.score ? point : worst), stressCurve[0])
    : null
  const scenarioShift = stressScore != null ? stressScore - score : null
  const overviewPulse = m3Result
    ? [
        { label: 'Best factor', value: strongestFactor?.label ?? 'N/A', hint: strongestFactor ? `${strongestFactor.score}/100` : 'No score' },
        { label: 'Weakest factor', value: weakestFactor?.label ?? 'N/A', hint: weakestFactor ? `${weakestFactor.score}/100` : 'No score' },
        { label: 'Data readiness', value: `${inputFillPct}%`, hint: `${filledInputs}/${totalInputs} inputs populated` },
      ]
    : []
  const stressChartPoints = stressCurve.map((point) => ({
    ...point,
    x: 12 + (point.drop / 50) * 296,
    y: 132 - (point.score / 100) * 104,
  }))
  const stressLine = chartPath(stressChartPoints.map(({ x, y }) => ({ x, y })))
  const stressArea = stressChartPoints.length
    ? `${stressLine} 308,132 12,132`
    : ''
  const priorityRecommendations = factorCards
    .filter((item) => item.score < 65)
    .slice(0, 3)
    .map((item) => {
      switch (item.key) {
        case 'financial_strength_score':
          return 'Rework leverage and equity assumptions before taking a sanction call.'
        case 'cash_flow_score':
          return 'Tighten receivables conversion and repayment coverage planning.'
        case 'legal_risk_score':
          return 'Review litigation exposure and attach legal mitigants or carve-outs.'
        case 'industry_risk_score':
          return 'Layer downside assumptions on sector demand and pricing resilience.'
        case 'promoter_score':
          return 'Increase promoter diligence and cross-check connected-party behaviour.'
        default:
          return 'Strengthen operating controls and execution discipline before expansion.'
      }
    })
  const recommendationBuckets = m3Result
    ? {
        immediate: priorityRecommendations.length
          ? priorityRecommendations
          : ['No immediate red flag is dominating the score. Proceed with routine diligence.'],
        monitor: topDrivers.length
          ? topDrivers.slice(0, 3)
          : ['Model explanations are limited until more data is provided.'],
        strengths: factorCards
          .filter((item) => item.score >= 75)
          .slice(0, 3)
          .map((item) => `${item.label} is currently supporting the case at ${item.score}/100.`),
      }
    : null
  const recommendations = m3Result
    ? [
      m3Result.financial_strength_score < 60
        ? 'Strengthen balance sheet: improve equity cushion and reduce leverage.'
        : 'Financial strength is acceptable under current assumptions.',
      m3Result.cash_flow_score < 60
        ? 'Prioritize operating cash flow stability and receivables control.'
        : 'Cash flow profile appears resilient for near-term obligations.',
      m3Result.legal_risk_score < 60
        ? 'Review ongoing disputes and create legal risk mitigation plan.'
        : 'Legal risk signals are currently manageable.',
      m3Result.operational_score < 60
        ? 'Operational controls should be tightened before aggressive growth.'
        : 'Operational execution looks steady with current inputs.',
      m3Result.risk_category === 'High'
        ? 'Escalate case for enhanced due diligence and tighter sanction terms.'
        : 'Proceed with standard underwriting checks and periodic monitoring.',
    ]
    : []

  function saveCurrentScenario() {
    const name = scenarioName.trim() || `Scenario ${savedScenarios.length + 1}`
    const scenario: SavedScenario = {
      id: `${Date.now()}`,
      name,
      financial,
      external: externalRisk,
      operational,
    }
    setSavedScenarios((prev) => [scenario, ...prev].slice(0, 8))
    setScenarioName('')
    addToast(`Saved ${name}`, 'success')
  }

  function loadScenario(scenario: SavedScenario) {
    setFinancial(scenario.financial)
    setExternalRisk(scenario.external)
    setOperational(scenario.operational)
    addToast(`Loaded ${scenario.name}`, 'info')
  }

  function buildModule3Sections() {
    return [
      {
        heading: 'Input Snapshot',
        content: {
          financial,
          externalRisk,
          operational,
          stressDrop,
        },
      },
      {
        heading: 'Scoring Result',
        content: m3Result,
      },
      {
        heading: 'Stress Result',
        content: stressScore == null ? 'Not run' : {
          drop_percent: Number(stressDrop),
          final_risk_score: stressScore,
        },
      },
    ]
  }

  function handleDownloadDoc() {
    if (!m3Result) {
      addToast('Compute Module 3 score before downloading report.', 'warning')
      return
    }
    downloadDocReport('Module 3 Risk Report', buildModule3Sections(), 'module3-risk')
    addToast('Module 3 DOC downloaded', 'success')
  }

  function handleDownloadPdf() {
    if (!m3Result) {
      addToast('Compute Module 3 score before downloading report.', 'warning')
      return
    }
    downloadPdfReport('Module 3 Risk Report', buildModule3Sections(), 'module3-risk')
    addToast('Module 3 PDF downloaded', 'success')
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <header className="flex-shrink-0 flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-3.5 border-b border-[#1e293b]"
        style={{ background: 'rgba(7,9,18,0.85)', backdropFilter: 'blur(12px)' }}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
            <BarChart3 size={15} className="text-cyan-400" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-200">Module 3 - Financial Intelligence Engine</h1>
            <p className="text-[10px] text-slate-500">Weighted Credit Risk Scoring</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className={`text-[10px] px-3 py-1.5 rounded-full border ${apiOnline ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-400' : 'border-red-500/20 bg-red-500/5 text-red-400'}`}>
            {apiOnline ? 'Module 3 Online' : 'Module 3 Offline'}
          </div>
          <button
            onClick={handleDownloadDoc}
            disabled={!m3Result}
            className="flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-cyan-300 bg-[#111827] border border-[#1e293b] hover:border-cyan-500/30 px-3 py-1.5 rounded-lg transition-all disabled:opacity-40"
          >
            <Download size={12} /> DOC
          </button>
          <button
            onClick={handleDownloadPdf}
            disabled={!m3Result}
            className="flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-cyan-300 bg-[#111827] border border-[#1e293b] hover:border-cyan-500/30 px-3 py-1.5 rounded-lg transition-all disabled:opacity-40"
          >
            <Download size={12} /> PDF
          </button>
        </div>
      </header>

      <div className="flex flex-1 flex-col lg:flex-row overflow-hidden">
        <aside className="w-full lg:w-[360px] xl:w-[380px] flex-shrink-0 border-b lg:border-b-0 lg:border-r border-[#1e293b] p-4 overflow-y-auto" style={{ background: '#070912' }}>
          <div className="mb-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="text-[10px] text-slate-400 uppercase tracking-widest">Input Quality</div>
              <div className="text-[11px] text-amber-300">{filledInputs}/{totalInputs}</div>
            </div>
            <div className="h-2 rounded-full bg-[#111827] border border-[#1e293b] overflow-hidden">
              <div
                className="h-full"
                style={{ width: `${inputFillPct}%`, background: 'linear-gradient(90deg,#f59e0b,#22c55e)' }}
              />
            </div>
            <p className="mt-2 text-[11px] text-slate-500">{inputFillPct}% fields populated for scoring.</p>
          </div>

          <div className="mb-4 rounded-xl border border-[#1e293b] bg-[#0d1325] p-3">
            <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-2">Saved Scenarios (Real Inputs)</div>
            <div className="flex gap-2 mb-2">
              <input
                value={scenarioName}
                onChange={(e) => setScenarioName(e.target.value)}
                placeholder="Scenario name"
                className="flex-1 bg-[#111827] border border-[#1e293b] text-slate-300 text-xs rounded-lg px-2.5 py-2"
              />
              <button
                onClick={saveCurrentScenario}
                className="px-3 py-2 text-xs font-semibold text-cyan-200 bg-cyan-600/20 border border-cyan-500/30 rounded-lg"
              >
                Save
              </button>
            </div>
            <div className="space-y-2 max-h-28 overflow-y-auto pr-1">
              {savedScenarios.length === 0 ? (
                <div className="text-[11px] text-slate-500">No saved scenarios yet.</div>
              ) : savedScenarios.map((scenario) => (
                <button
                  key={scenario.id}
                  onClick={() => loadScenario(scenario)}
                  className="w-full text-left text-[11px] px-2.5 py-2 rounded-lg border border-[#1e293b] text-slate-300 hover:text-white hover:border-cyan-500/40 hover:bg-cyan-500/10"
                >
                  {scenario.name}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-4 rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-3">
            <button
              onClick={() => void importFromOtherModules(false)}
              className="w-full text-xs font-semibold text-cyan-300 bg-cyan-500/10 border border-cyan-500/20 px-3 py-2.5 rounded-xl"
            >
              Import Inputs from Module 1 + 2
            </button>
            <button
              onClick={() => void importFromOtherModules(true)}
              className="w-full mt-2 text-xs font-semibold text-white bg-cyan-600/80 border border-cyan-500/30 px-3 py-2.5 rounded-xl"
            >
              Import + Auto Score
            </button>
            <div className="mt-2 text-[11px] text-slate-400">
              Module 1: {hasM1Data ? 'available' : 'missing'} | Module 2: {hasM2Data ? 'available' : 'missing'}
            </div>
          </div>

          <div className="mb-4 rounded-xl border border-[#1e293b] bg-[#0d1325] p-3">
            <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-2">Financial Inputs</div>
            <div className="grid grid-cols-1 gap-2">
              {FINANCIAL_FIELDS.map(({ key, label }) => (
                <label key={key} className="text-[10px] text-slate-400">
                  <div className="mb-1">{label}</div>
                  <input
                    type="number"
                    value={String(financial[key])}
                    onChange={(e) => setFinancial((prev) => ({ ...prev, [key]: num(e.target.value) }))}
                    className="w-full bg-[#111827] border border-[#1e293b] text-slate-300 text-xs rounded-lg px-2.5 py-2"
                  />
                </label>
              ))}
            </div>
          </div>

          <div className="mb-4 rounded-xl border border-[#1e293b] bg-[#0d1325] p-3">
            <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-2">External Risk Inputs</div>
            <div className="grid grid-cols-1 gap-2">
              {EXTERNAL_FIELDS.map(({ key, label }) => (
                <label key={key} className="text-[10px] text-slate-400">
                  <div className="mb-1">{label}</div>
                  <input
                    type="number"
                    value={String(externalRisk[key])}
                    onChange={(e) => setExternalRisk((prev) => ({ ...prev, [key]: num(e.target.value) }))}
                    className="w-full bg-[#111827] border border-[#1e293b] text-slate-300 text-xs rounded-lg px-2.5 py-2"
                  />
                </label>
              ))}
            </div>
          </div>

          <div className="mb-4 rounded-xl border border-[#1e293b] bg-[#0d1325] p-3">
            <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-2">Operational Inputs</div>
            <div className="grid grid-cols-1 gap-2">
              {OPS_FIELDS.map(({ key, label }) => (
                <label key={key} className="text-[10px] text-slate-400">
                  <div className="mb-1">{label}</div>
                  <input
                    type="number"
                    value={String(operational[key])}
                    onChange={(e) => setOperational((prev) => ({ ...prev, [key]: num(e.target.value) }))}
                    className="w-full bg-[#111827] border border-[#1e293b] text-slate-300 text-xs rounded-lg px-2.5 py-2"
                  />
                </label>
              ))}
            </div>
          </div>

          <button
            onClick={runScore}
            disabled={loading}
            className="w-full mb-2 text-sm font-semibold text-white py-2.5 rounded-lg disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg,#0891b2,#2563eb)' }}
          >
            {loading ? 'Computing...' : 'Compute Credit Risk'}
          </button>

          <div className="mt-3 rounded-xl border border-[#1e293b] bg-[#0d1325] p-3">
            <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-2">Stress Test</div>
            <div className="flex gap-2 items-center">
            <input
              value={stressDrop}
              onChange={(e) => setStressDrop(e.target.value)}
              className="flex-1 bg-[#111827] border border-[#1e293b] text-slate-300 text-xs rounded-lg px-2.5 py-2"
              placeholder="Revenue drop %"
            />
            <button
              onClick={runStress}
              disabled={stressLoading}
              className="px-3 py-2 text-xs font-semibold text-white bg-violet-600 rounded-lg disabled:opacity-50"
            >
              {stressLoading ? '...' : 'Stress'}
            </button>
            </div>
            <button
              onClick={runStressCurve}
              disabled={curveLoading}
              className="w-full mt-2 px-3 py-2 text-xs font-semibold text-cyan-200 bg-cyan-600/20 border border-cyan-500/30 rounded-lg disabled:opacity-50"
            >
              {curveLoading ? 'Generating curve...' : 'Generate Stress Curve (0-50%)'}
            </button>
          </div>
        </aside>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6" style={{ background: '#0a0e1a' }}>
          {!m3Result ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-slate-500">
              <Activity size={36} className="mb-3 text-slate-600" />
              <p className="text-sm">Run Module 3 risk scoring to view outputs</p>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
                {M3_TABS.map((tab) => {
                  const detail = tab.id === 'overview'
                    ? `${score}/100 current score`
                    : tab.id === 'factors'
                      ? `${factorCards.length} factor blocks`
                      : tab.id === 'scenarios'
                        ? `${stressCurve.length || 1} scenario views`
                        : tab.id === 'metrics'
                          ? `${metrics ? Object.keys(metrics).length : 0} metric groups`
                          : `${recommendations.length} guidance items`

                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`rounded-2xl border px-4 py-3 text-left transition-all ${
                        activeTab === tab.id
                          ? 'border-cyan-500/30 bg-cyan-500/10 shadow-[0_0_0_1px_rgba(34,211,238,0.12)]'
                          : 'border-[#1e293b] bg-[#0f172a] hover:border-cyan-500/20 hover:bg-[#111827]'
                      }`}
                    >
                      <div className={`text-xs font-semibold ${activeTab === tab.id ? 'text-cyan-300' : 'text-slate-200'}`}>{tab.label}</div>
                      <div className="mt-1 text-[11px] text-slate-500">{detail}</div>
                    </button>
                  )
                })}
              </div>

              {activeTab === 'overview' && (
                <>
                  <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
                    <div className="rounded-3xl border border-cyan-500/20 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.14),transparent_42%),linear-gradient(180deg,#0f172a,#0b1220)] p-5">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <div className="text-[10px] uppercase tracking-[0.25em] text-slate-500">Portfolio View</div>
                          <h2 className="mt-2 text-2xl font-bold text-slate-100">Credit posture is {m3Result.risk_category.toLowerCase()} risk</h2>
                          <p className="mt-2 max-w-xl text-sm text-slate-400">
                            {m3Result.risk_category === 'Low'
                              ? 'The blended model is supportive. Underwriting attention can move from red flags to validation of assumptions.'
                              : m3Result.risk_category === 'Medium'
                                ? 'The case is workable, but multiple factor blocks need guardrails before sanction comfort improves.'
                                : 'The model is signalling a fragile case. Further diligence or structural protection is needed before progressing.'}
                          </p>
                        </div>
                        <div className="flex h-36 w-36 items-center justify-center rounded-full border border-white/10 bg-[#0a1020]"
                          style={{
                            background: `conic-gradient(${score >= 80 ? '#22c55e' : score >= 60 ? '#f59e0b' : '#ef4444'} ${score * 3.6}deg, rgba(15,23,42,0.95) 0deg)`,
                          }}
                        >
                          <div className="flex h-24 w-24 flex-col items-center justify-center rounded-full bg-[#08101e] border border-white/10">
                            <div className={`text-4xl font-black ${riskColor}`}>{score}</div>
                            <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Score</div>
                          </div>
                        </div>
                      </div>

                      <div className="mt-5 grid gap-3 md:grid-cols-3">
                        {overviewPulse.map((item) => (
                          <div key={item.label} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                            <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">{item.label}</div>
                            <div className="mt-2 text-lg font-semibold text-slate-100">{item.value}</div>
                            <div className="mt-1 text-xs text-slate-500">{item.hint}</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="rounded-3xl border border-[#1e293b] bg-[#111827] p-4">
                        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.25em] text-slate-500">
                          <Gauge size={13} className="text-cyan-300" /> Decision Hint
                        </div>
                        <p className="mt-3 text-sm text-slate-300">
                          {m3Result.risk_category === 'Low'
                            ? 'Profile appears bankable on current inputs. Validate final underwriting assumptions and documentation quality.'
                            : m3Result.risk_category === 'Medium'
                              ? 'Use tighter covenants, collateral buffers, and monitoring triggers to absorb moderate downside.'
                              : 'Escalate the case for deeper diligence and consider tighter structuring before any credit approval.'}
                        </p>
                      </div>

                      <div className="rounded-3xl border border-[#1e293b] bg-[#111827] p-4">
                        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.25em] text-slate-500">
                          <RefreshCw size={13} className="text-slate-400" /> Actions
                        </div>
                        <button
                          onClick={() => {
                            setM3Result(null)
                            setStressScore(null)
                            setStressCurve([])
                          }}
                          className="mt-3 w-full rounded-xl border border-[#1e293b] px-3 py-2 text-sm text-slate-300 transition hover:border-rose-500/30 hover:text-rose-300"
                        >
                          Clear Results
                        </button>
                        {stressScore != null && (
                          <div className="mt-3 rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-200">
                            Stress run at {stressDrop}% revenue drop currently returns {stressScore}/100.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
                    <div className="rounded-3xl border border-[#1e293b] bg-[#111827] p-4">
                      <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.25em] text-slate-500">
                        <Target size={13} className="text-cyan-300" /> Factor Balance
                      </div>
                      <div className="mt-4 space-y-3">
                        {factorCards.map((item) => (
                          <div key={item.key}>
                            <div className="mb-1 flex items-center justify-between text-xs">
                              <span className="text-slate-300">{item.label}</span>
                              <span className={item.tone.text}>{item.score}/100</span>
                            </div>
                            <div className="h-2 overflow-hidden rounded-full bg-[#0a1120]">
                              <div className="h-full rounded-full" style={{ width: `${item.score}%`, background: item.tone.bar }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-3xl border border-[#1e293b] bg-[#111827] p-4">
                      <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.25em] text-slate-500">
                        <ShieldAlert size={13} className="text-amber-400" /> Top Risk Drivers
                      </div>
                      <div className="mt-4 space-y-2">
                        {topDrivers.length ? topDrivers.map((line, i) => (
                          <div key={i} className="rounded-2xl border border-white/5 bg-white/[0.02] px-3 py-2 text-sm text-slate-300">{line}</div>
                        )) : (
                          <div className="text-sm text-slate-500">No notable risk drivers yet.</div>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              )}

              {activeTab === 'factors' && (
                <>
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {factorCards.map((item, index) => (
                      <div key={item.key} className="rounded-3xl border border-[#1e293b] bg-[#111827] p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-[10px] uppercase tracking-[0.22em] text-slate-500">Rank {index + 1}</div>
                            <div className="mt-1 text-lg font-semibold text-slate-100">{item.label}</div>
                          </div>
                          <div className={`rounded-full border px-2.5 py-1 text-[10px] ${item.tone.chip}`}>{item.tone.label}</div>
                        </div>
                        <div className="mt-4 flex items-end justify-between">
                          <div className={`text-4xl font-black ${item.tone.text}`}>{item.score}</div>
                          <div className="text-xs text-slate-500">out of 100</div>
                        </div>
                        <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#0a1120]">
                          <div className="h-full rounded-full" style={{ width: `${item.score}%`, background: item.tone.bar }} />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
                    <div className="rounded-3xl border border-[#1e293b] bg-[#111827] p-4">
                      <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.25em] text-slate-500">
                        <BarChart3 size={13} className="text-cyan-300" /> Weighted Impact
                      </div>
                      <div className="mt-4 space-y-3">
                        {m3Result.explainable_score_impact.map((row) => {
                          const pct = (row.weighted_contribution / totalContribution) * 100
                          return (
                            <div key={row.factor} className="rounded-2xl border border-white/5 bg-white/[0.02] p-3">
                              <div className="flex items-center justify-between gap-3 text-xs">
                                <span className="text-slate-300">{formatFactorName(row.factor)}</span>
                                <span className="text-slate-400">{row.raw_score} × {row.weight} = {row.weighted_contribution}</span>
                              </div>
                              <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#0a1120]">
                                <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-blue-500" style={{ width: `${pct}%` }} />
                              </div>
                              <div className="mt-1 text-right text-[11px] text-slate-500">{pct.toFixed(1)}% of weighted score</div>
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    <div className="rounded-3xl border border-[#1e293b] bg-[#111827] p-4">
                      <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.25em] text-slate-500">
                        <AlertTriangle size={13} className="text-amber-300" /> Attention Split
                      </div>
                      <div className="mt-4 space-y-4">
                        <div>
                          <div className="text-xs font-semibold text-slate-300">Strongest</div>
                          <div className="mt-2 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-3">
                            <div className="text-sm font-semibold text-emerald-300">{strongestFactor?.label}</div>
                            <div className="mt-1 text-xs text-slate-400">Currently leading the blended score at {strongestFactor?.score ?? 0}/100.</div>
                          </div>
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-slate-300">Needs attention</div>
                          <div className="mt-2 rounded-2xl border border-rose-500/20 bg-rose-500/5 p-3">
                            <div className="text-sm font-semibold text-rose-300">{weakestFactor?.label}</div>
                            <div className="mt-1 text-xs text-slate-400">Weakest support block at {weakestFactor?.score ?? 0}/100. This is the first place to improve assumptions or mitigants.</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {activeTab === 'scenarios' && (
                <>
                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="rounded-3xl border border-[#1e293b] bg-[#111827] p-4">
                      <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Base score</div>
                      <div className={`mt-2 text-4xl font-black ${riskColor}`}>{score}</div>
                      <div className="mt-1 text-xs text-slate-500">Current underwriting posture</div>
                    </div>
                    <div className="rounded-3xl border border-[#1e293b] bg-[#111827] p-4">
                      <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Selected stress</div>
                      <div className="mt-2 text-4xl font-black text-amber-300">{stressScore ?? '--'}</div>
                      <div className="mt-1 text-xs text-slate-500">{stressDrop}% revenue drop scenario</div>
                    </div>
                    <div className="rounded-3xl border border-[#1e293b] bg-[#111827] p-4">
                      <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Downside shift</div>
                      <div className={`mt-2 text-4xl font-black ${scenarioShift == null ? 'text-slate-500' : scenarioShift >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{scenarioShift == null ? '--' : `${scenarioShift > 0 ? '+' : ''}${scenarioShift}`}</div>
                      <div className="mt-1 text-xs text-slate-500">Change from current score</div>
                    </div>
                  </div>

                  <div className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
                    <div className="rounded-3xl border border-[#1e293b] bg-[#111827] p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.25em] text-slate-500">
                            <LineChart size={13} className="text-cyan-300" /> Stress Curve
                          </div>
                          <div className="mt-1 text-sm text-slate-400">Revenue drop versus final credit score</div>
                        </div>
                        <button
                          onClick={runStressCurve}
                          disabled={curveLoading}
                          className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-200 disabled:opacity-50"
                        >
                          {curveLoading ? 'Refreshing...' : 'Refresh Curve'}
                        </button>
                      </div>

                      {stressCurve.length > 0 ? (
                        <>
                          <div className="mt-4 overflow-hidden rounded-2xl border border-white/5 bg-[#0a1120] p-3">
                            <svg viewBox="0 0 320 144" className="h-56 w-full">
                              <defs>
                                <linearGradient id="stressLine" x1="0" y1="0" x2="1" y2="0">
                                  <stop offset="0%" stopColor="#22d3ee" />
                                  <stop offset="100%" stopColor="#3b82f6" />
                                </linearGradient>
                                <linearGradient id="stressFill" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor="rgba(34,211,238,0.28)" />
                                  <stop offset="100%" stopColor="rgba(34,211,238,0.02)" />
                                </linearGradient>
                              </defs>
                              {[20, 40, 60, 80, 100].map((grid) => {
                                const y = 132 - (grid / 100) * 104
                                return <line key={grid} x1="12" y1={y} x2="308" y2={y} stroke="rgba(148,163,184,0.14)" strokeDasharray="4 5" />
                              })}
                              <path d={`M ${stressArea}`} fill="url(#stressFill)" />
                              <polyline fill="none" stroke="url(#stressLine)" strokeWidth="3" points={stressLine} />
                              {stressChartPoints.map((point) => (
                                <g key={point.drop}>
                                  <circle cx={point.x} cy={point.y} r="5" fill="#0a1120" stroke="#22d3ee" strokeWidth="2" />
                                  <text x={point.x} y={140} textAnchor="middle" fill="#94a3b8" fontSize="10">{point.drop}%</text>
                                  <text x={point.x} y={point.y - 10} textAnchor="middle" fill="#e2e8f0" fontSize="10">{point.score}</text>
                                </g>
                              ))}
                            </svg>
                          </div>

                          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                            <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-3">
                              <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Starting point</div>
                              <div className="mt-2 text-2xl font-bold text-slate-100">{stressBasePoint?.score ?? '--'}</div>
                              <div className="text-xs text-slate-500">At 0% drop</div>
                            </div>
                            <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-3">
                              <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Worst point</div>
                              <div className="mt-2 text-2xl font-bold text-rose-300">{stressWorstPoint?.score ?? '--'}</div>
                              <div className="text-xs text-slate-500">At {stressWorstPoint?.drop ?? '--'}% drop</div>
                            </div>
                            <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-3">
                              <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Curve slope</div>
                              <div className="mt-2 text-2xl font-bold text-slate-100">{stressBasePoint && stressWorstPoint ? `${stressWorstPoint.score - stressBasePoint.score}` : '--'}</div>
                              <div className="text-xs text-slate-500">Net change across curve</div>
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="mt-4 rounded-2xl border border-dashed border-[#1e293b] bg-[#0a1120] p-6 text-sm text-slate-500">
                          Generate the stress curve to see how sharply credit quality changes as revenue drops from 0% to 50%.
                        </div>
                      )}
                    </div>

                    <div className="rounded-3xl border border-[#1e293b] bg-[#111827] p-4">
                      <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.25em] text-slate-500">
                        <TrendingDown size={13} className="text-amber-300" /> Sensitivity Ladder
                      </div>
                      <div className="mt-4 space-y-3">
                        {stressCurve.length > 0 ? stressCurve.map((point) => {
                          const delta = stressBasePoint ? point.score - stressBasePoint.score : 0
                          return (
                            <div key={point.drop} className="rounded-2xl border border-white/5 bg-white/[0.02] p-3">
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-slate-300">Revenue down {point.drop}%</span>
                                <span className="text-slate-100">{point.score}</span>
                              </div>
                              <div className="mt-1 text-xs text-slate-500">{delta === 0 ? 'Baseline scenario' : `${delta > 0 ? '+' : ''}${delta} points versus baseline`}</div>
                            </div>
                          )
                        }) : (
                          <div className="text-sm text-slate-500">Run the curve to rank downside sensitivity by scenario.</div>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              )}

              {activeTab === 'metrics' && (
                <div className="grid gap-4 xl:grid-cols-2">
                  {metrics ? Object.entries(metrics).map(([group, values]) => (
                    <div key={group} className="rounded-3xl border border-[#1e293b] bg-[#111827] p-4">
                      <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.25em] text-slate-500">
                        <Sparkles size={13} className="text-cyan-300" /> {formatMetricName(group)}
                      </div>
                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        {Object.entries(values).map(([k, v]) => (
                          <div key={k} className="rounded-2xl border border-white/5 bg-white/[0.02] p-3">
                            <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">{formatMetricName(k)}</div>
                            <div className="mt-2 text-xl font-semibold text-slate-100">{formatMetricValue(v)}</div>
                            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#0a1120]">
                              <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-blue-500" style={{ width: `${metricStrength(v)}%` }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )) : (
                    <div className="rounded-3xl border border-[#1e293b] bg-[#111827] p-4 text-sm text-slate-500">No intermediate metrics available.</div>
                  )}
                </div>
              )}

              {activeTab === 'recommendations' && (
                <>
                  <div className="grid gap-4 xl:grid-cols-3">
                    <div className="rounded-3xl border border-rose-500/20 bg-rose-500/5 p-4">
                      <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.25em] text-rose-300">
                        <AlertTriangle size={13} /> Immediate Actions
                      </div>
                      <div className="mt-4 space-y-2">
                        {(recommendationBuckets?.immediate ?? []).map((line, i) => (
                          <div key={i} className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-slate-200">{line}</div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-3xl border border-amber-500/20 bg-amber-500/5 p-4">
                      <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.25em] text-amber-300">
                        <TrendingDown size={13} /> Monitoring Watchlist
                      </div>
                      <div className="mt-4 space-y-2">
                        {(recommendationBuckets?.monitor ?? []).map((line, i) => (
                          <div key={i} className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-slate-200">{line}</div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-3xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                      <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.25em] text-emerald-300">
                        <TrendingUp size={13} /> Supporting Strengths
                      </div>
                      <div className="mt-4 space-y-2">
                        {((recommendationBuckets?.strengths?.length ? recommendationBuckets.strengths : recommendations.slice(0, 3)) ?? []).map((line, i) => (
                          <div key={i} className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-slate-200">{line}</div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-[#1e293b] bg-[#111827] p-4">
                    <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.25em] text-slate-500">
                      <ShieldAlert size={13} className="text-cyan-300" /> Detailed Explanation
                    </div>
                    <div className="mt-4 grid gap-2">
                      {m3Result.explanation.map((line, i) => (
                        <div key={i} className="rounded-2xl border border-white/5 bg-white/[0.02] px-3 py-2 text-sm text-slate-300">{line}</div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
