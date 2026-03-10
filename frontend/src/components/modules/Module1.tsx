import { useState, useEffect, useRef } from 'react'
import {
  Upload, FileText, Trash2, Play, RefreshCw,
  BarChart2, TrendingUp, CheckCircle, X, Download,
} from 'lucide-react'
import { api } from '../../api'
import { useAppStore } from '../../store'
import { downloadDocReport, downloadPdfReport } from '../../utils/exportUtils'
import type { FullAnalysis, ExtractionResult, FinancialTable, Alert } from '../../types'

// ── Constants ─────────────────────────────────────────────────────────────────

const CATEGORIES = [
  { value: 'annual_report',      label: 'Annual Report'         },
  { value: 'financial_statement',label: 'Financial Statement'   },
  { value: 'bank_statement',     label: 'Bank Statement'        },
  { value: 'gst_filing',         label: 'GST Filing'            },
  { value: 'rating_report',      label: 'Rating Agency Report'  },
]

const CAT_EMOJI: Record<string, string> = {
  annual_report: '📊', financial_statement: '📈',
  bank_statement: '🏦', gst_filing: '🧾', rating_report: '⭐',
}

const TABS = [
  { id: 'overview',    label: 'Overview'     },
  { id: 'extraction',  label: 'Extraction'   },
  { id: 'trends',      label: 'Trends'       },
  { id: 'crossverify', label: 'Cross-Verify' },
  { id: 'ratios',      label: 'Ratios'       },
]

const HEALTH: Record<string, string> = {
  healthy:  'bg-emerald-500/10 text-emerald-400',
  warning:  'bg-amber-500/10  text-amber-400',
  critical: 'bg-red-500/10    text-red-400',
}

// ── Small shared UI ────────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className="w-0.5 h-5 rounded-full" style={{ background: 'linear-gradient(#60a5fa,#a78bfa)' }} />
      <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">{children}</h3>
    </div>
  )
}

function DataCard({ label, value, unit }: { label: string; value?: number | string; unit?: string }) {
  const missing = value === undefined || value === null
  return (
    <div className={[
      'rounded-xl border p-4 transition-all',
      missing
        ? 'bg-[#111827] border-dashed border-slate-700/60 opacity-60'
        : 'bg-[#1a2035] border-[#1e293b] hover:border-blue-500/30 hover:shadow-lg hover:shadow-blue-500/5',
    ].join(' ')}>
      <div className="text-[9px] font-semibold text-slate-500 uppercase tracking-widest mb-2">{label}</div>
      {missing ? (
        <div className="text-[10px] text-amber-500/70 font-medium">⚠ Missing</div>
      ) : typeof value === 'number' ? (
        <div className="text-lg font-bold text-slate-100">
          ₹{value.toFixed(1)}<span className="text-xs font-normal text-slate-500 ml-1">{unit}</span>
        </div>
      ) : (
        <div className="text-sm font-semibold text-slate-200">{value}</div>
      )}
    </div>
  )
}

function AlertCard({ alert }: { alert: Alert }) {
  const bg: Record<string, string> = {
    low:      'border-emerald-500/20 bg-emerald-500/5',
    medium:   'border-cyan-500/20    bg-cyan-500/5',
    high:     'border-amber-500/20   bg-amber-500/5',
    critical: 'border-red-500/20     bg-red-500/5',
  }
  const tc: Record<string, string> = {
    low: 'text-emerald-400', medium: 'text-cyan-400', high: 'text-amber-400', critical: 'text-red-400',
  }
  return (
    <div className={`rounded-xl border p-4 mb-3 anim-fade-up ${bg[alert.severity] || bg.high}`}>
      <div className={`text-[9px] font-bold uppercase tracking-widest mb-2 ${tc[alert.severity] || tc.high}`}>
        {alert.severity} · {alert.alert_type?.replace(/_/g, ' ')}
      </div>
      <p className="text-sm text-slate-200 leading-relaxed mb-1.5">{alert.description}</p>
      {alert.recommendation && (
        <p className="text-xs text-slate-400 italic">💡 {alert.recommendation}</p>
      )}
    </div>
  )
}

