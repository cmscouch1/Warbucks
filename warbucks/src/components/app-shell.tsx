import { Outlet } from "react-router-dom"

import { SiteFooter } from "@/components/site-footer"
import { SiteHeader } from "@/components/site-header"

export function AppShell() {
  return (
    <div className="flex min-h-svh flex-col">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-8">
        <Outlet />
      </main>
      <SiteFooter />
    </div>
  )
}
