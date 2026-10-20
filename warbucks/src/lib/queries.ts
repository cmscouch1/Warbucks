import { PEOPLE } from "@/data/people"
import { SHOWS } from "@/data/shows"
import type {
  CatalogEpisode,
  Genre,
  Network,
  Person,
  Show,
  ShowStatus,
} from "@/lib/types"

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

export function getShow(id: string): Show | undefined {
  return showsById.get(id)
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

function matchesQuery(haystack: string, query: string): boolean {
  return haystack.toLowerCase().includes(query.trim().toLowerCase())
}

export function filterShows(options: {
  query?: string
  genre?: Genre | "all"
  network?: Network | "all"
}): Show[] {
  const query = options.query?.trim() ?? ""
  const genre = options.genre ?? "all"
  const network = options.network ?? "all"

  return SHOWS.filter((show) => {
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
