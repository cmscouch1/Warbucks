import { Navigate, Route, Routes } from "react-router-dom"

import { AppShell } from "@/components/app-shell"
import { HomePage } from "@/pages/home-page"
import { SeriesPage } from "@/pages/series-page"
import { WatchPage } from "@/pages/watch-page"

export function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/series/:showId" element={<SeriesPage />} />
        <Route path="/watch/:showId" element={<WatchPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

export default App
