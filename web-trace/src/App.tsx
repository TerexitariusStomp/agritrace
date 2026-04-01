import { Navigate, Route, Routes } from 'react-router-dom'
import { TracePage } from './pages/TracePage'

export function App() {
  return (
    <Routes>
      <Route path="/trace/:id" element={<TracePage />} />
      <Route path="*" element={<Navigate to="/trace/sample-batch" replace />} />
    </Routes>
  )
}
