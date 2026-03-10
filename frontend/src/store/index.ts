import { create } from 'zustand'
import type {
  Document, FullAnalysis, CompletenessReport, ExtractionResult,
  ResearchResult, Toast, Module3ScoreData,
} from '../types'

interface AppState {
  // Active module
  activeModule: 'module1' | 'module2' | 'module3'
  setActiveModule: (m: 'module1' | 'module2' | 'module3') => void

  // Module 1
  m1Documents: Document[]
  m1LastExtraction: ExtractionResult | null
  m1Analysis: FullAnalysis | null
  m1Completeness: CompletenessReport | null
  setM1Documents: (d: Document[]) => void
  setM1LastExtraction: (e: ExtractionResult | null) => void
  setM1Analysis: (a: FullAnalysis | null) => void
  setM1Completeness: (c: CompletenessReport | null) => void

  // Module 2
  m2Research: ResearchResult | null
  setM2Research: (r: ResearchResult | null) => void

  // Module 3
  m3Result: Module3ScoreData | null
  setM3Result: (r: Module3ScoreData | null) => void

  // Toasts
  toasts: Toast[]
  addToast: (message: string, type: Toast['type']) => void
  removeToast: (id: string) => void
}

export const useAppStore = create<AppState>((set) => ({
  activeModule: 'module1',
  setActiveModule: (activeModule) => set({ activeModule }),

  m1Documents: [],
  m1LastExtraction: null,
  m1Analysis: null,
  m1Completeness: null,
  setM1Documents: (m1Documents) => set({ m1Documents }),
  setM1LastExtraction: (m1LastExtraction) => set({ m1LastExtraction }),
  setM1Analysis: (m1Analysis) => set({ m1Analysis }),
  setM1Completeness: (m1Completeness) => set({ m1Completeness }),

  m2Research: null,
  setM2Research: (m2Research) => set({ m2Research }),

  m3Result: null,
  setM3Result: (m3Result) => set({ m3Result }),

  toasts: [],
  addToast: (message, type) => {
    const id = Math.random().toString(36).slice(2)
    set(s => ({ toasts: [...s.toasts, { id, message, type }] }))
    setTimeout(() => set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })), 4500)
  },
  removeToast: (id) => set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })),
}))
