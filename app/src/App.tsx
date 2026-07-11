import { Navigate, Route, Routes } from 'react-router-dom'
import BottomNav from './components/BottomNav'
import JualPage from './pages/JualPage'
import StokPage from './pages/StokPage'
import RekapPage from './pages/RekapPage'
import LainnyaPage from './pages/LainnyaPage'

function App() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col bg-gray-50">
      <header className="sticky top-0 z-10 bg-brand px-4 py-3 text-white shadow">
        <h1 className="text-lg font-bold">JE&amp;DA</h1>
      </header>
      <main className="flex-1 px-4 py-4 pb-24">
        <Routes>
          <Route path="/" element={<Navigate to="/jual" replace />} />
          <Route path="/jual" element={<JualPage />} />
          <Route path="/stok" element={<StokPage />} />
          <Route path="/rekap" element={<RekapPage />} />
          <Route path="/lainnya" element={<LainnyaPage />} />
        </Routes>
      </main>
      <BottomNav />
    </div>
  )
}

export default App
