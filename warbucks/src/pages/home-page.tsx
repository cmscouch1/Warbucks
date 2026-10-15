import { Link } from "react-router-dom"

import { PersonAvatar } from "@/components/person-avatar"
import { Poster } from "@/components/poster"
import { ShowCard } from "@/components/show-card"
import { ButtonLink } from "@/components/button-link"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  billedCredits,
  featuredShow,
  formatAired,
  formatEpisodeCode,
  latestEpisodes,
  requirePerson,
  showsByGenre,
} from "@/lib/queries"

const HOME_GENRES = ["Drama", "Reality", "Dating", "Competition"] as const

export function HomePage() {
  const featured = featuredShow()
  const cast = billedCredits(featured).slice(0, 8)
  const latest = latestEpisodes(8)

  return (
    <div className="flex flex-col gap-12">
      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:items-stretch">
        <Poster show={featured} size="hero" />
        <div className="flex flex-col justify-end gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge>Featured</Badge>
            <Badge variant="outline">{featured.network}</Badge>
            {featured.genres.map((genre) => (
              <Badge key={genre} variant="secondary">
                {genre}
              </Badge>
            ))}
          </div>
          <div className="flex flex-col gap-2">
            <h1 className="font-heading text-3xl leading-tight md:text-4xl">
              {featured.title}
            </h1>
            <p className="max-w-prose text-muted-foreground">{featured.logline}</p>
          </div>
          <div className="flex flex-col gap-3">
            <p className="text-xs tracking-[0.18em] text-muted-foreground uppercase">
              Billed cast
            </p>
            <div className="flex flex-wrap gap-3">
              {cast.map((credit) => {
                const person = requirePerson(credit.personId)
                return (
                  <Link
                    key={credit.personId}
                    to={`/people/${person.id}`}
                    className="flex items-center gap-2 rounded-lg pr-2 hover:bg-muted"
                  >
                    <PersonAvatar person={person} size="sm" />
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate text-sm">{person.name}</span>
                      <span className="truncate text-xs text-muted-foreground">
                        {credit.role}
                      </span>
                    </span>
                  </Link>
                )
              })}
            </div>
          </div>
          <div>
            <ButtonLink to={`/shows/${featured.id}`}>
              Open show and full cast
            </ButtonLink>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex items-end justify-between gap-4">
          <h2 className="font-heading text-2xl">Latest episodes</h2>
          <Link to="/latest" className="text-sm text-muted-foreground hover:text-foreground">
            Full list
          </Link>
        </div>
        <div className="flex flex-col">
          {latest.map((episode, index) => (
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
                  episode={{ season: episode.season, number: episode.number }}
                />
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <p className="truncate font-medium">{episode.showTitle}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {episode.title}
                  </p>
                </div>
                <div className="hidden shrink-0 flex-col items-end text-sm sm:flex">
                  <span>{formatEpisodeCode(episode.season, episode.number)}</span>
                  <span className="text-muted-foreground">
                    {formatAired(episode.aired)}
                  </span>
                </div>
              </Link>
            </div>
          ))}
        </div>
      </section>

      {HOME_GENRES.map((genre) => {
        const shows = showsByGenre(genre).slice(0, 6)
        if (shows.length === 0) {
          return null
        }
        return (
          <section key={genre} className="flex flex-col gap-4">
            <div className="flex items-end justify-between gap-4">
              <h2 className="font-heading text-2xl">{genre}</h2>
              <Link
                to={`/shows?genre=${encodeURIComponent(genre)}`}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                All {genre.toLowerCase()}
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-5 md:grid-cols-3 lg:grid-cols-6">
              {shows.map((show) => (
                <ShowCard key={show.id} show={show} />
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}
