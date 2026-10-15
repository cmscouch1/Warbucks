import { useMemo } from "react"
import { useSearchParams } from "react-router-dom"

import { ShowCard } from "@/components/show-card"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"
import { useFavorites } from "@/hooks/use-favorites"
import { filterShows, getShow, usedGenres, usedNetworks } from "@/lib/queries"
import { GENRES, NETWORKS, type Genre, type Network } from "@/lib/types"

function isGenre(value: string | null): value is Genre {
  return GENRES.some((genre) => genre === value)
}

function isNetwork(value: string | null): value is Network {
  return NETWORKS.some((network) => network === value)
}

export function ShowsPage() {
  const [params, setParams] = useSearchParams()
  const query = params.get("q") ?? ""
  const genreParam = params.get("genre")
  const networkParam = params.get("network")
  const genre = isGenre(genreParam) ? genreParam : "all"
  const network = isNetwork(networkParam) ? networkParam : "all"
  const savedOnly = params.get("saved") === "1"
  const { ids: savedIds } = useFavorites()

  const shows = useMemo(() => {
    const filtered = filterShows({ query, genre, network })
    if (!savedOnly) {
      return filtered
    }
    return filtered.filter((show) => savedIds.includes(show.id))
  }, [query, genre, network, savedOnly, savedIds])

  function patch(next: Record<string, string | null>) {
    const copy = new URLSearchParams(params)
    for (const [key, value] of Object.entries(next)) {
      if (value === null || value === "" || value === "all") {
        copy.delete(key)
      } else {
        copy.set(key, value)
      }
    }
    setParams(copy)
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="font-heading text-3xl">Shows</h1>
        <p className="text-muted-foreground">
          Filter by genre, network, or search across titles, casts, and episodes.
        </p>
      </div>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <p className="text-xs tracking-[0.18em] text-muted-foreground uppercase">
            Genre
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant={genre === "all" ? "default" : "outline"}
              onClick={() => patch({ genre: "all" })}
            >
              All
            </Button>
            {usedGenres().map((item) => (
              <Button
                key={item}
                size="sm"
                variant={genre === item ? "default" : "outline"}
                onClick={() => patch({ genre: item })}
              >
                {item}
              </Button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <p className="text-xs tracking-[0.18em] text-muted-foreground uppercase">
            Network
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant={network === "all" ? "default" : "outline"}
              onClick={() => patch({ network: "all" })}
            >
              All
            </Button>
            {usedNetworks().map((item) => (
              <Button
                key={item}
                size="sm"
                variant={network === item ? "default" : "outline"}
                onClick={() => patch({ network: item })}
              >
                {item}
              </Button>
            ))}
          </div>
        </div>
        <div>
          <Button
            size="sm"
            variant={savedOnly ? "default" : "outline"}
            onClick={() => patch({ saved: savedOnly ? null : "1" })}
          >
            Saved only
            {savedIds.length > 0 ? ` (${savedIds.filter((id) => getShow(id)).length})` : ""}
          </Button>
        </div>
      </div>
      {shows.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>No shows match</EmptyTitle>
            <EmptyDescription>
              Clear a filter or try a different name, actor, or episode title.
            </EmptyDescription>
          </EmptyHeader>
          <Button
            variant="outline"
            onClick={() => {
              setParams(new URLSearchParams())
            }}
          >
            Reset filters
          </Button>
        </Empty>
      ) : (
        <div className="grid grid-cols-2 gap-6 md:grid-cols-3 lg:grid-cols-4">
          {shows.map((show) => (
            <ShowCard key={show.id} show={show} />
          ))}
        </div>
      )}
    </div>
  )
}
