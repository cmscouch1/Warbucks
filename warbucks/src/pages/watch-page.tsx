import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import { useEffect, useMemo } from "react"
import { useNavigate, useParams, useSearchParams } from "react-router-dom"

import { ButtonLink } from "@/components/button-link"
import { EpisodePlayer } from "@/components/episode-player"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"
import { billedCredits, findEpisode, formatAired, formatEpisodeCode, getShow, latestEpisode, neighborEpisode, orderedEpisodes, playbackUrl, requirePerson } from "@/lib/queries"
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
  const navigate = useNavigate()
  const show = showId ? getShow(showId) : undefined

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

  const seasons = useMemo(() => {
    if (!show) {
      return []
    }
    return Array.from(new Set(orderedEpisodes(show).map((episode) => episode.season)))
  }, [show])

  const activeSeason = selected?.season ?? seasons[0]
  const seasonEpisodes = useMemo(() => {
    if (!show || activeSeason === undefined) {
      return []
    }
    return orderedEpisodes(show).filter((episode) => episode.season === activeSeason)
  }, [show, activeSeason])

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
      <Empty className="border">
        <EmptyHeader>
          <EmptyTitle>Show not found</EmptyTitle>
          <EmptyDescription>Pick another title from home.</EmptyDescription>
        </EmptyHeader>
        <ButtonLink to="/">Back home</ButtonLink>
      </Empty>
    )
  }

  if (!selected) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyTitle>No episodes yet</EmptyTitle>
          <EmptyDescription>{show.title} has no episodes in this catalog.</EmptyDescription>
        </EmptyHeader>
        <ButtonLink to="/">Back home</ButtonLink>
      </Empty>
    )
  }

  const previous = neighborEpisode(show, selected.season, selected.number, -1)
  const next = neighborEpisode(show, selected.season, selected.number, 1)
  const castLine = billedCredits(show)
    .slice(0, 6)
    .map((credit) => requirePerson(credit.personId).name)
    .join(" · ")

  function openEpisode(season: number, number: number) {
    setParams({ s: String(season), e: String(number) })
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
          <ChevronLeftIcon data-icon="inline-start" />
          Shows
        </Button>
        <h1 className="font-heading truncate text-xl md:text-2xl">{show.title}</h1>
      </div>

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
          <p className="text-sm text-muted-foreground">
            {formatEpisodeCode(selected.season, selected.number)} · {formatAired(selected.aired)}
          </p>
          <h2 className="font-heading text-2xl">{selected.title}</h2>
          {castLine ? (
            <p className="text-sm text-muted-foreground">{castLine}</p>
          ) : null}
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
            <ChevronLeftIcon data-icon="inline-start" />
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
            <ChevronRightIcon data-icon="inline-end" />
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
                  const first = orderedEpisodes(show).find((episode) => episode.season === season)
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
        <div className="flex flex-col overflow-hidden rounded-xl border">
          {seasonEpisodes.map((episode) => {
            const active =
              episode.season === selected.season && episode.number === selected.number
            return (
              <button
                key={`${episode.season}-${episode.number}`}
                type="button"
                data-testid={`episode-${episode.season}-${episode.number}`}
                className={
                  active
                    ? "flex items-baseline gap-3 bg-muted px-4 py-3 text-left"
                    : "flex items-baseline gap-3 px-4 py-3 text-left hover:bg-muted/60"
                }
                onClick={() => openEpisode(episode.season, episode.number)}
              >
                <span className="w-16 shrink-0 text-sm text-muted-foreground">
                  {formatEpisodeCode(episode.season, episode.number)}
                </span>
                <span className="min-w-0 flex-1 font-medium">{episode.title}</span>
                <span className="hidden shrink-0 text-sm text-muted-foreground sm:inline">
                  {formatAired(episode.aired)}
                </span>
              </button>
            )
          })}
        </div>
      </section>
    </div>
  )
}
