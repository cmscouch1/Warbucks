import { Link, useParams } from "react-router-dom"

import { ButtonLink } from "@/components/button-link"
import {
  billedCredits,
  episodeLine,
  formatPosted,
  getShow,
  orderedEpisodes,
  requirePerson,
} from "@/lib/queries"

export function SeriesPage() {
  const { showId } = useParams()
  const show = showId ? getShow(showId) : undefined

  if (!show) {
    return (
      <div className="flex flex-col gap-3">
        <p className="font-heading text-xl">Series not on the list</p>
        <ButtonLink to="/">Back home</ButtonLink>
      </div>
    )
  }

  const episodes = [...orderedEpisodes(show)].sort((left, right) =>
    right.aired.localeCompare(left.aired)
  )
  const cast = billedCredits(show)

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <Link
          to="/"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          Broken Silenze
        </Link>
        <h1 className="font-heading text-3xl">{show.title}</h1>
        {show.logline ? (
          <p className="max-w-prose text-muted-foreground">{show.logline}</p>
        ) : null}
      </div>

      {cast.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="font-heading text-xl">Cast</h2>
          <div className="flex flex-col divide-y">
            {cast.map((credit) => {
              const person = requirePerson(credit.personId)
              return (
                <p key={credit.personId} className="py-2">
                  {person.name}
                  {credit.role === "Herself" || credit.role === "Himself"
                    ? ""
                    : ` · ${credit.role}`}
                </p>
              )
            })}
          </div>
        </section>
      ) : null}

      <section className="flex flex-col gap-2">
        <h2 className="font-heading text-xl">Episodes</h2>
        {episodes.length === 0 ? (
          <p className="text-sm text-muted-foreground">No episodes posted yet.</p>
        ) : (
          <div className="flex flex-col divide-y">
            {episodes.map((episode) => (
              <Link
                key={`${episode.season}-${episode.number}`}
                to={`/watch/${show.id}?s=${episode.season}&e=${episode.number}`}
                className="flex min-h-11 flex-col justify-center gap-0.5 py-3 hover:bg-muted/60"
              >
                <p className="font-medium">
                  {episodeLine(
                    show.title,
                    episode.season,
                    episode.number,
                    episode.title
                  )}
                </p>
                <p className="text-sm text-muted-foreground">
                  {formatPosted(episode.aired)}
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
