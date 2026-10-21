import { useDeferredValue, useMemo, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"

import { ButtonLink } from "@/components/button-link"
import { Input } from "@/components/ui/input"
import {
  episodeLine,
  findEpisode,
  formatPosted,
  getShow,
  latestEpisode,
  siteFeed,
  siteSeries,
} from "@/lib/queries"
import { readContinue, type ContinueWatching } from "@/lib/progress"

const FEED_LIMIT = 18

export function HomePage() {
  const [params, setParams] = useSearchParams()
  const query = params.get("q") ?? ""
  const deferredQuery = useDeferredValue(query)
  const [continueWatching] = useState<ContinueWatching | null>(() =>
    readContinue()
  )

  const needle = deferredQuery.trim().toLowerCase()
  const feed = useMemo(() => {
    const posts = siteFeed()
    if (needle.length === 0) {
      return posts.slice(0, FEED_LIMIT)
    }
    return posts
      .filter((post) =>
        episodeLine(post.showTitle, post.season, post.number, post.title)
          .toLowerCase()
          .includes(needle)
      )
      .slice(0, FEED_LIMIT)
  }, [needle])

  const series = useMemo(() => {
    const list = siteSeries()
    if (needle.length === 0) {
      return list
    }
    return list.filter((show) => show.title.toLowerCase().includes(needle))
  }, [needle])

  const continueShow = continueWatching
    ? getShow(continueWatching.showId)
    : undefined
  const continueEpisode =
    continueShow && continueWatching
      ? findEpisode(
          continueShow,
          continueWatching.season,
          continueWatching.number
        )
      : undefined

  return (
    <div className="flex flex-col gap-8">
      {continueShow && continueEpisode && continueWatching ? (
        <Link
          to={`/watch/${continueShow.id}?s=${continueWatching.season}&e=${continueWatching.number}`}
          className="flex min-h-11 flex-col justify-center gap-1 rounded-xl border px-4 py-3 hover:bg-muted/60"
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
          setParams(copy, { replace: true })
        }}
        placeholder="Find a show"
        aria-label="Find a show"
        data-testid="home-search"
      />

      <section className="flex flex-col gap-2">
        <h1 className="font-heading text-2xl">Latest</h1>
        {feed.length === 0 ? (
          <p className="text-sm text-muted-foreground">Try The Drop or Potomac.</p>
        ) : (
          <div className="flex flex-col divide-y">
            {feed.map((post) => (
              <Link
                key={`${post.showId}-${post.season}-${post.number}-${post.aired}`}
                to={`/watch/${post.showId}?s=${post.season}&e=${post.number}`}
                className="flex min-h-11 flex-col justify-center gap-0.5 py-3 hover:bg-muted/60"
              >
                <p className="font-medium">
                  {episodeLine(
                    post.showTitle,
                    post.season,
                    post.number,
                    post.title
                  )}
                </p>
                <p className="text-sm text-muted-foreground">
                  {formatPosted(post.aired)}
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-heading text-2xl">Series</h2>
        <div className="flex flex-col divide-y">
          {series.map((show) => {
            const latest = latestEpisode(show)
            return (
              <div
                key={show.id}
                className="flex min-h-11 items-center justify-between gap-3 py-3"
              >
                <Link
                  to={`/series/${show.id}`}
                  className="min-w-0 font-heading text-lg hover:underline"
                >
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
            )
          })}
        </div>
      </section>
    </div>
  )
}
