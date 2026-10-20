import { Navigate, Route, Routes, useParams } from "react-router-dom"

import { AppShell } from "@/components/app-shell"
import { HomePage } from "@/pages/home-page"
import { NotFoundPage } from "@/pages/not-found-page"
import { WatchPage } from "@/pages/watch-page"

function LegacyShowRedirect() {
  const { showId } = useParams()
  if (!showId) {
    return <Navigate to="/" replace />
  }
  return <Navigate to={`/watch/${showId}`} replace />
}

export function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/watch/:showId" element={<WatchPage />} />
        <Route path="/shows/:showId" element={<LegacyShowRedirect />} />
        <Route path="/shows" element={<Navigate to="/" replace />} />
        <Route path="/people" element={<Navigate to="/" replace />} />
        <Route path="/people/:personId" element={<Navigate to="/" replace />} />
        <Route path="/latest" element={<Navigate to="/" replace />} />
        <Route path="/cast" element={<Navigate to="/" replace />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}

export default App
