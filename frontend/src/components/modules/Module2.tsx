import { useState, useEffect, useRef } from 'react'
import {
  Search, RefreshCw, Download, AlertTriangle,
  BarChart2, Users, Scale, Newspaper, Bell,
} from 'lucide-react'
import { api } from '../../api'
import { useAppStore } from '../../store'
import { downloadDocReport, downloadPdfReport } from '../../utils/exportUtils'
import type { ResearchResult, ResearchInput, NetworkEntity } from '../../types'

// ── Shared UI ──────────────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className="w-0.5 h-5 rounded-full" style={{ background: 'linear-gradient(#a78bfa,#60a5fa)' }} />
      <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">{children}</h3>
    </div>
  )
}

function RiskChip({ level }: { level: string }) {
  const cfg: Record<string, string> = {
    Low: 'bg-emerald-500/10 text-emerald-400', low: 'bg-emerald-500/10 text-emerald-400',
    Moderate: 'bg-amber-500/10 text-amber-400', moderate: 'bg-amber-500/10 text-amber-400',
    High: 'bg-orange-500/10 text-orange-400',   high: 'bg-orange-500/10 text-orange-400',
    Critical: 'bg-red-500/10 text-red-400',     critical: 'bg-red-500/10 text-red-400',
  }
  return (
    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase ${cfg[level] || 'bg-slate-700 text-slate-400'}`}>
      {level}
    </span>
  )
}

// ── Canvas Network Graph ───────────────────────────────────────────────────────

function NetworkGraph({ data, company }: { data: NetworkEntity[]; company: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => { drawGraph() }, [data, company])

  function drawGraph() {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap) return
    const dpr = window.devicePixelRatio || 1
    const W = wrap.clientWidth
    const H = 320
    canvas.width = W * dpr; canvas.height = H * dpr
    canvas.style.width = `${W}px`; canvas.style.height = `${H}px`
    const ctx = canvas.getContext('2d')!
    ctx.scale(dpr, dpr)
    ctx.fillStyle = '#0d1221'
    ctx.fillRect(0, 0, W, H)

    const cx = W / 2, cy = H / 2
    const R = Math.min(W, H) * 0.33
    const entities = data.slice(0, 10)

    const nodes = [
      { x: cx, y: cy, label: company, type: 'company', color: '#3b82f6', risk: false, r: 26 },
      ...entities.map((e, i) => {
        const angle = (2 * Math.PI * i) / entities.length - Math.PI / 2
        let color = e.entity_type === 'person' ? '#8b5cf6' : '#10b981'
        if (e.risk_flag) color = '#ef4444'
        else if (['defunct', 'struck_off', 'bankrupt', 'defaulted'].includes((e.status || '').toLowerCase())) color = '#f59e0b'
        return { x: cx + R * Math.cos(angle), y: cy + R * Math.sin(angle), label: e.entity_name, type: e.entity_type, color, risk: e.risk_flag, r: 19 }
      }),
    ]

    // Edges
    for (let i = 1; i < nodes.length; i++) {
      ctx.beginPath()
      ctx.moveTo(nodes[0].x, nodes[0].y)
      ctx.lineTo(nodes[i].x, nodes[i].y)
      ctx.strokeStyle = nodes[i].risk ? 'rgba(239,68,68,0.3)' : 'rgba(59,130,246,0.12)'
      ctx.lineWidth = nodes[i].risk ? 1.5 : 1
      ctx.setLineDash(nodes[i].risk ? [5, 4] : [])
      ctx.stroke()
      ctx.setLineDash([])
    }

    // Nodes
    nodes.forEach(n => {
      const grd = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r + 10)
      grd.addColorStop(0, n.color + '28')
      grd.addColorStop(1, n.color + '00')
      ctx.beginPath(); ctx.arc(n.x, n.y, n.r + 10, 0, Math.PI * 2)
      ctx.fillStyle = grd; ctx.fill()
      ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2)
      ctx.fillStyle = n.color + '1a'; ctx.fill()
      ctx.strokeStyle = n.color; ctx.lineWidth = 1.5; ctx.stroke()
      ctx.fillStyle = '#fff'
      ctx.font = `${n.r * 0.7}px sans-serif`
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillText(n.type === 'person' ? '👤' : '🏢', n.x, n.y)
      ctx.fillStyle = '#94a3b8'
      ctx.font = `500 ${Math.max(9, Math.min(11, W / 70))}px Inter,sans-serif`
      const lbl = n.label.length > 15 ? n.label.slice(0, 13) + '…' : n.label
      ctx.fillText(lbl, n.x, n.y + n.r + 13)
      if (n.risk) {
        ctx.fillStyle = '#ef4444'
        ctx.font = 'bold 9px Inter,sans-serif'
        ctx.fillText('⚠ FLAGGED', n.x, n.y + n.r + 24)
      }
    })
  }

  return (
    <div ref={wrapRef} className="w-full">
      <canvas ref={canvasRef} className="w-full rounded-xl" />
    </div>
  )
}

// ── Tab: Overview ─────────────────────────────────────────────────────────────

function M2Overview({ res }: { res: ResearchResult | null }) {
  if (!res) {
    return (
      <div className="flex flex-col items-center justify-center h-72 select-none">
        <BarChart2 size={40} className="text-slate-700 mb-4" />
        <p className="text-sm text-slate-500">Run research to see overview</p>
      </div>
    )
  }
  const score = res.risk_scores?.overall_external_risk ?? 0
  const level = score >= 75 ? 'Critical' : score >= 50 ? 'High' : score >= 25 ? 'Moderate' : 'Low'
  const scoreColor = score >= 75 ? 'text-red-400' : score >= 50 ? 'text-orange-400' : score >= 25 ? 'text-amber-400' : 'text-emerald-400'
  const scoreBorder = score >= 75 ? 'border-red-500/20' : score >= 50 ? 'border-orange-500/20' : score >= 25 ? 'border-amber-500/20' : 'border-emerald-500/20'
  return (
    <div className="space-y-6 anim-fade-up">
      {/* Score banner */}
      <div className={`rounded-2xl border bg-[#111827] p-6 text-center ${scoreBorder}`}>
        <div className="text-[9px] font-semibold text-slate-500 uppercase tracking-widest mb-1">External Risk Score</div>
        <div className={`text-6xl font-black mb-1 ${scoreColor}`}>{score}</div>
        <div className={`text-sm font-bold mb-3 ${scoreColor}`}>{level}</div>
        {res.risk_summary?.overall_assessment && (
          <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">{res.risk_summary.overall_assessment}</p>
        )}
      </div>

      {/* Risk Breakdown */}
      {res.risk_summary && (
        <div>
          <SectionTitle>Risk Breakdown</SectionTitle>
          <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
            {[
              { l: 'News Risk',        lvl: res.risk_summary.news_risk_level,        s: res.risk_scores?.news_risk        },
              { l: 'Legal Risk',       lvl: res.risk_summary.legal_risk_level,       s: res.risk_scores?.legal_risk       },
              { l: 'Industry Risk',    lvl: res.risk_summary.industry_risk_level,    s: res.risk_scores?.industry_risk    },
              { l: 'Promoter Risk',    lvl: res.risk_summary.promoter_risk_level,    s: res.risk_scores?.promoter_risk    },
              { l: 'Operational Risk', lvl: res.risk_summary.operational_risk_level, s: res.risk_scores?.operational_risk },
            ].map((r, i) => {
              const bdr = r.lvl === 'Critical' ? 'border-red-500/20 bg-red-500/5' : r.lvl === 'High' ? 'border-orange-500/20 bg-orange-500/5' : r.lvl === 'Moderate' ? 'border-amber-500/20 bg-amber-500/5' : 'border-emerald-500/20 bg-emerald-500/5'
              return (
                <div key={i} className={`rounded-xl border p-4 ${bdr}`}>
                  <div className="text-[9px] font-semibold text-slate-500 uppercase tracking-widest mb-2">{r.l}</div>
                  <div className="flex items-end justify-between">
                    <RiskChip level={r.lvl} />
                    <span className="text-2xl font-black text-slate-200">{r.s ?? '—'}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Company Profile */}
      {res.company_profile && (
        <div>
          <SectionTitle>Company Profile</SectionTitle>
          <div className="bg-[#1a2035] border border-[#1e293b] rounded-xl p-4 space-y-3">
            <p className="text-sm text-slate-300 leading-relaxed">{res.company_profile.description}</p>
            <div className="flex flex-wrap gap-2">
              {res.company_profile.year_established && <span className="text-[10px] bg-[#111827] border border-[#1e293b] px-2.5 py-1 rounded-full text-slate-400">📅 Est. {res.company_profile.year_established}</span>}
              {res.company_profile.employee_count_estimate && <span className="text-[10px] bg-[#111827] border border-[#1e293b] px-2.5 py-1 rounded-full text-slate-400">👥 {res.company_profile.employee_count_estimate}</span>}
              {res.company_profile.annual_revenue_estimate && <span className="text-[10px] bg-[#111827] border border-[#1e293b] px-2.5 py-1 rounded-full text-slate-400">💰 {res.company_profile.annual_revenue_estimate}</span>}
              {res.company_profile.business_areas?.map((a, i) => <span key={i} className="text-[10px] bg-[#111827] border border-[#1e293b] px-2.5 py-1 rounded-full text-slate-400">🏢 {a}</span>)}
            </div>
          </div>
        </div>
      )}

      {/* Key Concerns + Positives */}
      {res.risk_summary && (res.risk_summary.key_concerns?.length > 0 || res.risk_summary.positive_factors?.length > 0) && (
        <div className="grid grid-cols-2 gap-4">
          {res.risk_summary.key_concerns?.length > 0 && (
            <div>
              <SectionTitle>Key Concerns</SectionTitle>
              {res.risk_summary.key_concerns.map((c, i) => (
                <div key={i} className="flex items-start gap-2 mb-2">
                  <span className="text-red-400 mt-0.5 flex-shrink-0">⚠</span>
                  <p className="text-xs text-slate-400 leading-relaxed">{c}</p>
                </div>
              ))}
            </div>
          )}
          {res.risk_summary.positive_factors?.length > 0 && (
            <div>
              <SectionTitle>Positive Signals</SectionTitle>
              {res.risk_summary.positive_factors.map((f, i) => (
                <div key={i} className="flex items-start gap-2 mb-2">
                  <span className="text-emerald-400 mt-0.5 flex-shrink-0">✓</span>
                  <p className="text-xs text-slate-400 leading-relaxed">{f}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Tab: Network ──────────────────────────────────────────────────────────────

function M2Network({ res }: { res: ResearchResult | null }) {
  if (!res?.promoter_network?.length) {
    return (
      <div className="flex flex-col items-center justify-center h-72 select-none">
        <div className="text-5xl mb-4 opacity-20">🕸</div>
        <p className="text-sm text-slate-500">No network data found</p>
      </div>
    )
  }
  return (
    <div className="space-y-5 anim-fade-up">
      <SectionTitle>Promoter Network Graph</SectionTitle>
      <NetworkGraph data={res.promoter_network} company={res.company_name} />
      <div className="flex flex-wrap gap-3 text-[10px]">
        {[
          { c: 'bg-blue-500',    l: 'Target Company'   },
          { c: 'bg-violet-500',  l: 'Person'           },
          { c: 'bg-emerald-500', l: 'Active Company'   },
          { c: 'bg-red-500',     l: 'Flagged Entity'   },
          { c: 'bg-amber-500',   l: 'Defunct / Strike-off' },
        ].map(x => (
          <div key={x.l} className="flex items-center gap-1.5 text-slate-400">
            <div className={`w-2 h-2 rounded-full ${x.c}`} />{x.l}
          </div>
        ))}
      </div>
      <SectionTitle>Entity List ({res.promoter_network.length})</SectionTitle>
      {res.promoter_network.map((e, i) => (
        <div key={i} className={`flex items-start gap-3 bg-[#1a2035] rounded-xl border p-3.5 mb-2 ${e.risk_flag ? 'border-red-500/30' : 'border-[#1e293b]'}`}>
          <span className="text-xl flex-shrink-0">{e.entity_type === 'person' ? '👤' : '🏢'}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-sm font-semibold text-slate-200">{e.entity_name}</span>
              {e.risk_flag && <span className="text-[9px] font-bold px-1.5 py-0.5 bg-red-500/10 text-red-400 rounded-full">FLAGGED</span>}
              <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${e.status === 'active' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-700 text-slate-400'}`}>{e.status}</span>
            </div>
            <p className="text-xs text-slate-500">{e.relationship} → {e.connection_to}</p>
            <p className="text-xs text-slate-600 mt-1">{e.details}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Tab: Promoters ────────────────────────────────────────────────────────────

function M2Promoters({ res }: { res: ResearchResult | null }) {
  const cr = res?.corporate_registry
  if (!cr?.directors?.length) {
    return (
      <div className="flex flex-col items-center justify-center h-72 select-none">
        <Users size={40} className="text-slate-700 mb-4" />
        <p className="text-sm text-slate-500">No director data found</p>
      </div>
    )
  }
  return (
    <div className="space-y-4 anim-fade-up">
      <div className="bg-[#1a2035] border border-[#1e293b] rounded-xl p-4">
        <SectionTitle>Corporate Registry</SectionTitle>
        <div className="flex flex-wrap gap-2">
          {cr.registration_number && <span className="text-[10px] bg-[#111827] border border-[#1e293b] px-2.5 py-1 rounded-full text-slate-400">CIN: {cr.registration_number}</span>}
          {cr.date_of_incorporation && <span className="text-[10px] bg-[#111827] border border-[#1e293b] px-2.5 py-1 rounded-full text-slate-400">📅 {cr.date_of_incorporation}</span>}
          {cr.authorized_capital && <span className="text-[10px] bg-[#111827] border border-[#1e293b] px-2.5 py-1 rounded-full text-slate-400">Auth: {cr.authorized_capital}</span>}
          {cr.paid_up_capital && <span className="text-[10px] bg-[#111827] border border-[#1e293b] px-2.5 py-1 rounded-full text-slate-400">Paid-up: {cr.paid_up_capital}</span>}
        </div>
        {cr.compliance_status && (
          <div className="flex gap-3 mt-3 flex-wrap">
            <span className={`text-[10px] px-2.5 py-1 rounded-full border ${cr.compliance_status.annual_returns_filed ? 'border-emerald-500/20 text-emerald-400' : 'border-red-500/20 text-red-400'}`}>{cr.compliance_status.annual_returns_filed ? '✓' : '✗'} Annual Returns</span>
            <span className={`text-[10px] px-2.5 py-1 rounded-full border ${cr.compliance_status.financial_statements_filed ? 'border-emerald-500/20 text-emerald-400' : 'border-red-500/20 text-red-400'}`}>{cr.compliance_status.financial_statements_filed ? '✓' : '✗'} Financial Statements</span>
            {cr.compliance_status.any_defaults && <span className="text-[10px] px-2.5 py-1 rounded-full border border-red-500/20 text-red-400">⚠ Defaults Noted</span>}
          </div>
        )}
      </div>
      <SectionTitle>Directors & Promoters</SectionTitle>
      {cr.directors.map((d, i) => (
        <div key={i} className="bg-[#1a2035] border border-[#1e293b] rounded-xl p-4 mb-3">
          <div className="flex items-center justify-between mb-1.5">
            <div className="font-semibold text-sm text-slate-200">{d.name}</div>
            <span className="text-[10px] text-slate-500 bg-[#111827] px-2.5 py-0.5 rounded-full border border-[#1e293b]">DIN: {d.din}</span>
          </div>
          <p className="text-xs text-slate-500 mb-3">{d.designation} · Appointed {d.appointment_date}</p>
          {d.other_directorships?.length ? (
            <>
              <div className="text-[9px] font-bold text-slate-600 uppercase tracking-widest mb-2">Other Directorships ({d.other_directorships.length})</div>
              {d.other_directorships.map((od, j) => (
                <div key={j} className="flex items-center justify-between py-1.5 border-b border-[#1e293b]/50 last:border-0">
                  <span className="text-xs text-slate-400">{od.company_name}</span>
                  <span className={`text-[9px] px-2 py-0.5 rounded-full ${od.status === 'active' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-700 text-slate-500'}`}>{od.status}</span>
                </div>
              ))}
            </>
          ) : null}
        </div>
      ))}
    </div>
  )
}

// ── Tab: Litigation ───────────────────────────────────────────────────────────

function M2Litigation({ res }: { res: ResearchResult | null }) {
  const lits = res?.litigation_records || []
  if (!lits.length) {
    return (
      <div className="flex flex-col items-center justify-center h-72 select-none">
        <Scale size={40} className="text-slate-700 mb-4" />
        <p className="text-sm text-slate-500">No litigation records found</p>
      </div>
    )
  }
  const lBdr: Record<string, string> = { high: 'border-l-red-500', medium: 'border-l-amber-500', low: 'border-l-emerald-500' }
  return (
    <div className="space-y-3 anim-fade-up">
      <SectionTitle>Litigation & Legal Records ({lits.length})</SectionTitle>
      {lits.map((l, i) => (
        <div key={i} className={`bg-[#1a2035] rounded-xl border-l-4 border border-[#1e293b] p-4 ${lBdr[l.severity] || lBdr.medium}`}>
          <div className="flex items-center justify-between mb-2">
            <div className="font-semibold text-sm text-slate-200">⚖ {l.case_type}</div>
            <RiskChip level={l.severity} />
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1 mb-2 text-[10px] text-slate-500">
            <span>🏛 {l.court}</span>
            <span>📅 {l.date_filed}</span>
            {l.claim_amount && <span>💰 {l.claim_amount}</span>}
            <span>📌 {l.status}</span>
          </div>
          {l.parties && <p className="text-[10px] text-slate-600 mb-2">{l.parties}</p>}
          <p className="text-xs text-slate-400 leading-relaxed">{l.summary}</p>
        </div>
      ))}
    </div>
  )
}

// ── Tab: News ─────────────────────────────────────────────────────────────────

function M2News({ res }: { res: ResearchResult | null }) {
  const news = res?.news_intelligence || []
  if (!news.length) {
    return (
      <div className="flex flex-col items-center justify-center h-72 select-none">
        <Newspaper size={40} className="text-slate-700 mb-4" />
        <p className="text-sm text-slate-500">No news intelligence found</p>
      </div>
    )
  }
  const sent: Record<string, string> = {
    positive: 'bg-emerald-500/10 text-emerald-400',
    negative: 'bg-red-500/10 text-red-400',
    neutral:  'bg-slate-700 text-slate-400',
  }
  return (
    <div className="space-y-3 anim-fade-up">
      <SectionTitle>News Intelligence ({news.length})</SectionTitle>
      {news.map((n, i) => (
        <div key={i} className="bg-[#1a2035] border border-[#1e293b] rounded-xl p-4">
          <p className="font-semibold text-sm text-slate-200 mb-1.5 leading-snug">{n.headline}</p>
          <div className="flex items-center gap-2 mb-2 text-[10px] text-slate-500">
            <span>📰 {n.source}</span><span>·</span><span>📅 {n.date}</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed mb-3">{n.summary}</p>
          <div className="flex flex-wrap gap-2">
            <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full ${sent[n.sentiment] || sent.neutral}`}>{n.sentiment}</span>
            <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full ${n.impact === 'high' ? 'bg-orange-500/10 text-orange-400' : n.impact === 'medium' ? 'bg-amber-500/10 text-amber-400' : 'bg-slate-700 text-slate-400'}`}>Impact: {n.impact}</span>
            <span className="text-[9px] px-2 py-0.5 rounded-full bg-slate-700/50 text-slate-500">{n.risk_category}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Tab: Alerts ───────────────────────────────────────────────────────────────

function M2Alerts({ res }: { res: ResearchResult | null }) {
  const signals = res?.risk_signals || []
  const alerts = res?.alerts || []
  if (!signals.length && !alerts.length) {
    return (
      <div className="flex flex-col items-center justify-center h-72 select-none">
        <Bell size={40} className="text-slate-700 mb-4" />
        <p className="text-sm text-slate-500">No risk signals detected</p>
      </div>
    )
  }
  const sigBdr: Record<string, string> = { high: 'border-red-500/20', medium: 'border-amber-500/20', low: 'border-emerald-500/20' }
  return (
    <div className="space-y-4 anim-fade-up">
      {alerts.length > 0 && (
        <div>
          <SectionTitle>Key Alerts</SectionTitle>
          {alerts.map((a, i) => (
            <div key={i} className="flex items-start gap-2.5 bg-red-500/5 border border-red-500/20 rounded-xl p-3.5 mb-2">
              <AlertTriangle size={13} className="text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-slate-300 leading-relaxed">{a}</p>
            </div>
          ))}
        </div>
      )}
      {signals.length > 0 && (
        <div>
          <SectionTitle>Risk Signals ({signals.length})</SectionTitle>
          {signals.map((s, i) => (
            <div key={i} className={`bg-[#1a2035] rounded-xl border p-4 mb-3 ${sigBdr[s.severity] || 'border-[#1e293b]'}`}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-slate-200 leading-snug flex-1 pr-3">{s.signal}</p>
                <RiskChip level={s.severity} />
              </div>
              <span className="text-[9px] bg-slate-700/50 text-slate-400 px-2 py-0.5 rounded-full">{s.category}</span>
              <p className="text-xs text-slate-500 mt-2 leading-relaxed">{s.evidence}</p>
              <p className="text-xs text-slate-400 mt-2 pt-2 border-t border-[#1e293b]/50">💡 {s.recommendation}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

const TABS = [
  { id: 'overview',   label: 'Overview'    },
  { id: 'network',    label: 'Network'     },
  { id: 'promoters',  label: 'Promoters'   },
  { id: 'litigation', label: 'Litigation'  },
  { id: 'news',       label: 'News Signals'},
  { id: 'alerts',     label: 'Alerts'      },
]

export default function Module2() {
  const [activeTab, setActiveTab] = useState('overview')
  const [companyName, setCompanyName] = useState('')
  const [promoters, setPromoters] = useState('')
  const [directors, setDirectors] = useState('')
  const [industry, setIndustry] = useState('')
  const [location, setLocation] = useState('')
  const [observations, setObservations] = useState('')
  const [researching, setResearching] = useState(false)
  const [progress, setProgress] = useState(0)
  const [progressText, setProgressText] = useState('')
  const [apiOnline, setApiOnline] = useState<boolean | null>(null)
  const [searchingCompany, setSearchingCompany] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const { m1Analysis, m2Research, setM2Research, addToast } = useAppStore()

  useEffect(() => {
    api.m2Health()
      .then(h => setApiOnline(h.status === 'healthy' || !!h.gemini_configured))
      .catch(() => setApiOnline(false))
  }, [])

  async function handleImport() {
    const ctx: string[] = []

    if (m1Analysis) {
      if (m1Analysis.company_name) setCompanyName(m1Analysis.company_name)
      const cf = m1Analysis.consolidated_financials
      if (cf?.revenue) ctx.push(`Revenue: ₹${cf.revenue} Cr`)
      if (cf?.profit) ctx.push(`Net Profit: ₹${cf.profit} Cr`)
      if (cf?.total_debt) ctx.push(`Total Debt: ₹${cf.total_debt} Cr`)
      if (m1Analysis.financial_ratios?.overall_health) {
        ctx.push(`Financial Health: ${m1Analysis.financial_ratios.overall_health}`)
      }
      if (m1Analysis.cross_verification?.deviation_percentage) {
        ctx.push(`GST-Bank Deviation: ${m1Analysis.cross_verification.deviation_percentage}%`)
      }
      if (m1Analysis.risk_alerts?.length) {
        ctx.push(`Risk Alerts: ${m1Analysis.risk_alerts.map(a => a.description).join('; ')}`)
      }
    } else {
      try {
        const consolidated = await api.getConsolidated()
        const data = consolidated.data as Record<string, unknown>
        const company = (data.company_name as string | undefined) || ''
        if (company) setCompanyName(company)
        const revenue = data.revenue as number | undefined
        const profit = data.profit as number | undefined
        const debt = data.total_debt as number | undefined
        if (revenue != null) ctx.push(`Revenue: ₹${revenue} Cr`)
        if (profit != null) ctx.push(`Net Profit: ₹${profit} Cr`)
        if (debt != null) ctx.push(`Total Debt: ₹${debt} Cr`)
      } catch {
        addToast('No Module 1 details available yet. Upload and analyze documents first.', 'warning')
        return
      }
    }

    if (ctx.length) setObservations(ctx.join('\n'))
    addToast('Module 1 details imported', 'success')
  }

  async function handleOnlineSearch() {
    if (!companyName.trim()) {
      addToast('Enter a company name to search online', 'warning')
      return
    }

    setSearchingCompany(true)
    try {
      const result = await api.m2SearchCompany(companyName.trim())
      const d = result.data
      if (d.company_name) setCompanyName(d.company_name)
      if (d.industry) setIndustry(d.industry)
      if (d.location) setLocation(d.location)
      if (d.promoters?.length) setPromoters(d.promoters.join(', '))
      if (d.directors?.length) setDirectors(d.directors.join(', '))
      if (d.summary) {
        setObservations(prev => (prev ? `${prev}\n\nOnline Summary:\n${d.summary}` : `Online Summary:\n${d.summary}`))
      }
      addToast('Company details fetched online', 'success')
    } catch (e: unknown) {
      addToast(`Online search failed: ${(e as Error).message}`, 'error')
    } finally {
      setSearchingCompany(false)
    }
  }

  async function handleResearch() {
    if (!companyName.trim()) { addToast('Company name is required', 'error'); return }
    if (researching) return
    setResearching(true); setProgress(5)
    const steps = [
      'Initialising research agent…', 'Normalising entity names…',
      'Searching news intelligence…', 'Scanning litigation records…',
      'Querying corporate registry…', 'Mapping promoter network…',
      'Analysing industry signals…', 'Detecting risk signals…',
      'Computing risk scores…',
    ]
    let si = 0
    timerRef.current = setInterval(() => {
      setProgress(p => Math.min(p + Math.random() * 11, 92))
      setProgressText(steps[Math.min(si++, steps.length - 1)])
    }, 1800)
    try {
      const payload: ResearchInput = {
        company_name: companyName.trim(),
        promoters:            promoters.trim()    || undefined,
        directors:            directors.trim()    || undefined,
        industry:             industry.trim()     || undefined,
        location:             location.trim()     || undefined,
        manual_observations:  observations.trim() || undefined,
      }
      const result = await api.m2Research(payload)
      clearInterval(timerRef.current!)
      setProgress(100); setProgressText('Research complete!')
      if (result.success && result.data) {
        setM2Research(result.data)
        setActiveTab('overview')
        addToast(`Research completed for ${companyName}`, 'success')
      } else {
        addToast(result.message || 'Research returned no data', 'warning')
      }
    } catch (e: unknown) {
      clearInterval(timerRef.current!)
      addToast(`Research failed: ${(e as Error).message}`, 'error')
    } finally {
      setResearching(false)
      setTimeout(() => { setProgress(0); setProgressText('') }, 2000)
    }
  }

  async function handleReset() {
    if (!confirm('Reset Module 2 data?')) return
    try {
      await api.m2Reset()
      setM2Research(null)
      setCompanyName(''); setPromoters(''); setDirectors('')
      setIndustry(''); setLocation(''); setObservations('')
      addToast('Module 2 reset', 'info')
    } catch (e: unknown) { addToast(`Reset failed: ${(e as Error).message}`, 'error') }
  }

  function buildModule2Sections() {
    return [
      {
        heading: 'Input Context',
        content: {
          companyName,
          promoters,
          directors,
          industry,
          location,
          observations,
        },
      },
      {
        heading: 'Research Result',
        content: m2Research,
      },
    ]
  }

  function handleDownloadDoc() {
    if (!m2Research) {
      addToast('Run Module 2 research before downloading report.', 'warning')
      return
    }
    downloadDocReport('Module 2 Research Report', buildModule2Sections(), 'module2-research')
    addToast('Module 2 DOC downloaded', 'success')
  }

  function handleDownloadPdf() {
    if (!m2Research) {
      addToast('Run Module 2 research before downloading report.', 'warning')
      return
    }
    downloadPdfReport('Module 2 Research Report', buildModule2Sections(), 'module2-research')
    addToast('Module 2 PDF downloaded', 'success')
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">

      {/* ── Header ── */}
      <header className="flex-shrink-0 flex items-center justify-between px-6 py-3.5 border-b border-[#1e293b]"
        style={{ background: 'rgba(7,9,18,0.85)', backdropFilter: 'blur(12px)' }}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
            <Search size={15} className="text-violet-400" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-200">Module 2 — Research Agent</h1>
            <p className="text-[10px] text-slate-500">Digital Credit Investigator · Gemini LLM</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className={`flex items-center gap-1.5 text-[10px] px-3 py-1.5 rounded-full border ${apiOnline === null ? 'border-slate-700 text-slate-500' : apiOnline ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-400' : 'border-red-500/20 bg-red-500/5 text-red-400'}`}>
            <div className={`w-1.5 h-1.5 rounded-full dot-pulse ${apiOnline === null ? 'bg-slate-500' : apiOnline ? 'bg-emerald-400' : 'bg-red-400'}`} />
            {apiOnline === null ? 'Checking…' : apiOnline ? 'Gemini Ready' : 'Not Configured'}
          </div>
          <button
            onClick={handleDownloadDoc}
            disabled={!m2Research}
            className="flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-cyan-300 bg-[#111827] border border-[#1e293b] hover:border-cyan-500/30 px-3 py-1.5 rounded-lg transition-all disabled:opacity-40"
          >
            <Download size={12} /> DOC
          </button>
          <button
            onClick={handleDownloadPdf}
            disabled={!m2Research}
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
      <div className="flex flex-1 overflow-hidden">

        {/* Left Panel — Form */}
        <aside className="w-[300px] flex-shrink-0 border-r border-[#1e293b] flex flex-col overflow-y-auto" style={{ background: '#070912' }}>

          {/* Import Banner */}
          <div className="m-4 bg-blue-500/5 border border-blue-500/20 rounded-xl p-3 anim-fade-up">
            <div className="text-[10px] font-semibold text-blue-400 mb-1">Import from Module 1</div>
            <p className="text-[10px] text-slate-500 mb-2.5 leading-relaxed">
              Pull consolidated financial context from Module 1 to pre-fill observations.
            </p>
            <button onClick={handleImport}
              className="flex items-center gap-1.5 text-[11px] font-semibold text-blue-400 bg-blue-500/10 hover:bg-blue-500/15 border border-blue-500/20 px-3 py-1.5 rounded-lg transition-all w-full justify-center">
              <Download size={12} /> Import Module 1 Details
            </button>
          </div>

          {/* Form */}
          <div className="px-4 pb-6 space-y-4 flex-1">
            <div className="text-[9px] font-bold text-slate-600 uppercase tracking-widest pt-2">Company Details</div>

            <div>
              <label className="text-[9px] font-semibold text-slate-500 uppercase tracking-widest block mb-1.5">
                Company Name <span className="text-red-400">*</span>
              </label>
              <input type="text" value={companyName} onChange={e => setCompanyName(e.target.value)}
                placeholder="e.g. ABC Industries Pvt Ltd"
                className="w-full bg-[#111827] border border-[#1e293b] focus:border-violet-500/50 text-slate-300 text-xs rounded-xl px-3 py-2.5 outline-none transition-colors placeholder:text-slate-700" />
              <button
                onClick={handleOnlineSearch}
                disabled={searchingCompany}
                className="mt-2 w-full flex items-center justify-center gap-2 text-[11px] font-semibold text-cyan-300 bg-cyan-500/10 hover:bg-cyan-500/15 border border-cyan-500/20 px-3 py-1.5 rounded-lg transition-all disabled:opacity-50"
              >
                <Search size={12} />
                {searchingCompany ? 'Searching Online...' : 'Search Company Online'}
              </button>
            </div>

            <div>
              <label className="text-[9px] font-semibold text-slate-500 uppercase tracking-widest block mb-1.5">Promoters <span className="text-slate-700">(comma-separated)</span></label>
              <input type="text" value={promoters} onChange={e => setPromoters(e.target.value)}
                placeholder="e.g. Ratan Tata, Noel Tata"
                className="w-full bg-[#111827] border border-[#1e293b] focus:border-violet-500/50 text-slate-300 text-xs rounded-xl px-3 py-2.5 outline-none transition-colors placeholder:text-slate-700" />
            </div>

            <div>
              <label className="text-[9px] font-semibold text-slate-500 uppercase tracking-widest block mb-1.5">Directors <span className="text-slate-700">(comma-separated)</span></label>
              <input type="text" value={directors} onChange={e => setDirectors(e.target.value)}
                placeholder="e.g. Director A, Director B"
                className="w-full bg-[#111827] border border-[#1e293b] focus:border-violet-500/50 text-slate-300 text-xs rounded-xl px-3 py-2.5 outline-none transition-colors placeholder:text-slate-700" />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[9px] font-semibold text-slate-500 uppercase tracking-widest block mb-1.5">Industry</label>
                <input type="text" value={industry} onChange={e => setIndustry(e.target.value)} placeholder="e.g. Textile"
                  className="w-full bg-[#111827] border border-[#1e293b] focus:border-violet-500/50 text-slate-300 text-xs rounded-xl px-3 py-2.5 outline-none transition-colors placeholder:text-slate-700" />
              </div>
              <div>
                <label className="text-[9px] font-semibold text-slate-500 uppercase tracking-widest block mb-1.5">Location</label>
                <input type="text" value={location} onChange={e => setLocation(e.target.value)} placeholder="e.g. Mumbai"
                  className="w-full bg-[#111827] border border-[#1e293b] focus:border-violet-500/50 text-slate-300 text-xs rounded-xl px-3 py-2.5 outline-none transition-colors placeholder:text-slate-700" />
              </div>
            </div>

            <div>
              <label className="text-[9px] font-semibold text-slate-500 uppercase tracking-widest block mb-1.5">Observations / Context</label>
              <textarea value={observations} onChange={e => setObservations(e.target.value)} rows={4}
                placeholder="Field observations, financial context from Module 1…"
                className="w-full bg-[#111827] border border-[#1e293b] focus:border-violet-500/50 text-slate-300 text-xs rounded-xl px-3 py-2.5 outline-none transition-colors placeholder:text-slate-700 resize-none" />
            </div>

            <button onClick={handleResearch} disabled={researching}
              className="w-full flex items-center justify-center gap-2 text-white text-sm font-semibold py-2.5 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-violet-500/20"
              style={{ background: 'linear-gradient(135deg,#7c3aed,#6d28d9)' }}>
              {researching ? <><span className="spinner" /> Researching…</> : <><Search size={15} /> Start Research</>}
            </button>

            {progress > 0 && (
              <div className="anim-fade-up">
                <div className="h-1 bg-[#1a2035] rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${progress}%`, background: 'linear-gradient(90deg,#7c3aed,#3b82f6)' }} />
                </div>
                <p className="text-[10px] text-slate-500 mt-1.5 text-center">{progressText}</p>
              </div>
            )}
          </div>
        </aside>

        {/* Right Panel — Results */}
        <div className="flex-1 flex flex-col overflow-hidden" style={{ background: '#0a0e1a' }}>
          {/* Tabs */}
          <div className="flex-shrink-0 flex items-center gap-1 px-6 pt-4 pb-0 border-b border-[#1e293b] overflow-x-auto">
            {TABS.map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-all duration-150 whitespace-nowrap ${activeTab === tab.id ? 'text-violet-400 border-violet-400' : 'text-slate-600 border-transparent hover:text-slate-400'}`}>
                {tab.label}
              </button>
            ))}
          </div>
          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {activeTab === 'overview'   && <M2Overview   res={m2Research} />}
            {activeTab === 'network'    && <M2Network    res={m2Research} />}
            {activeTab === 'promoters'  && <M2Promoters  res={m2Research} />}
            {activeTab === 'litigation' && <M2Litigation res={m2Research} />}
            {activeTab === 'news'       && <M2News       res={m2Research} />}
            {activeTab === 'alerts'     && <M2Alerts     res={m2Research} />}
          </div>
        </div>

      </div>
    </div>
  )
}
