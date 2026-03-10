import { useState } from 'react'
import { useAppStore } from './store'
import Sidebar from './components/Sidebar'
import Module1 from './components/modules/Module1'
import Module2 from './components/modules/Module2'
import Module3 from './components/modules/Module3'
import ToastContainer from './components/shared/Toast'
import LandingPage from './components/LandingPage'

export default function App() {
  const [enteredWorkspace, setEnteredWorkspace] = useState(false)
  const activeModule = useAppStore(s => s.activeModule)

  if (!enteredWorkspace) {
    return <LandingPage onGetStarted={() => setEnteredWorkspace(true)} />
  }

  return (
    <div className="relative h-screen overflow-hidden bg-[#040814]">
      <div className="pointer-events-none absolute -top-28 -right-16 h-80 w-80 rounded-full bg-cyan-400/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 left-24 h-72 w-72 rounded-full bg-blue-500/15 blur-3xl" />
      <div className="pointer-events-none absolute top-1/3 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-indigo-500/10 blur-3xl" />

      <div className="relative flex h-screen overflow-hidden p-3">
        <div className="flex h-full w-full overflow-hidden rounded-[22px] border border-white/10 bg-[#071126]/70 shadow-2xl backdrop-blur-2xl">
          <Sidebar />
          <main className="flex-1 overflow-hidden">
            {activeModule === 'module1' && <Module1 />}
            {activeModule === 'module2' && <Module2 />}
            {activeModule === 'module3' && <Module3 />}
          </main>
        </div>
        <ToastContainer />
      </div>
    </div>
  )
}
