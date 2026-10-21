import { useEffect, useMemo } from "react"
import { Link, useParams, useSearchParams } from "react-router-dom"

import { ButtonLink } from "@/components/button-link"
import { EpisodePlayer } from "@/components/episode-player"
import { Button } from "@/components/ui/button"
import {
  episodeLine,
  findEpisode,
  formatEpisodeCode,
  formatPosted,
  getShow,
  latestEpisode,
  neighborEpisode,
  orderedEpisodes,
  playbackUrl,
} from "@/lib/queries"
import { writeContinue } from "@/lib/progress"

function parseCount(value: string | null): number | null {
  if (!value) {
    return null
  }
  const parsed = Number.parseInt(value, 10)
  if (Number.isNaN(parsed)) {
    return null
  }
  return parsed
}

export function WatchPage() {
  const { showId } = useParams()
  const [params, setParams] = useSearchParams()
  const show = showId ? getShow(showId) : undefined
  const episodes = useMemo(
    () => (show ? orderedEpisodes(show) : []),
    [show]
  )

  const selected = useMemo(() => {
    if (!show) {
      return undefined
    }
    const season = parseCount(params.get("s"))
    const number = parseCount(params.get("e"))
    if (season !== null && number !== null) {
      return findEpisode(show, season, number) ?? latestEpisode(show)
    }
    return latestEpisode(show)
  }, [show, params])

  const seasons = useMemo(
    () => Array.from(new Set(episodes.map((episode) => episode.season))),
    [episodes]
  )

  const activeSeason = selected?.season ?? seasons[0]
  const seasonEpisodes = useMemo(() => {
    if (activeSeason === undefined) {
      return []
    }
    return episodes.filter((episode) => episode.season === activeSeason)
  }, [episodes, activeSeason])

  useEffect(() => {
    if (!show || !selected) {
      return
    }
    writeContinue({
      showId: show.id,
      season: selected.season,
      number: selected.number,
    })
  }, [show, selected])

  if (!show) {
    return (
      <div className="flex flex-col gap-3">
        <p className="font-heading text-xl">Show not found</p>
        <ButtonLink to="/">Back home</ButtonLink>
      </div>
    )
  }

  if (!selected) {
    return (
      <div className="flex flex-col gap-3">
        <p className="font-heading text-xl">No episodes yet</p>
        <ButtonLink to="/">Back home</ButtonLink>
      </div>
    )
  }

  const previous = neighborEpisode(show, selected.season, selected.number, -1)
  const next = neighborEpisode(show, selected.season, selected.number, 1)

  function openEpisode(season: number, number: number) {
    setParams({ s: String(season), e: String(number) }, { replace: true })
  }

  return (
    <div className="flex flex-col gap-6">
      <Link
        to={`/series/${show.id}`}
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← {show.title}
      </Link>

      <EpisodePlayer
        key={`${show.id}-${selected.season}-${selected.number}`}
        src={playbackUrl()}
        title={`${show.title} ${formatEpisodeCode(selected.season, selected.number)}`}
        onEnded={() => {
          if (next) {
            openEpisode(next.season, next.number)
          }
        }}
      />

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="font-heading text-2xl">
            {episodeLine(
              show.title,
              selected.season,
              selected.number,
              selected.title
            )}
          </h2>
          <p className="text-sm text-muted-foreground">
            {formatPosted(selected.aired)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={!previous}
            onClick={() => {
              if (previous) {
                openEpisode(previous.season, previous.number)
              }
            }}
          >
            Previous
          </Button>
          <Button
            disabled={!next}
            onClick={() => {
              if (next) {
                openEpisode(next.season, next.number)
              }
            }}
            data-testid="next-episode"
          >
            Next
          </Button>
        </div>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-xl">Episodes</h2>
        {seasons.length > 1 ? (
          <div className="flex flex-wrap gap-2">
            {seasons.map((season) => (
              <Button
                key={season}
                size="sm"
                variant={season === activeSeason ? "default" : "outline"}
                onClick={() => {
                  const first = episodes.find(
                    (episode) => episode.season === season
                  )
                  if (first) {
                    openEpisode(first.season, first.number)
                  }
                }}
              >
                Season {season}
              </Button>
            ))}
          </div>
        ) : null}
        <div className="flex flex-col divide-y overflow-hidden rounded-xl border">
          {seasonEpisodes.map((episode) => {
            const active =
              episode.season === selected.season &&
              episode.number === selected.number
            return (
              <button
                key={`${episode.season}-${episode.number}`}
                type="button"
                data-testid={`episode-${episode.season}-${episode.number}`}
                className={
                  active
                    ? "flex min-h-11 items-center bg-muted px-4 py-3 text-left"
                    : "flex min-h-11 items-center px-4 py-3 text-left hover:bg-muted/60"
                }
                onClick={() => openEpisode(episode.season, episode.number)}
              >
                <span className="min-w-0 flex-1 font-medium">
                  {episodeLine(
                    show.title,
                    episode.season,
                    episode.number,
                    episode.title
                  )}
                </span>
              </button>
            )
          })}
        </div>
      </section>
    </div>
  )
}
