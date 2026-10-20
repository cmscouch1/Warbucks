import { Link } from "react-router-dom"

import { Poster } from "@/components/poster"
import { latestEpisode, formatEpisodeCode } from "@/lib/queries"
import type { Show } from "@/lib/types"

type ShowCardProps = {
  show: Show
}

export function ShowCard({ show }: ShowCardProps) {
  const latest = latestEpisode(show)

  return (
    <Link
      to={`/watch/${show.id}`}
      className="group flex flex-col gap-2 outline-none"
      data-testid={`show-${show.id}`}
    >
      <Poster show={show} />
      <div className="flex flex-col gap-0.5">
        <h3 className="font-heading text-base leading-snug group-hover:underline">
          {show.title}
        </h3>
        {latest ? (
          <p className="text-sm text-muted-foreground">
            {formatEpisodeCode(latest.season, latest.number)}
          </p>
        ) : null}
      </div>
    </Link>
  )
}