function FinTable({ table }: { table: FinancialTable }) {
  if (!table.headers?.length) return null
  return (
    <div className="mb-5">
      {table.table_name && <p className="text-xs text-slate-500 mb-2">{table.table_name}</p>}
      <div className="overflow-x-auto rounded-xl border border-[#1e293b]">
        <table className="w-full text-xs">
          <thead>
            <tr>
              {table.headers.map(h => (
                <th key={h} className="text-left px-3 py-2.5 bg-[#111827] text-slate-400 font-semibold text-[10px] uppercase tracking-wider border-b border-[#1e293b]">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows?.map((row, i) => (
              <tr key={i} className="hover:bg-white/[0.02] border-b border-[#1e293b]/40 last:border-0">
                {table.headers.map(h => (
                  <td key={h} className="px-3 py-2.5 text-slate-300">{row[h] ?? ''}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Tab: Overview ─────────────────────────────────────────────────────────────

function OverviewTab({ analysis }: { analysis: FullAnalysis | null }) {
  if (!analysis) {
    return (
      <div className="flex flex-col items-center justify-center h-72 select-none">
        <BarChart2 size={40} className="text-slate-700 mb-4" />
        <p className="text-sm font-medium text-slate-500">Run Full Analysis to see overview</p>
        <p className="text-xs text-slate-700 mt-1">Upload documents first, then click Run Analysis</p>
      </div>
    )
  }
  const level = analysis.overall_risk_level || 'medium'
  const riskBorder: Record<string, string> = {
    low: 'border-emerald-500/20', medium: 'border-amber-500/20',
    high: 'border-orange-500/20', critical: 'border-red-500/20',
  }
  const riskText: Record<string, string> = {
    low: 'text-emerald-400', medium: 'text-amber-400',
    high: 'text-orange-400', critical: 'text-red-400',
  }
  const cf = analysis.consolidated_financials
  return (
    <div className="space-y-6 anim-fade-up">
      {/* Risk Banner */}
      <div className={`rounded-2xl border bg-[#111827] p-6 text-center ${riskBorder[level] || riskBorder.medium}`}>
        <div className="text-[9px] font-semibold text-slate-500 uppercase tracking-widest mb-2">
          Module 1 Risk Assessment
        </div>
        <div className={`text-5xl font-black mb-2 tracking-widest ${riskText[level] || riskText.medium}`}>
          {level.toUpperCase()}
        </div>
        <div className="text-xs text-slate-600 italic">
          Based on document extraction & cross-verification. Module 2 required for full external risk.
        </div>
      </div>

      {/* Score Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {analysis.company_name && (
          <div className="bg-[#1a2035] border border-[#1e293b] rounded-xl p-4">
            <div className="text-[9px] font-semibold text-slate-500 uppercase tracking-widest mb-2">Company</div>
            <div className="text-sm font-bold text-slate-200 leading-snug">{analysis.company_name}</div>
          </div>
        )}
        {analysis.completeness && (() => {
          const p = analysis.completeness.completeness_percentage
          return (
            <div className={`rounded-xl border p-4 ${p >= 80 ? 'bg-emerald-500/5 border-emerald-500/20' : p >= 50 ? 'bg-amber-500/5 border-amber-500/20' : 'bg-red-500/5 border-red-500/20'}`}>
              <div className="text-[9px] font-semibold text-slate-500 uppercase tracking-widest mb-2">Completeness</div>
              <div className={`text-3xl font-black ${p >= 80 ? 'text-emerald-400' : p >= 50 ? 'text-amber-400' : 'text-red-400'}`}>{p}%</div>
            </div>
          )
        })()}
        {cf?.revenue != null && (
          <div className="bg-[#1a2035] border border-[#1e293b] rounded-xl p-4">
            <div className="text-[9px] font-semibold text-slate-500 uppercase tracking-widest mb-2">Revenue</div>
            <div className="text-2xl font-black text-blue-400">
              ₹{cf.revenue.toFixed(1)}<span className="text-xs text-slate-500 font-normal ml-1">Cr</span>
            </div>
          </div>
        )}
        {cf?.profit != null && (
          <div className={`rounded-xl border p-4 ${cf.profit >= 0 ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-red-500/5 border-red-500/20'}`}>
            <div className="text-[9px] font-semibold text-slate-500 uppercase tracking-widest mb-2">Net Profit</div>
            <div className={`text-2xl font-black ${cf.profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              ₹{cf.profit.toFixed(1)}<span className="text-xs text-slate-500 font-normal ml-1">Cr</span>
            </div>
          </div>
        )}
      </div>

      {analysis.financial_ratios?.financial_summary && (
        <div>
          <SectionTitle>Financial Summary</SectionTitle>
          <div className="bg-[#111827] rounded-xl border border-[#1e293b] p-4 text-sm text-slate-300 leading-relaxed">
            {analysis.financial_ratios.financial_summary}
          </div>
        </div>
      )}

      {analysis.risk_alerts?.length ? (
        <div>
          <SectionTitle>Risk Alerts</SectionTitle>
          {analysis.risk_alerts.map((a, i) => <AlertCard key={i} alert={a} />)}
        </div>
      ) : null}
    </div>
  )
}

// ── Tab: Extraction ───────────────────────────────────────────────────────────

function ExtractionTab({ extraction }: { extraction: ExtractionResult | null }) {
  if (!extraction?.financial_data) {
    return (
      <div className="flex flex-col items-center justify-center h-72 select-none">
        <FileText size={40} className="text-slate-700 mb-4" />
        <p className="text-sm font-medium text-slate-500">Upload and process a document</p>
        <p className="text-xs text-slate-700 mt-1">Extracted data will appear here</p>
      </div>
    )
  }
  const d = extraction.financial_data
  const FIELDS = [
    { k: 'company_name', l: 'Company'            },
    { k: 'fiscal_year',  l: 'Fiscal Year'        },
    { k: 'revenue',      l: 'Revenue',      u: 'Cr' },
    { k: 'profit',       l: 'Net Profit',   u: 'Cr' },
    { k: 'total_debt',   l: 'Total Debt',   u: 'Cr' },
    { k: 'total_assets', l: 'Total Assets', u: 'Cr' },
    { k: 'total_liabilities', l: 'Total Liabilities', u: 'Cr' },
    { k: 'cash_flow',    l: 'Cash Flow',    u: 'Cr' },
    { k: 'equity',       l: 'Equity',       u: 'Cr' },
    { k: 'interest_expense', l: 'Interest Expense', u: 'Cr' },
    { k: 'ebit',             l: 'EBIT',             u: 'Cr' },
    { k: 'current_assets',   l: 'Current Assets',   u: 'Cr' },
    { k: 'current_liabilities', l: 'Current Liabilities', u: 'Cr' },
    { k: 'gst_revenue',  l: 'GST Revenue',  u: 'Cr' },
    { k: 'bank_inflow',  l: 'Bank Inflow',  u: 'Cr' },
    { k: 'bank_outflow', l: 'Bank Outflow', u: 'Cr' },
  ] as const

  return (
    <div className="space-y-6 anim-fade-up">
      <div className="flex items-center justify-between">
        <SectionTitle>Extracted Financial Data</SectionTitle>
        <span className="text-[10px] text-slate-500 bg-[#111827] border border-[#1e293b] px-3 py-1 rounded-full">
          Confidence: {((extraction.confidence_score || 0) * 100).toFixed(0)}%
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {FIELDS.map(f => (
          <DataCard key={f.k} label={f.l} value={(d as Record<string, unknown>)[f.k] as number | string | undefined} unit={(f as { k: string; l: string; u?: string }).u} />
        ))}
      </div>
      {extraction.tables?.map((t, i) => <FinTable key={i} table={t} />)}
    </div>
  )
}

// ── Tab: Trends ───────────────────────────────────────────────────────────────

function TrendsTab({ analysis }: { analysis: FullAnalysis | null }) {
  if (!analysis?.trends?.length && !analysis?.tables?.length) {
    return (
      <div className="flex flex-col items-center justify-center h-72 select-none">
        <TrendingUp size={40} className="text-slate-700 mb-4" />
        <p className="text-sm font-medium text-slate-500">No trend data found</p>
        <p className="text-xs text-slate-700 mt-1">Upload multi-year financial reports for trend analysis</p>
      </div>
    )
  }
  return (
    <div className="space-y-4 anim-fade-up">
      {analysis?.tables?.map((t, i) => <FinTable key={i} table={t} />)}
      {analysis?.trends?.map((trend, i) => (
        <div key={i} className="bg-[#1a2035] rounded-xl border border-[#1e293b] p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="font-semibold text-sm text-slate-200">{trend.metric_name}</div>
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${trend.trend_direction === 'increasing' ? 'bg-emerald-500/10 text-emerald-400' : trend.trend_direction === 'decreasing' ? 'bg-red-500/10 text-red-400' : 'bg-amber-500/10 text-amber-400'}`}>
              {trend.trend_direction === 'increasing' ? '↑' : trend.trend_direction === 'decreasing' ? '↓' : '→'} {trend.trend_direction}
              {trend.average_growth != null && ` · ${trend.average_growth.toFixed(1)}%`}
            </span>
          </div>
          {trend.chart_base64 && (
            <img src={trend.chart_base64} alt={trend.metric_name} className="w-full rounded-lg border border-[#1e293b]" />
          )}
        </div>
      ))}
    </div>
  )
}

// ── Tab: Cross-Verify ─────────────────────────────────────────────────────────

function CrossVerifyTab({ analysis }: { analysis: FullAnalysis | null }) {
  const cv = analysis?.cross_verification
  if (!cv) {
    return (
      <div className="flex flex-col items-center justify-center h-72 select-none">
        <CheckCircle size={40} className="text-slate-700 mb-4" />
        <p className="text-sm font-medium text-slate-500">Cross-verification unavailable</p>
        <p className="text-xs text-slate-700 mt-1">Upload both GST filings and bank statements</p>
      </div>
    )
  }
  return (
    <div className="space-y-6 anim-fade-up">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cv.gst_revenue != null && (
          <div className="bg-[#1a2035] border border-[#1e293b] rounded-xl p-4">
            <div className="text-[9px] font-semibold text-slate-500 uppercase tracking-widest mb-2">GST Revenue</div>
            <div className="text-2xl font-bold text-blue-400">₹{cv.gst_revenue.toFixed(1)}<span className="text-xs text-slate-500 ml-1">Cr</span></div>
          </div>
        )}
        {cv.bank_inflow != null && (
          <div className="bg-[#1a2035] border border-[#1e293b] rounded-xl p-4">
            <div className="text-[9px] font-semibold text-slate-500 uppercase tracking-widest mb-2">Bank Inflow</div>
            <div className="text-2xl font-bold text-blue-400">₹{cv.bank_inflow.toFixed(1)}<span className="text-xs text-slate-500 ml-1">Cr</span></div>
          </div>
        )}
        {cv.deviation_percentage != null && (() => {
          const d = cv.deviation_percentage
          return (
            <div className={`rounded-xl border p-4 ${d > 40 ? 'bg-red-500/5 border-red-500/20' : d > 25 ? 'bg-amber-500/5 border-amber-500/20' : 'bg-emerald-500/5 border-emerald-500/20'}`}>
              <div className="text-[9px] font-semibold text-slate-500 uppercase tracking-widest mb-2">Deviation</div>
              <div className={`text-2xl font-bold ${d > 40 ? 'text-red-400' : d > 25 ? 'text-amber-400' : 'text-emerald-400'}`}>{d}%</div>
            </div>
          )
        })()}
      </div>
      {cv.risk_summary && (
        <div className="bg-[#111827] rounded-xl border border-[#1e293b] p-4 text-sm text-slate-300 leading-relaxed">
          {cv.risk_summary}
        </div>
      )}
      {cv.alerts?.map((a, i) => <AlertCard key={i} alert={a} />)}
    </div>
  )
}

// ── Tab: Ratios ───────────────────────────────────────────────────────────────

function RatiosTab({ analysis }: { analysis: FullAnalysis | null }) {
  const ratios = analysis?.financial_ratios
  if (!ratios) {
    return (
      <div className="flex flex-col items-center justify-center h-72 select-none">
        <BarChart2 size={40} className="text-slate-700 mb-4" />
        <p className="text-sm font-medium text-slate-500">Ratio analysis unavailable</p>
        <p className="text-xs text-slate-700 mt-1">Run full analysis to compute financial ratios</p>
      </div>
    )
  }
  const ratioList = [
    ratios.debt_to_equity, ratios.interest_coverage,
    ratios.current_ratio,  ratios.profit_margin, ratios.revenue_growth,
  ].filter(Boolean) as NonNullable<typeof ratios.debt_to_equity>[]

  return (
    <div className="space-y-4 anim-fade-up">
      <div className="flex items-center justify-between mb-2">
        <SectionTitle>Financial Ratios</SectionTitle>
        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase ${HEALTH[ratios.overall_health] || 'bg-slate-700 text-slate-400'}`}>
          {ratios.overall_health}
        </span>
      </div>
      {ratioList.map((r, i) => (
        <div key={i} className={`bg-[#1a2035] rounded-xl border p-4 anim-fade-up ${r.value == null ? 'border-dashed border-slate-700/50 opacity-70' : 'border-[#1e293b]'}`}>
          <div className="flex items-center justify-between mb-3">
            <div className="font-semibold text-sm text-slate-200">{r.ratio_name}</div>
            <span className={`text-[9px] font-bold px-2 py-1 rounded-full uppercase ${r.value != null ? HEALTH[r.health] || '' : 'bg-slate-700/50 text-slate-500'}`}>
              {r.value != null ? r.health : 'No Data'}
            </span>
          </div>
          {r.value != null ? (
            <div className={`text-2xl font-black mb-3 ${r.health === 'healthy' ? 'text-emerald-400' : r.health === 'warning' ? 'text-amber-400' : 'text-red-400'}`}>
              {r.ratio_name.includes('Margin') || r.ratio_name.includes('Growth')
                ? `${(r.value * 100).toFixed(1)}%`
                : r.ratio_name.includes('Coverage')
                  ? `${r.value.toFixed(2)}x`
                  : r.value.toFixed(2)}
            </div>
          ) : (
            <div className="text-xs text-amber-400/70 mb-3">⚠ Insufficient data to compute this ratio</div>
          )}
          <code className="text-[10px] text-slate-600 bg-black/30 px-2 py-1 rounded block mb-2">{r.formula}</code>
          <p className="text-xs text-slate-400 leading-relaxed border-l-2 border-[#1e293b] pl-3">{r.interpretation}</p>
        </div>
      ))}
      {ratios.financial_summary && (
        <div>
          <SectionTitle>Financial Summary</SectionTitle>
          <div className="bg-[#111827] rounded-xl border border-[#1e293b] p-4 text-sm text-slate-300 leading-relaxed">
            {ratios.financial_summary}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function Module1() {
  const [activeTab, setActiveTab] = useState('overview')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [category, setCategory] = useState('annual_report')
  const [uploading, setUploading] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [progressText, setProgressText] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const [apiOnline, setApiOnline] = useState<boolean | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const {
    m1Documents, m1Analysis, m1Completeness, m1LastExtraction,
    setM1Documents, setM1Analysis, setM1Completeness, setM1LastExtraction,
    addToast,
  } = useAppStore()

  useEffect(() => { init() }, [])

  async function init() {
    try {
      const h = await api.health()
      setApiOnline(h.status === 'healthy' || !!h.gemini_configured)
    } catch { setApiOnline(false) }
    fetch_docs()
    fetch_completeness()
  }

  async function fetch_docs() {
    try { setM1Documents((await api.getDocuments()).data || []) } catch { /* silent */ }
  }
  async function fetch_completeness() {
    try { setM1Completeness((await api.getCompleteness()).report) } catch { /* silent */ }
  }

  function pick(f: File) {
    if (!f.name.toLowerCase().endsWith('.pdf')) { addToast('Only PDF files are supported', 'error'); return }
    setSelectedFile(f)
  }

  async function handleUpload() {
    if (!selectedFile || uploading) return
    setUploading(true); setProgress(5)
    const steps = ['Extracting PDF text…', 'Running Gemini LLM…', 'Parsing tables…', 'Finalising…']
    let si = 0
    timerRef.current = setInterval(() => {
      setProgress(p => Math.min(p + Math.random() * 18, 90))
      setProgressText(steps[Math.min(si++, steps.length - 1)])
    }, 1200)
    try {
      const result = await api.uploadDocument(selectedFile, category)
      clearInterval(timerRef.current!)
      setProgress(100); setProgressText('Done!')
      setM1LastExtraction(result)
      setActiveTab('extraction')
      addToast(`${selectedFile.name} processed`, 'success')
      setSelectedFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      await fetch_docs(); await fetch_completeness()
      setTimeout(() => { setProgress(0); setProgressText('') }, 1500)
    } catch (e: unknown) {
      clearInterval(timerRef.current!)
      addToast(`Upload failed: ${(e as Error).message}`, 'error')
      setProgress(0)
    } finally { setUploading(false) }
  }

  async function handleAnalysis() {
    if (analyzing) return
    setAnalyzing(true)
    try {
      const result = await api.runFullAnalysis()
      setM1Analysis(result)
      setActiveTab('overview')
      addToast('Analysis complete', 'success')
    } catch (e: unknown) {
      addToast(`Analysis failed: ${(e as Error).message}`, 'error')
    } finally { setAnalyzing(false) }
  }

  async function handleDelete(id: string) {
    try {
      await api.deleteDocument(id)
      addToast('Document deleted', 'info')
      await fetch_docs(); await fetch_completeness()
    } catch (e: unknown) { addToast(`Delete failed: ${(e as Error).message}`, 'error') }
  }

  async function handleReset() {
    if (!confirm('Reset all Module 1 data?')) return
    try {
      await api.resetModule1()
      setM1Documents([]); setM1Analysis(null)
      setM1Completeness(null); setM1LastExtraction(null)
      addToast('Module 1 reset', 'info')
    } catch (e: unknown) { addToast(`Reset failed: ${(e as Error).message}`, 'error') }
  }

  // Completeness ring (r=32, circ≈201)
  const CIRC = 201
  const pct = m1Completeness?.completeness_percentage ?? 0
  const ringOffset = CIRC - (CIRC * pct / 100)
  const ringColor = pct >= 80 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444'
  const hasExportData = Boolean(
    m1Analysis
    || m1LastExtraction
    || m1Completeness
    || m1Documents.length,
  )

  function buildModule1Sections() {
    return [
      {
        heading: 'Overview',
        content: {
          documents_count: m1Documents.length,
          completeness: m1Completeness,
          overall_risk_level: m1Analysis?.overall_risk_level,
          company_name: m1Analysis?.company_name,
        },
      },
      {
        heading: 'Last Extraction',
        content: m1LastExtraction,
      },
      {
        heading: 'Full Analysis',
        content: m1Analysis,
      },
      {
        heading: 'Documents',
        content: m1Documents,
      },
    ]
  }

  function handleDownloadDoc() {
    if (!hasExportData) {
      addToast('No Module 1 analysis data to export yet.', 'warning')
      return
    }
    downloadDocReport('Module 1 Analysis Report', buildModule1Sections(), 'module1-analysis')
    addToast('Module 1 DOC downloaded', 'success')
  }

  function handleDownloadPdf() {
    if (!hasExportData) {
      addToast('No Module 1 analysis data to export yet.', 'warning')
      return
    }
    downloadPdfReport('Module 1 Analysis Report', buildModule1Sections(), 'module1-analysis')
    addToast('Module 1 PDF downloaded', 'success')
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* ── Header ── */}
      <header className="flex-shrink-0 flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-3.5 border-b border-[#1e293b]"
        style={{ background: 'rgba(7,9,18,0.85)', backdropFilter: 'blur(12px)' }}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
            <FileText size={15} className="text-blue-400" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-200">Module 1 — Data Ingestor</h1>
            <p className="text-[10px] text-slate-500">Financial Document Intelligence</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className={`flex items-center gap-1.5 text-[10px] px-3 py-1.5 rounded-full border ${apiOnline === null ? 'border-slate-700 text-slate-500' : apiOnline ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-400' : 'border-red-500/20 bg-red-500/5 text-red-400'}`}>
            <div className={`w-1.5 h-1.5 rounded-full dot-pulse ${apiOnline === null ? 'bg-slate-500' : apiOnline ? 'bg-emerald-400' : 'bg-red-400'}`} />
            {apiOnline === null ? 'Checking…' : apiOnline ? 'API Online' : 'API Offline'}
          </div>
          <button
            onClick={handleDownloadDoc}
            disabled={!hasExportData}
            className="flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-cyan-300 bg-[#111827] border border-[#1e293b] hover:border-cyan-500/30 px-3 py-1.5 rounded-lg transition-all disabled:opacity-40"
          >
            <Download size={12} /> DOC
          </button>
          <button
            onClick={handleDownloadPdf}
            disabled={!hasExportData}
            className="flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-cyan-300 bg-[#111827] border border-[#1e293b] hover:border-cyan-500/30 px-3 py-1.5 rounded-lg transition-all disabled:opacity-40"
          >
            <Download size={12} /> PDF
          </button>
          <button onClick={handleReset} className="flex items-center gap-1.5 text-[11px] text-slate-500 hover:text-red-400 bg-[#111827] border border-[#1e293b] hover:border-red-500/30 px-3 py-1.5 rounded-lg transition-all">
            <RefreshCw size={12} /> Reset
          </button>
        </div>
      </header>

      {/* ── Body ── */}
      <div className="flex flex-1 flex-col lg:flex-row overflow-hidden">

        {/* Left Panel */}
        <aside className="w-full lg:w-[340px] xl:w-[360px] flex-shrink-0 border-b lg:border-b-0 lg:border-r border-[#1e293b] flex flex-col overflow-y-auto" style={{ background: '#070912' }}>

          {/* Upload Zone */}
          <div className="p-4 border-b border-[#1e293b]/50">
            <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-2">Upload Document</div>
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={e => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files[0]; if (f) pick(f) }}
              className={`border-2 border-dashed rounded-xl p-5 sm:p-8 text-center cursor-pointer transition-all duration-200 ${isDragging ? 'border-blue-500 bg-blue-500/5 scale-[1.01]' : 'border-[#1e293b] hover:border-blue-500/40 hover:bg-blue-500/[0.02]'}`}
            >
              <Upload size={34} className={`mx-auto mb-3 transition-colors ${isDragging ? 'text-blue-400' : 'text-slate-600'}`} />
              <p className="text-sm text-slate-400 mb-1">Drop PDF or <span className="text-blue-400 underline underline-offset-2">browse</span></p>
              <p className="text-[10px] text-slate-600 leading-relaxed">Annual Reports · Financials · Bank Statements · GST · Rating Reports</p>
              <input ref={fileInputRef} type="file" accept=".pdf" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) pick(f) }} />
            </div>
          </div>

          {/* Selected File */}
          {selectedFile && (
            <div className="px-4 pb-4 space-y-3 anim-fade-up">
              <div className="flex items-center gap-2 bg-[#1a2035] rounded-xl border border-[#1e293b] p-3">
                <FileText size={13} className="text-blue-400 flex-shrink-0" />
                <span className="text-xs text-slate-300 flex-1 truncate">{selectedFile.name}</span>
                <button onClick={() => setSelectedFile(null)} className="text-slate-600 hover:text-red-400 transition-colors"><X size={12} /></button>
              </div>
              <select value={category} onChange={e => setCategory(e.target.value)}
                className="w-full bg-[#111827] border border-[#1e293b] text-slate-300 text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-blue-500/50 appearance-none cursor-pointer">
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
              <button onClick={handleUpload} disabled={uploading}
                className="w-full flex items-center justify-center gap-2 text-white text-sm font-semibold py-2.5 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-500/20"
                style={{ background: uploading ? '#1e40af' : 'linear-gradient(135deg,#2563eb,#1d4ed8)' }}>
                {uploading ? <><span className="spinner" /> Processing…</> : <><Upload size={14} /> Process Document</>}
              </button>
              {progress > 0 && (
                <div>
                  <div className="h-1 bg-[#1a2035] rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${progress}%`, background: 'linear-gradient(90deg,#3b82f6,#8b5cf6)' }} />
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1 text-center">{progressText}</p>
                </div>
              )}
            </div>
          )}

          {/* Run Analysis */}
          <div className="px-4 py-4 border-b border-[#1e293b]/50">
            <button onClick={handleAnalysis} disabled={analyzing || m1Documents.length === 0}
              className="w-full flex items-center justify-center gap-2 text-white text-sm font-semibold py-2.5 rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-violet-500/20"
              style={{ background: 'linear-gradient(135deg,#7c3aed,#6d28d9)' }}>
              {analyzing ? <><span className="spinner" /> Analysing…</> : <><Play size={14} /> Run Full Analysis</>}
            </button>
          </div>

          {/* Documents */}
          <div className="p-4 flex-shrink-0 border-b border-[#1e293b]/50">
            <div className="text-[9px] font-bold text-slate-600 uppercase tracking-widest mb-3">
              Uploaded Documents ({m1Documents.length})
            </div>
            {m1Documents.length === 0 ? (
              <p className="text-xs text-slate-700 text-center py-4">No documents yet</p>
            ) : (
              <div className="space-y-2">
                {m1Documents.map(doc => (
                  <div key={doc.document_id} className="flex items-center gap-2 bg-[#111827] border border-[#1e293b] rounded-xl p-3 group hover:border-[#2a3a5e] transition-colors">
                    <span className="text-base flex-shrink-0">{CAT_EMOJI[doc.category] || '📄'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] font-medium text-slate-300 truncate">{doc.filename}</div>
                      <div className="text-[9px] text-slate-600">{doc.category.replace(/_/g, ' ')} · {doc.page_count ?? '?'} pages</div>
                    </div>
                    <button onClick={() => handleDelete(doc.document_id)}
                      className="text-slate-700 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100">
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Completeness Ring */}
          <div className="p-4">
            <div className="text-[9px] font-bold text-slate-600 uppercase tracking-widest mb-4">Data Completeness</div>
            <div className="flex items-start gap-4">
              <div className="relative w-20 h-20 flex-shrink-0">
                <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90">
                  <circle cx="40" cy="40" r="32" fill="none" stroke="#1e293b" strokeWidth="7" />
                  <circle cx="40" cy="40" r="32" fill="none" stroke={ringColor} strokeWidth="7"
                    strokeLinecap="round" strokeDasharray={CIRC} strokeDashoffset={ringOffset}
                    style={{ transition: 'stroke-dashoffset 1s ease' }} />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-sm font-bold" style={{ color: ringColor }}>{Math.round(pct)}%</span>
                </div>
              </div>
              <div className="flex-1 min-w-0 space-y-2 overflow-y-auto max-h-44 pr-1">
                {!m1Completeness?.suggestions?.length && (
                  <div className="text-[11px] leading-relaxed text-slate-500 break-words">
                    Upload key documents to unlock analysis quality checks.
                  </div>
                )}
                {m1Completeness?.suggestions?.map((s, i) => (
                  <div
                    key={i}
                    className={`text-[11px] leading-relaxed break-words border-l-2 pl-2 ${s.includes('✅') ? 'border-emerald-500 text-emerald-400/80' : s.includes('CRITICAL') ? 'border-red-500 text-red-400/80' : 'border-amber-500 text-amber-400/80'}`}
                  >
                    {s}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </aside>

        {/* Right Panel */}
        <div className="flex-1 flex flex-col overflow-hidden" style={{ background: '#0a0e1a' }}>
          {/* Tabs */}
          <div className="flex-shrink-0 flex items-center gap-1 px-3 sm:px-6 pt-4 pb-0 border-b border-[#1e293b] overflow-x-auto">
            {TABS.map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`px-3 sm:px-4 py-2.5 text-xs font-semibold border-b-2 transition-all duration-150 whitespace-nowrap ${activeTab === tab.id ? 'text-blue-400 border-blue-400' : 'text-slate-600 border-transparent hover:text-slate-400'}`}>
                {tab.label}
              </button>
            ))}
          </div>
          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6">
            {activeTab === 'overview'    && <OverviewTab    analysis={m1Analysis}          />}
            {activeTab === 'extraction'  && <ExtractionTab  extraction={m1LastExtraction}  />}
            {activeTab === 'trends'      && <TrendsTab      analysis={m1Analysis}          />}
            {activeTab === 'crossverify' && <CrossVerifyTab analysis={m1Analysis}          />}
            {activeTab === 'ratios'      && <RatiosTab      analysis={m1Analysis}          />}
          </div>
        </div>

      </div>
    </div>
  )
}
