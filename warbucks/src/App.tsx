import { Navigate, Route, Routes } from "react-router-dom"

import { AppShell } from "@/components/app-shell"
import { HomePage } from "@/pages/home-page"
import { LatestPage } from "@/pages/latest-page"
import { NotFoundPage } from "@/pages/not-found-page"
import { PeoplePage } from "@/pages/people-page"
import { PersonDetailPage } from "@/pages/person-detail-page"
import { ShowDetailPage } from "@/pages/show-detail-page"
import { ShowsPage } from "@/pages/shows-page"

export function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/shows" element={<ShowsPage />} />
        <Route path="/shows/:showId" element={<ShowDetailPage />} />
        <Route path="/people" element={<PeoplePage />} />
        <Route path="/people/:personId" element={<PersonDetailPage />} />
        <Route path="/latest" element={<LatestPage />} />
        <Route path="/cast" element={<Navigate to="/people" replace />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}

export default App
