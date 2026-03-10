import { useAppStore } from '../store'
import { FileText, Search, BarChart3, Zap } from 'lucide-react'

const MODULES = [
  { id: 'module1' as const, num: '01', label: 'Data Ingestor',         icon: FileText,  available: true  },
  { id: 'module2' as const, num: '02', label: 'Research Agent',        icon: Search,    available: true  },
  { id: 'module3' as const, num: '03', label: 'Risk Engine',           icon: BarChart3, available: true  },
]

export default function Sidebar() {
  const { activeModule, setActiveModule } = useAppStore()

  return (
    <aside className="w-[250px] flex-shrink-0 border-r border-white/10 bg-[#050b1e]/70 flex flex-col h-full backdrop-blur-xl">

      {/* Brand */}
      <div className="p-5 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex-shrink-0 flex items-center justify-center shadow-lg"
            style={{ background: 'linear-gradient(140deg,#4f9cf9,#6c7cff)' }}
          >
            <Zap size={16} className="text-white" />
          </div>
          <div>
            <div
              className="font-bold text-[13px] tracking-tight text-slate-100"
              style={{ fontFamily: '"SF Pro Display", "Inter", sans-serif' }}
            >
              Credere AI
            </div>
            <div className="text-[10px] text-slate-400">Credit Intelligence</div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3.5 overflow-y-auto">
        <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest px-2 mb-3">
          Modules
        </div>
        <div className="flex flex-col gap-2">
          {MODULES.map(mod => {
            const Icon = mod.icon
            const active = activeModule === mod.id
            return (
              <button
                key={mod.id}
                onClick={() => mod.available && setActiveModule(mod.id)}
                disabled={!mod.available}
                className={[
                  'w-full text-left px-3 py-3 rounded-2xl flex items-center gap-3 transition-all duration-200',
                  active
                    ? 'bg-white/10 border border-cyan-300/30 text-cyan-200 shadow-md'
                    : mod.available
                      ? 'text-slate-400 hover:text-slate-100 hover:bg-white/[0.06] border border-white/0'
                      : 'text-slate-700 cursor-not-allowed border border-white/0',
                ].join(' ')}
              >
                <div className={`h-8 w-8 rounded-xl border flex items-center justify-center ${active ? 'border-cyan-300/40 bg-cyan-400/10' : 'border-white/10 bg-white/5'}`}>
                  <Icon size={14} className={active ? 'text-cyan-200' : 'text-slate-400'} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[9px] font-medium opacity-70 mb-0.5">Module {mod.num}</div>
                  <div className="text-[12px] font-semibold truncate">{mod.label}</div>
                </div>
                {!mod.available && (
                  <span className="text-[9px] font-medium bg-slate-800 text-slate-600 px-1.5 py-0.5 rounded-full">
                    Soon
                  </span>
                )}
                {active && (
                  <div className="w-1 h-4 rounded-full bg-cyan-300 flex-shrink-0" />
                )}
              </button>
            )
          })}
        </div>
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-white/10">
        <div className="text-[10px] text-slate-500 text-center">v2.0 · Gemini Powered</div>
      </div>
    </aside>
  )
}
