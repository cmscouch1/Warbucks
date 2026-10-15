import { Link } from "react-router-dom"

import { Poster } from "@/components/poster"
import { Badge } from "@/components/ui/badge"
import { billedCredits, requirePerson, statusLabel } from "@/lib/queries"
import type { Show } from "@/lib/types"

type ShowCardProps = {
  show: Show
}

export function ShowCard({ show }: ShowCardProps) {
  const lead = billedCredits(show)
    .slice(0, 3)
    .map((credit) => requirePerson(credit.personId).name)
    .join(" · ")

  return (
    <Link
      to={`/shows/${show.id}`}
      className="group flex flex-col gap-3 outline-none"
    >
      <Poster show={show} />
      <div className="flex flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="outline">{show.network}</Badge>
          <Badge variant="secondary">{statusLabel(show.status)}</Badge>
        </div>
        <h3 className="font-heading text-base leading-snug group-hover:underline">
          {show.title}
        </h3>
        {lead ? (
          <p className="line-clamp-2 text-sm text-muted-foreground">{lead}</p>
        ) : (
          <p className="text-sm text-muted-foreground">{show.genres.join(" · ")}</p>
        )}
      </div>
    </Link>
  )
}
