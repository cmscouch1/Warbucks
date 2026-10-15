import { Link } from "react-router-dom"

import { Poster } from "@/components/poster"
import { Separator } from "@/components/ui/separator"
import { formatAired, formatEpisodeCode, latestEpisodes } from "@/lib/queries"

export function LatestPage() {
  const episodes = latestEpisodes(40)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="font-heading text-3xl">Latest episodes</h1>
        <p className="text-muted-foreground">
          Newest first across the whole catalog, grouped as a single list instead
          of a scattered homepage dump.
        </p>
      </div>
      <div className="flex flex-col">
        {episodes.map((episode, index) => (
          <div key={`${episode.showId}-${episode.season}-${episode.number}`}>
            {index > 0 ? <Separator /> : null}
            <Link
              to={`/shows/${episode.showId}`}
              className="flex items-center gap-4 py-3 hover:bg-muted/60"
            >
              <Poster
                show={{
                  title: episode.showTitle,
                  network: episode.network,
                  posterHue: episode.posterHue,
                  year: 0,
                }}
                size="thumb"
              />
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <p className="truncate font-medium">{episode.showTitle}</p>
                <p className="truncate text-sm text-muted-foreground">
                  {episode.title}
                </p>
              </div>
              <div className="hidden shrink-0 flex-col items-end text-sm sm:flex">
                <span>{formatEpisodeCode(episode.season, episode.number)}</span>
                <span className="text-muted-foreground">{formatAired(episode.aired)}</span>
              </div>
            </Link>
          </div>
        ))}
      </div>
    </div>
  )
}
