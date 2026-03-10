import { useAppStore } from '../../store'
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react'

const CFG = {
  success: { bg: 'bg-emerald-600', Icon: CheckCircle },
  error:   { bg: 'bg-red-600',     Icon: AlertCircle  },
  warning: { bg: 'bg-amber-600',   Icon: AlertTriangle },
  info:    { bg: 'bg-blue-600',    Icon: Info          },
} as const

export default function ToastContainer() {
  const { toasts, removeToast } = useAppStore()

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => {
        const { bg, Icon } = CFG[t.type]
        return (
          <div
            key={t.id}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl text-white text-sm font-medium shadow-2xl pointer-events-auto toast-in max-w-sm ${bg}`}
          >
            <Icon size={15} className="flex-shrink-0" />
            <span className="flex-1">{t.message}</span>
            <button
              onClick={() => removeToast(t.id)}
              className="opacity-60 hover:opacity-100 transition-opacity ml-1 flex-shrink-0"
            >
              <X size={13} />
            </button>
          </div>
        )
      })}
    </div>
  )
}
