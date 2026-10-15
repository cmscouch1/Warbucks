import { BookmarkIcon } from "lucide-react"
import { Link, useParams } from "react-router-dom"

import { PersonAvatar } from "@/components/person-avatar"
import { Poster } from "@/components/poster"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useFavorites } from "@/hooks/use-favorites"
import {
  billedCredits,
  formatAired,
  formatEpisodeCode,
  getShow,
  requirePerson,
  statusLabel,
} from "@/lib/queries"

export function ShowDetailPage() {
  const { showId } = useParams()
  const show = showId ? getShow(showId) : undefined
  const { isSaved, toggle } = useFavorites()

  if (!show) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyTitle>Show not in the catalog</EmptyTitle>
          <EmptyDescription>Pick another title from the show list.</EmptyDescription>
        </EmptyHeader>
        <Button render={<Link to="/shows" />}>Back to shows</Button>
      </Empty>
    )
  }

  const billed = billedCredits(show)
  const supporting = show.credits.filter((credit) => !credit.billed)
  const seasons = Array.from(
    new Set(show.episodes.map((episode) => episode.season))
  ).sort((left, right) => left - right)
  const defaultSeason = String(seasons[seasons.length - 1] ?? show.currentSeason)
  const saved = isSaved(show.id)

  return (
    <div className="flex flex-col gap-10">
      <section className="grid gap-6 md:grid-cols-[220px_minmax(0,1fr)]">
        <Poster show={show} />
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{show.network}</Badge>
            <Badge variant="secondary">{statusLabel(show.status)}</Badge>
            {show.genres.map((genre) => (
              <Badge key={genre} variant="ghost">
                {genre}
              </Badge>
            ))}
          </div>
          <div className="flex flex-col gap-2">
            <h1 className="font-heading text-3xl md:text-4xl">{show.title}</h1>
            <p className="text-sm text-muted-foreground">
              {show.year} · Season {show.currentSeason} · Official home{" "}
              {show.officialHome}
            </p>
            <p className="max-w-prose text-muted-foreground">{show.logline}</p>
          </div>
          <div>
            <Button variant={saved ? "secondary" : "outline"} onClick={() => toggle(show.id)}>
              <BookmarkIcon data-icon="inline-start" />
              {saved ? "Saved" : "Save"}
            </Button>
          </div>
        </div>
      </section>

      {billed.length > 0 ? (
        <section className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h2 className="font-heading text-2xl">Cast</h2>
            <p className="text-sm text-muted-foreground">
              Billed names first, with character or series role.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {billed.map((credit) => {
              const person = requirePerson(credit.personId)
              return (
                <Link
                  key={credit.personId}
                  to={`/people/${person.id}`}
                  className="flex items-center gap-3 rounded-xl border p-3 hover:bg-muted/60"
                >
                  <PersonAvatar person={person} size="lg" />
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate font-medium">{person.name}</span>
                    <span className="truncate text-sm text-muted-foreground">
                      {credit.role}
                    </span>
                  </span>
                </Link>
              )
            })}
          </div>
          {supporting.length > 0 ? (
            <div className="flex flex-col gap-3">
              <h3 className="text-sm tracking-[0.16em] text-muted-foreground uppercase">
                Also appearing
              </h3>
              <div className="flex flex-wrap gap-2">
                {supporting.map((credit) => {
                  const person = requirePerson(credit.personId)
                  return (
                    <Button
                      key={credit.personId}
                      size="sm"
                      variant="outline"
                      render={<Link to={`/people/${person.id}`} />}
                    >
                      {person.name}
                    </Button>
                  )
                })}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {seasons.length > 0 ? (
        <section className="flex flex-col gap-4">
          <h2 className="font-heading text-2xl">Episodes</h2>
          <Tabs defaultValue={defaultSeason}>
            <TabsList>
              {seasons.map((season) => (
                <TabsTrigger key={season} value={String(season)}>
                  Season {season}
                </TabsTrigger>
              ))}
            </TabsList>
            {seasons.map((season) => (
              <TabsContent key={season} value={String(season)}>
                <div className="flex flex-col">
                  {show.episodes
                    .filter((episode) => episode.season === season)
                    .map((episode, index) => (
                      <div key={`${episode.season}-${episode.number}`}>
                        {index > 0 ? <Separator /> : null}
                        <div className="flex items-baseline gap-4 py-3">
                          <span className="w-16 shrink-0 text-sm text-muted-foreground">
                            {formatEpisodeCode(episode.season, episode.number)}
                          </span>
                          <span className="min-w-0 flex-1 font-medium">
                            {episode.title}
                          </span>
                          <span className="shrink-0 text-sm text-muted-foreground">
                            {formatAired(episode.aired)}
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </section>
      ) : null}
    </div>
  )
}
