import { useEffect, useState } from 'react'
import {
  BarChart3,
  RefreshCw,
  Activity,
  TrendingDown,
  Download,
  Sparkles,
  ShieldAlert,
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
    const cfObj = normalizedMap(cf as Record<string, unknown> | undefined)

    const importedRevenue =
      pickNumber(cfObj, ['revenue', 'gst_revenue', 'bank_inflow', 'turnover'])

    const importedNetProfit =
      pickNumber(cfObj, ['net_profit', 'profit', 'pat', 'ebit'])

    const importedTotalDebt =
      pickNumber(cfObj, ['total_debt', 'borrowings', 'total_liabilities'])

    const importedTotalAssets =
      pickNumber(cfObj, ['total_assets', 'assets'])

    const importedEquity =
      pickNumber(cfObj, ['equity', 'shareholders_equity', 'net_worth'])

    const importedInterestExpense =
      pickNumber(cfObj, ['interest_expense', 'finance_cost'])

    const importedCurrentAssets =
      pickNumber(cfObj, ['current_assets'])

    const importedCurrentLiabilities =
      pickNumber(cfObj, ['current_liabilities'])

    const bankInflow = pickNumber(cfObj, ['bank_inflow'])
    const bankOutflow = pickNumber(cfObj, ['bank_outflow'])

    const importedCashFlow =
      pickNumber(cfObj, ['cash_flow', 'operating_cash_flow'])
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
  const metrics = (
    m3Result as {
      intermediate_metrics?: Record<string, Record<string, number | null>>
    } | null
  )?.intermediate_metrics
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
              <div className="flex items-center gap-1 border-b border-[#1e293b] pb-2 overflow-x-auto">
                {M3_TABS.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-3 py-2 text-xs font-semibold rounded-lg whitespace-nowrap ${
                      activeTab === tab.id
                        ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                        : 'text-slate-500 border border-transparent hover:text-slate-300'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {activeTab === 'overview' && (
                <>
                  <div className="grid gap-4 lg:grid-cols-3">
                    <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-5 text-center lg:col-span-2">
                      <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-2">Final Risk Score</div>
                      <div className={`text-6xl font-black ${riskColor}`}>{score}</div>
                      <div className={`text-sm font-bold mt-1 ${riskColor}`}>{m3Result.risk_category} Risk</div>
                      {stressScore != null && (
                        <div className="mt-3 text-xs text-slate-400 flex items-center justify-center gap-2">
                          <TrendingDown size={13} className="text-amber-400" />
                          Stress ({stressDrop}% revenue drop): {stressScore}
                        </div>
                      )}
                    </div>

                    <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-4">
                      <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-2">Actions</div>
                      <button
                        onClick={() => {
                          setM3Result(null)
                          setStressScore(null)
                          setStressCurve([])
                        }}
                        className="w-full text-xs text-slate-300 hover:text-red-400 border border-[#1e293b] rounded-lg px-3 py-2 flex items-center justify-center gap-1"
                      >
                        <RefreshCw size={12} /> Clear Results
                      </button>
                    </div>
                  </div>

                  <div className="bg-[#0f172a] border border-[#1e293b] rounded-xl p-4">
                    <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-2">Decision Hint</div>
                    <p className="text-sm text-slate-300">
                      {m3Result.risk_category === 'Low'
                        ? 'Profile appears bankable on current inputs. Validate with final underwriting checks.'
                        : m3Result.risk_category === 'Medium'
                          ? 'Moderate risk detected. Consider tighter covenants and collateral buffers.'
                          : 'High risk profile. Escalate for deeper review before sanction decision.'}
                    </p>
                  </div>

                  <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-4">
                    <div className="flex items-center gap-2 text-[10px] text-slate-500 uppercase tracking-widest mb-2">
                      <ShieldAlert size={13} className="text-amber-400" />
                      Top Risk Drivers
                    </div>
                    {topDrivers.length ? topDrivers.map((line, i) => (
                      <div key={i} className="text-sm text-slate-300 mb-1">- {line}</div>
                    )) : (
                      <div className="text-sm text-slate-500">No notable risk drivers yet.</div>
                    )}
                  </div>
                </>
              )}

              {activeTab === 'factors' && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                    {[
                      ['Financial', m3Result.financial_strength_score],
                      ['Cash Flow', m3Result.cash_flow_score],
                      ['Legal', m3Result.legal_risk_score],
                      ['Industry', m3Result.industry_risk_score],
                      ['Promoter', m3Result.promoter_score],
                      ['Operational', m3Result.operational_score],
                    ].map(([label, value]) => (
                      <div key={label} className="bg-[#1a2035] border border-[#1e293b] rounded-xl p-4">
                        <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">{label}</div>
                        <div className="text-2xl font-bold text-slate-200">{value}</div>
                      </div>
                    ))}
                  </div>

                  <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-4">
                    <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-2">Weighted Impact</div>
                    {m3Result.explainable_score_impact.map((row) => (
                      <div key={row.factor} className="py-2 border-b border-[#1e293b]/60 last:border-0">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-slate-400">{row.factor.replace(/_/g, ' ')}</span>
                          <span className="text-slate-300">{row.raw_score} x {row.weight} = {row.weighted_contribution}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-[#0b1220] overflow-hidden">
                          <div
                            className="h-full"
                            style={{
                              width: `${Math.min(100, row.weighted_contribution)}%`,
                              background: 'linear-gradient(90deg,#06b6d4,#3b82f6)',
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {activeTab === 'scenarios' && (
                <>
                  <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-4">
                    <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-2">Stress Snapshot</div>
                    {stressScore != null ? (
                      <div className="text-sm text-slate-300">
                        Revenue drop <span className="text-amber-300">{stressDrop}%</span> gives stress score <span className="text-cyan-300">{stressScore}</span>.
                      </div>
                    ) : (
                      <div className="text-sm text-slate-500">Run stress test from left panel to populate this view.</div>
                    )}
                  </div>

                  <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-4">
                    <div className="flex items-center gap-2 text-[10px] text-slate-500 uppercase tracking-widest mb-3">
                      <Sparkles size={13} className="text-cyan-400" />
                      Stress Curve (Revenue Drop vs Score)
                    </div>
                    {stressCurve.length > 0 ? (
                      <div className="space-y-2">
                        {stressCurve.map((p) => (
                          <div key={p.drop} className="flex items-center gap-3">
                            <div className="w-24 text-xs text-slate-400">Drop {p.drop}%</div>
                            <div className="flex-1 h-2 rounded-full bg-[#0b1220] overflow-hidden">
                              <div
                                className="h-full"
                                style={{
                                  width: `${Math.max(0, Math.min(100, p.score))}%`,
                                  background: p.score >= 80
                                    ? 'linear-gradient(90deg,#22c55e,#16a34a)'
                                    : p.score >= 60
                                      ? 'linear-gradient(90deg,#f59e0b,#f97316)'
                                      : 'linear-gradient(90deg,#ef4444,#dc2626)',
                                }}
                              />
                            </div>
                            <div className="w-10 text-right text-xs text-slate-200">{p.score}</div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-sm text-slate-500">Generate stress curve to visualize sensitivity.</div>
                    )}
                  </div>
                </>
              )}

              {activeTab === 'metrics' && (
                <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-4">
                  <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-2">Intermediate Metrics</div>
                  {metrics ? Object.entries(metrics).map(([group, values]) => (
                    <div key={group} className="mb-4 last:mb-0">
                      <div className="text-xs text-cyan-300 mb-1">{group.replace(/_/g, ' ')}</div>
                      {Object.entries(values).map(([k, v]) => (
                        <div key={k} className="flex items-center justify-between text-xs py-1 border-b border-[#1e293b]/40 last:border-0">
                          <span className="text-slate-400">{k.replace(/_/g, ' ')}</span>
                          <span className="text-slate-200">{v == null ? 'N/A' : Number(v).toFixed(3)}</span>
                        </div>
                      ))}
                    </div>
                  )) : (
                    <div className="text-sm text-slate-500">No intermediate metrics available.</div>
                  )}
                </div>
              )}

              {activeTab === 'recommendations' && (
                <>
                  <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-4">
                    <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-2">Recommendations</div>
                    {recommendations.map((line, i) => (
                      <div key={i} className="text-sm text-slate-300 mb-2">- {line}</div>
                    ))}
                  </div>

                  <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-4">
                    <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-2">Detailed Explanation</div>
                    {m3Result.explanation.map((line, i) => (
                      <div key={i} className="text-sm text-slate-300 mb-1">- {line}</div>
                    ))}
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
