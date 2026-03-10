import { ArrowRight, ShieldCheck, Sparkles, Cpu, Building2 } from 'lucide-react'

interface LandingPageProps {
  onGetStarted: () => void
}

const HIGHLIGHTS = [
  {
    icon: ShieldCheck,
    title: 'Explainable Credit Decisions',
    text: 'Every score is backed by transparent factors, weighted logic, and traceable evidence.',
  },
  {
    icon: Cpu,
    title: 'Modular Intelligence Stack',
    text: 'Data ingestion, research intelligence, and risk scoring work together in one workflow.',
  },
  {
    icon: Building2,
    title: 'Built For Enterprise Teams',
    text: 'Designed for analysts, risk officers, and underwriting teams at lending institutions.',
  },
]

const WORKFLOW = [
  {
    step: '01',
    title: 'Ingest Financial Docs',
    text: 'Upload statements, GST filings, and reports to extract structured borrower data.',
  },
  {
    step: '02',
    title: 'Run External Research',
    text: 'Generate company intelligence, legal signals, and promoter network risk indicators.',
  },
  {
    step: '03',
    title: 'Score & Stress Test',
    text: 'Compute weighted risk score, inspect factor impact, and evaluate stress scenarios.',
  },
]

export default function LandingPage({ onGetStarted }: LandingPageProps) {
  return (
    <div className="relative h-screen overflow-hidden bg-[#030917] text-slate-100">
      <div className="pointer-events-none absolute -top-36 left-1/4 h-96 w-96 -translate-x-1/2 rounded-full bg-cyan-400/20 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 top-1/3 h-96 w-96 rounded-full bg-indigo-500/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-blue-500/15 blur-3xl" />

      <div className="relative mx-auto flex h-full max-w-7xl flex-col px-6 py-8 lg:px-12">
        <header className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-3 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 to-indigo-500 shadow-lg">
              <Sparkles size={16} className="text-white" />
            </div>
            <div>
              <div
                className="text-sm font-semibold text-slate-100"
                style={{ fontFamily: '"SF Pro Display", "Inter", sans-serif' }}
              >
                Credere AI
              </div>
              <div className="text-[11px] text-slate-400">Credit Intelligence Platform</div>
            </div>
          </div>
          <button
            onClick={onGetStarted}
            className="rounded-xl border border-cyan-300/30 bg-cyan-400/10 px-4 py-2 text-xs font-semibold text-cyan-200 transition-all hover:bg-cyan-400/20"
          >
            Enter Workspace
          </button>
        </header>

        <section className="flex flex-1 flex-col items-center justify-center py-12 text-center">
          <span className="mb-5 rounded-full border border-cyan-300/25 bg-cyan-400/10 px-4 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-200">
            AI Credit Operating System
          </span>

          <h1
            className="max-w-5xl text-4xl font-semibold leading-tight text-slate-100 sm:text-5xl lg:text-6xl"
            style={{ fontFamily: '"SF Pro Display", "Inter", sans-serif', letterSpacing: '-0.02em' }}
          >
            Financial Intelligence for
            <br />
            Modern Credit Decisions
          </h1>

          <p className="mt-6 max-w-3xl text-sm leading-relaxed text-slate-300 sm:text-base">
            Analyze borrower documents, discover external risk signals, and generate explainable
            credit risk scores through a unified three-module workflow.
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={onGetStarted}
              className="group inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-400 to-blue-500 px-6 py-3 text-sm font-semibold text-white shadow-xl shadow-cyan-500/25 transition-all hover:scale-[1.02]"
            >
              Get Started
              <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
            </button>
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-xs text-slate-300">
              Module 01: Data Ingestor · Module 02: Research Agent · Module 03: Risk Engine
            </div>
          </div>
        </section>

        <section className="grid gap-3 pb-4 sm:grid-cols-3">
          {HIGHLIGHTS.map((item) => {
            const Icon = item.icon
            return (
              <div
                key={item.title}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-left backdrop-blur-xl"
              >
                <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-400/10 text-cyan-200">
                  <Icon size={15} />
                </div>
                <h3 className="text-sm font-semibold text-slate-100">{item.title}</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-400">{item.text}</p>
              </div>
            )
          })}
        </section>

        <section className="mt-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-xl">
          <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
            Credit Workflow
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {WORKFLOW.map((w) => (
              <div key={w.step} className="rounded-xl border border-white/10 bg-[#091127] p-3">
                <div className="mb-2 inline-flex rounded-md border border-cyan-400/30 bg-cyan-400/10 px-2 py-1 text-[10px] font-semibold text-cyan-200">
                  Step {w.step}
                </div>
                <h4 className="text-sm font-semibold text-slate-100">{w.title}</h4>
                <p className="mt-1 text-xs leading-relaxed text-slate-400">{w.text}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
