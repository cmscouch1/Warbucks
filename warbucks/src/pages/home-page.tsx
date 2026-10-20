import { useMemo, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"

import { Poster } from "@/components/poster"
import { ShowCard } from "@/components/show-card"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"
import { Input } from "@/components/ui/input"
import {
  collectionLabel,
  filterShows,
  findEpisode,
  formatEpisodeCode,
  getShow,
  usedCollections,
} from "@/lib/queries"
import { readContinue, type ContinueWatching } from "@/lib/progress"
import { COLLECTIONS, type Collection } from "@/lib/types"

function isCollection(value: string | null): value is Collection {
  return COLLECTIONS.some((collection) => collection === value)
}

export function HomePage() {
  const [params, setParams] = useSearchParams()
  const query = params.get("q") ?? ""
  const collectionParam = params.get("g")
  const collection = isCollection(collectionParam) ? collectionParam : "all"
  const [continueWatching] = useState<ContinueWatching | null>(() => readContinue())

  const shows = useMemo(
    () => filterShows({ query, collection }),
    [query, collection]
  )

  const continueShow = continueWatching ? getShow(continueWatching.showId) : undefined
  const continueEpisode =
    continueShow && continueWatching
      ? findEpisode(continueShow, continueWatching.season, continueWatching.number)
      : undefined

  function setCollection(next: Collection | "all") {
    const copy = new URLSearchParams(params)
    if (next === "all") {
      copy.delete("g")
    } else {
      copy.set("g", next)
    }
    setParams(copy)
  }

  return (
    <div className="flex flex-col gap-8">
      {continueShow && continueEpisode && continueWatching ? (
        <Link
          to={`/watch/${continueShow.id}?s=${continueWatching.season}&e=${continueWatching.number}`}
          className="flex items-center gap-4 rounded-xl border p-3 hover:bg-muted/60"
          data-testid="continue-watching"
        >
          <Poster show={continueShow} size="thumb" />
          <div className="flex min-w-0 flex-col gap-0.5">
            <p className="text-xs tracking-[0.16em] text-muted-foreground uppercase">
              Continue
            </p>
            <p className="truncate font-heading text-lg">{continueShow.title}</p>
            <p className="truncate text-sm text-muted-foreground">
              {formatEpisodeCode(continueEpisode.season, continueEpisode.number)} · {continueEpisode.title}
            </p>
          </div>
        </Link>
      ) : null}

      <div className="flex flex-col gap-4">
        <Input
          value={query}
          onChange={(event) => {
            const copy = new URLSearchParams(params)
            const next = event.target.value
            if (next.trim().length === 0) {
              copy.delete("q")
            } else {
              copy.set("q", next)
            }
            setParams(copy)
          }}
          placeholder="Find a show"
          aria-label="Find a show"
          data-testid="home-search"
        />
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant={collection === "all" ? "default" : "outline"}
            onClick={() => setCollection("all")}
          >
            All
          </Button>
          {usedCollections().map((item) => (
            <Button
              key={item}
              size="sm"
              variant={collection === item ? "default" : "outline"}
              onClick={() => setCollection(item)}
            >
              {collectionLabel(item)}
            </Button>
          ))}
        </div>
      </div>

      {shows.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>No shows match</EmptyTitle>
            <EmptyDescription>Try another name or clear the filter.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="grid grid-cols-2 gap-5 md:grid-cols-3 lg:grid-cols-5">
          {shows.map((show) => (
            <ShowCard key={show.id} show={show} />
          ))}
        </div>
      )}
    </div>
  )
}
