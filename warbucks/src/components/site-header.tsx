import { MenuIcon, SearchIcon } from "lucide-react"
import { useState, type FormEvent } from "react"
import { Link, NavLink, useNavigate, useSearchParams } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"

const NAV = [
  { to: "/", label: "Home" },
  { to: "/shows", label: "Shows" },
  { to: "/people", label: "Cast" },
  { to: "/latest", label: "Latest" },
] as const

function navClassName({ isActive }: { isActive: boolean }) {
  return isActive
    ? "text-foreground"
    : "text-muted-foreground hover:text-foreground"
}

export function SiteHeader() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [query, setQuery] = useState(params.get("q") ?? "")
  const [open, setOpen] = useState(false)

  function onSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const next = query.trim()
    navigate(next ? `/shows?q=${encodeURIComponent(next)}` : "/shows")
    setOpen(false)
  }

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95">
      <div className="mx-auto flex w-full max-w-6xl items-center gap-4 px-4 py-3">
        <Link to="/" className="flex min-w-0 flex-col leading-none">
          <span className="font-heading text-lg tracking-tight">
            Broken Silenze
          </span>
          <span className="text-[0.65rem] tracking-[0.22em] text-muted-foreground uppercase">
            Show guide
          </span>
        </Link>
        <nav className="hidden items-center gap-4 text-sm md:flex">
          {NAV.map((item) => (
            <NavLink key={item.to} to={item.to} className={navClassName} end={item.to === "/"}>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <form onSubmit={onSearch} className="ml-auto hidden min-w-0 flex-1 md:block md:max-w-sm">
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search shows, casts, episodes"
              aria-label="Search shows, casts, and episodes"
              className="pl-8"
            />
          </div>
        </form>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger
            nativeButton={true}
            render={
              <Button
                variant="outline"
                size="icon"
                className="ml-auto md:hidden"
                aria-label="Open menu"
              />
            }
          >
            <MenuIcon />
          </SheetTrigger>
          <SheetContent side="right">
            <SheetHeader>
              <SheetTitle>Browse</SheetTitle>
            </SheetHeader>
            <div className="flex flex-col gap-4 px-4">
              <form onSubmit={onSearch}>
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search shows and casts"
                  aria-label="Search shows and casts"
                />
              </form>
              <nav className="flex flex-col gap-3 text-base">
                {NAV.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={navClassName}
                    end={item.to === "/"}
                    onClick={() => setOpen(false)}
                  >
                    {item.label}
                  </NavLink>
                ))}
              </nav>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  )
}
