import { PEOPLE } from "@/data/people"
import { SITE_POSTS, SITE_SERIES } from "@/data/site"
import { SHOWS } from "@/data/shows"
import type { CatalogEpisode, Episode, Person, Show } from "@/lib/types"

const peopleById = new Map(PEOPLE.map((person) => [person.id, person]))
const showsById = new Map(SHOWS.map((show) => [show.id, show]))
const resolvedShows = new Map<string, Show>()

for (const show of SHOWS) {
  for (const credit of show.credits) {
    if (!peopleById.has(credit.personId)) {
      throw new Error(`Unknown person ${credit.personId} on ${show.id}`)
    }
  }
}

function siteTitle(showId: string, fallback: string): string {
  const post = SITE_POSTS.find((item) => item.showId === showId)
  if (post) {
    return post.showTitle
  }
  const listed = SITE_SERIES.find((item) => item.id === showId)
  return listed?.title ?? fallback
}

function withSitePosts(show: Show): Show {
  const posts = SITE_POSTS.filter((post) => post.showId === show.id)
  const episodes = show.episodes.map((episode) => ({ ...episode }))
  for (const post of posts) {
    const index = episodes.findIndex(
      (episode) =>
        episode.season === post.season && episode.number === post.number
    )
    const next = {
      season: post.season,
      number: post.number,
      title: post.title,
      aired: post.aired,
    }
    if (index >= 0) {
      episodes[index] = next
    } else {
      episodes.push(next)
    }
  }
  return {
    ...show,
    title: siteTitle(show.id, show.title),
    episodes,
  }
}

function showFromSite(showId: string, title: string): Show {
  return {
    id: showId,
    collection: "lifestyle",
    title,
    year: 2026,
    network: "Broken Silenze",
    genres: ["Reality"],
    status: "returning",
    logline: "",
    currentSeason: 1,
    posterHue: 28,
    officialHome: "Broken Silenze",
    credits: [],
    episodes: [],
  }
}

export function getShow(id: string): Show | undefined {
  const cached = resolvedShows.get(id)
  if (cached) {
    return cached
  }
  const existing = showsById.get(id)
  if (existing) {
    const resolved = withSitePosts(existing)
    resolvedShows.set(id, resolved)
    return resolved
  }
  const listed = SITE_SERIES.find((item) => item.id === id)
  const posted = SITE_POSTS.find((item) => item.showId === id)
  if (!listed && !posted) {
    return undefined
  }
  const resolved = withSitePosts(
    showFromSite(id, posted?.showTitle ?? listed?.title ?? id)
  )
  resolvedShows.set(id, resolved)
  return resolved
}

let cachedSeries: Show[] | null = null
let cachedFeed: CatalogEpisode[] | null = null

export function siteSeries(): Show[] {
  if (cachedSeries) {
    return cachedSeries
  }
  cachedSeries = SITE_SERIES.flatMap((item) => {
    const show = getShow(item.id)
    return show ? [show] : []
  })
  return cachedSeries
}

export function siteFeed(): CatalogEpisode[] {
  if (cachedFeed) {
    return cachedFeed
  }
  cachedFeed = SITE_POSTS.map((post) => {
    const show = getShow(post.showId)
    return {
      season: post.season,
      number: post.number,
      title: post.title,
      aired: post.aired,
      showId: post.showId,
      showTitle: post.showTitle,
      network: show?.network ?? "Broken Silenze",
      posterHue: show?.posterHue ?? 28,
    }
  }).sort((left, right) => right.aired.localeCompare(left.aired))
  return cachedFeed
}

export function episodeLine(
  showTitle: string,
  season: number,
  number: number,
  title: string
): string {
  const base = `${showTitle} Season ${season} Episode ${number}`
  if (title.trim().length === 0) {
    return base
  }
  return `${base} – ‘${title}’`
}

export function requirePerson(id: string): Person {
  const person = peopleById.get(id)
  if (!person) {
    throw new Error(`Unknown person: ${id}`)
  }
  return person
}

export function billedCredits(show: Show) {
  return show.credits.filter((credit) => credit.billed)
}

export function latestEpisode(show: Show): Episode | undefined {
  let latest: Episode | undefined
  for (const episode of show.episodes) {
    if (!latest || episode.aired.localeCompare(latest.aired) > 0) {
      latest = episode
    }
  }
  return latest
}

export function orderedEpisodes(show: Show): Episode[] {
  return [...show.episodes].sort((left, right) => {
    if (left.season !== right.season) {
      return left.season - right.season
    }
    return left.number - right.number
  })
}

export function findEpisode(
  show: Show,
  season: number,
  number: number
): Episode | undefined {
  return show.episodes.find(
    (episode) => episode.season === season && episode.number === number
  )
}

export function neighborEpisode(
  show: Show,
  season: number,
  number: number,
  direction: 1 | -1
): Episode | undefined {
  const ordered = orderedEpisodes(show)
  const index = ordered.findIndex(
    (episode) => episode.season === season && episode.number === number
  )
  if (index < 0) {
    return undefined
  }
  return ordered[index + direction]
}

export function playbackUrl(): string {
  return "/sample.mp4"
}

export function formatEpisodeCode(season: number, number: number): string {
  return `S${String(season).padStart(2, "0")}E${String(number).padStart(2, "0")}`
}

export function formatPosted(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00`)
  const formatted = new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date)
  return `On ${formatted}`
}
