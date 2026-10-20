import { useMemo, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"

import { ButtonLink } from "@/components/button-link"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import {
  episodeLine,
  findEpisode,
  formatPosted,
  getShow,
  siteFeed,
  siteSeries,
} from "@/lib/queries"
import { readContinue, type ContinueWatching } from "@/lib/progress"

export function HomePage() {
  const [params, setParams] = useSearchParams()
  const query = params.get("q") ?? ""
  const [continueWatching] = useState<ContinueWatching | null>(() => readContinue())

  const needle = query.trim().toLowerCase()
  const feed = useMemo(
    () =>
      siteFeed().filter((post) =>
        needle.length === 0
          ? true
          : episodeLine(post.showTitle, post.season, post.number, post.title)
              .toLowerCase()
              .includes(needle)
      ),
    [needle]
  )
  const series = useMemo(
    () =>
      siteSeries().filter((show) =>
        needle.length === 0 ? true : show.title.toLowerCase().includes(needle)
      ),
    [needle]
  )

  const continueShow = continueWatching ? getShow(continueWatching.showId) : undefined
  const continueEpisode =
    continueShow && continueWatching
      ? findEpisode(continueShow, continueWatching.season, continueWatching.number)
      : undefined

  return (
    <div className="flex flex-col gap-10">
      {continueShow && continueEpisode && continueWatching ? (
        <Link
          to={`/watch/${continueShow.id}?s=${continueWatching.season}&e=${continueWatching.number}`}
          className="flex flex-col gap-1 rounded-xl border p-4 hover:bg-muted/60"
          data-testid="continue-watching"
        >
          <p className="text-xs tracking-[0.16em] text-muted-foreground uppercase">
            Continue
          </p>
          <p className="font-heading text-lg">
            {episodeLine(
              continueShow.title,
              continueEpisode.season,
              continueEpisode.number,
              continueEpisode.title
            )}
          </p>
        </Link>
      ) : null}

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

      <section className="flex flex-col gap-3">
        <h1 className="font-heading text-2xl">Latest</h1>
        {feed.length === 0 ? (
          <Empty className="border">
            <EmptyHeader>
              <EmptyTitle>No posts match</EmptyTitle>
              <EmptyDescription>Try The Drop or Potomac.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="flex flex-col">
            {feed.map((post, index) => (
              <div key={`${post.showId}-${post.season}-${post.number}-${post.aired}`}>
                {index > 0 ? <Separator /> : null}
                <Link
                  to={`/watch/${post.showId}?s=${post.season}&e=${post.number}`}
                  className="flex flex-col gap-1 py-3 hover:bg-muted/60"
                >
                  <p className="font-medium">
                    {episodeLine(post.showTitle, post.season, post.number, post.title)}
                  </p>
                  <p className="text-sm text-muted-foreground">{formatPosted(post.aired)}</p>
                </Link>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-2xl">Series</h2>
        <div className="flex flex-col">
          {series.map((show, index) => {
            const latest = [...show.episodes].sort((left, right) =>
              right.aired.localeCompare(left.aired)
            )[0]
            return (
              <div key={show.id}>
                {index > 0 ? <Separator /> : null}
                <div className="flex items-center justify-between gap-3 py-3">
                  <Link to={`/series/${show.id}`} className="min-w-0 font-heading text-lg hover:underline">
                    {show.title}
                  </Link>
                  <ButtonLink
                    to={
                      latest
                        ? `/watch/${show.id}?s=${latest.season}&e=${latest.number}`
                        : `/series/${show.id}`
                    }
                    size="sm"
                  >
                    Watch Now
                  </ButtonLink>
                </div>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
