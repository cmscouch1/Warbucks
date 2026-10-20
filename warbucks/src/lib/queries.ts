import { PEOPLE } from "@/data/people"
import { SITE_POSTS, SITE_SERIES } from "@/data/site"
import { SHOWS } from "@/data/shows"
import type {
  CatalogEpisode,
  Collection,
  Episode,
  Genre,
  Network,
  Person,
  Show,
  ShowStatus,
} from "@/lib/types"
import { COLLECTIONS } from "@/lib/types"

const peopleById = new Map(PEOPLE.map((person) => [person.id, person]))
const showsById = new Map(SHOWS.map((show) => [show.id, show]))

for (const show of SHOWS) {
  for (const credit of show.credits) {
    if (!peopleById.has(credit.personId)) {
      throw new Error(`Unknown person ${credit.personId} on ${show.id}`)
    }
  }
}

export function getShows(): Show[] {
  return SHOWS
}

export function getPeople(): Person[] {
  return PEOPLE
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
      (episode) => episode.season === post.season && episode.number === post.number
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

export function resolveShow(id: string): Show | undefined {
  const existing = showsById.get(id)
  if (existing) {
    return withSitePosts(existing)
  }
  const listed = SITE_SERIES.find((item) => item.id === id)
  const posted = SITE_POSTS.find((item) => item.showId === id)
  if (!listed && !posted) {
    return undefined
  }
  return withSitePosts(showFromSite(id, posted?.showTitle ?? listed?.title ?? id))
}

export function getShow(id: string): Show | undefined {
  return resolveShow(id)
}

export function siteSeries(): Show[] {
  return SITE_SERIES.flatMap((item) => {
    const show = resolveShow(item.id)
    return show ? [show] : []
  })
}

export function siteFeed(): CatalogEpisode[] {
  return SITE_POSTS.map((post) => {
    const show = resolveShow(post.showId)
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

export function getPerson(id: string): Person | undefined {
  return peopleById.get(id)
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

export function statusLabel(status: ShowStatus): string {
  switch (status) {
    case "returning":
      return "Returning"
    case "new":
      return "New this year"
    case "limited":
      return "Limited series"
    default: {
      const exhaustive: never = status
      return exhaustive
    }
  }
}

export function collectionLabel(collection: Collection): string {
  switch (collection) {
    case "housewives":
      return "Housewives"
    case "zeus":
      return "Zeus / Baddies"
    case "ninety-day":
      return "90 Day"
    case "hip-hop":
      return "Hip-Hop"
    case "drama":
      return "Drama"
    case "dating":
      return "Dating"
    case "competition":
      return "Competition"
    case "comedy":
      return "Comedy"
    case "lifestyle":
      return "Lifestyle"
    default: {
      const exhaustive: never = collection
      return exhaustive
    }
  }
}

export function latestEpisode(show: Show): Episode | undefined {
  return [...show.episodes].sort((left, right) =>
    right.aired.localeCompare(left.aired)
  )[0]
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

export function formatAired(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00`)
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date)
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

function matchesQuery(haystack: string, query: string): boolean {
  return haystack.toLowerCase().includes(query.trim().toLowerCase())
}

export function filterShows(options: {
  query?: string
  genre?: Genre | "all"
  network?: Network | "all"
  collection?: Collection | "all"
}): Show[] {
  const query = options.query?.trim() ?? ""
  const genre = options.genre ?? "all"
  const network = options.network ?? "all"
  const collection = options.collection ?? "all"

  return SHOWS.filter((show) => {
    if (collection !== "all" && show.collection !== collection) {
      return false
    }
    if (genre !== "all" && !show.genres.includes(genre)) {
      return false
    }
    if (network !== "all" && show.network !== network) {
      return false
    }
    if (query.length === 0) {
      return true
    }
    const creditNames = show.credits
      .map((credit) => requirePerson(credit.personId).name)
      .join(" ")
    const episodeTitles = show.episodes.map((episode) => episode.title).join(" ")
    return matchesQuery(
      `${show.title} ${show.logline} ${show.network} ${show.officialHome} ${show.genres.join(" ")} ${creditNames} ${episodeTitles}`,
      query
    )
  })
}

export function latestEpisodes(limit = 12): CatalogEpisode[] {
  return SHOWS.flatMap((show) =>
    show.episodes.map((episode) => ({
      ...episode,
      showId: show.id,
      showTitle: show.title,
      network: show.network,
      posterHue: show.posterHue,
    }))
  )
    .sort((left, right) => right.aired.localeCompare(left.aired))
    .slice(0, limit)
}

export function showsByGenre(genre: Genre): Show[] {
  return SHOWS.filter((show) => show.genres.includes(genre))
}

export function showsByCollection(collection: Collection): Show[] {
  return SHOWS.filter((show) => show.collection === collection)
}

export function usedCollections(): Collection[] {
  const present = new Set(SHOWS.map((show) => show.collection))
  return COLLECTIONS.filter((collection) => present.has(collection))
}

export function peopleInLatestEpisodes(limit = 12) {
  const seen = new Set<string>()
  const result: { person: Person; show: Show; role: string }[] = []

  for (const episode of latestEpisodes(20)) {
    const show = getShow(episode.showId)
    if (!show) {
      continue
    }
    for (const credit of billedCredits(show)) {
      if (seen.has(credit.personId)) {
        continue
      }
      seen.add(credit.personId)
      result.push({
        person: requirePerson(credit.personId),
        show,
        role: credit.role,
      })
      if (result.length >= limit) {
        return result
      }
    }
  }

  return result
}

export function featuredShow(): Show {
  const drop = getShow("the-drop")
  if (drop) {
    return drop
  }
  const first = SHOWS[0]
  if (!first) {
    throw new Error("Catalog is empty")
  }
  return first
}

export type PersonCredit = {
  show: Show
  role: string
  billed: boolean
}

export function creditsForPerson(personId: string): PersonCredit[] {
  return SHOWS.flatMap((show) =>
    show.credits
      .filter((credit) => credit.personId === personId)
      .map((credit) => ({
        show,
        role: credit.role,
        billed: credit.billed,
      }))
  )
}

export function searchPeople(query: string): Person[] {
  if (query.trim().length === 0) {
    return PEOPLE
  }
  return PEOPLE.filter((person) => matchesQuery(person.name, query))
}

export function usedNetworks(): Network[] {
  return Array.from(new Set(SHOWS.map((show) => show.network))).sort()
}

export function usedGenres(): Genre[] {
  return Array.from(new Set(SHOWS.flatMap((show) => show.genres)))
}

export function initials(name: string): string {
  const parts = name.split(" ").filter((part) => part.length > 0 && !part.startsWith('"'))
  const first = parts[0]?.[0] ?? ""
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : ""
  return `${first}${last}`.toUpperCase()
}
