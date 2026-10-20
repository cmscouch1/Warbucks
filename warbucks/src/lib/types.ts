export const GENRES = [
  "Drama",
  "Reality",
  "Dating",
  "Competition",
  "Comedy",
  "Legal",
  "Hip-Hop",
] as const

export type Genre = (typeof GENRES)[number]

export const NETWORKS = [
  "FX",
  "Hulu",
  "Bravo",
  "Peacock",
  "OWN",
  "TLC",
  "Zeus",
  "BET+",
  "BBC",
  "ABC",
  "MTV",
  "VH1",
  "NowThatsTV",
  "TREND",
] as const

export type Network = (typeof NETWORKS)[number]

export const SHOW_STATUSES = ["returning", "new", "limited"] as const

export type ShowStatus = (typeof SHOW_STATUSES)[number]

export const COLLECTIONS = [
  "housewives",
  "zeus",
  "ninety-day",
  "hip-hop",
  "drama",
  "dating",
  "competition",
  "comedy",
  "lifestyle",
] as const

export type Collection = (typeof COLLECTIONS)[number]

export type Person = {
  id: string
  name: string
}

export type Credit = {
  personId: string
  role: string
  billed: boolean
}

export type Episode = {
  season: number
  number: number
  title: string
  aired: string
}

export type Show = {
  id: string
  collection: Collection
  title: string
  year: number
  network: Network
  genres: Genre[]
  status: ShowStatus
  logline: string
  currentSeason: number
  posterHue: number
  officialHome: string
  credits: Credit[]
  episodes: Episode[]
}

export type CatalogEpisode = Episode & {
  showId: string
  showTitle: string
  network: Network
  posterHue: number
}
