import { Link } from "react-router-dom"

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/95">
      <div className="mx-auto flex w-full max-w-3xl items-center px-4 py-3">
        <Link to="/" className="font-heading text-lg tracking-tight">
          Broken Silenze
        </Link>
      </div>
    </header>
  )
}
