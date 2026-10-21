export type SitePost = {
  showId: string
  showTitle: string
  season: number
  number: number
  title: string
  aired: string
}

export const SITE_SERIES: { id: string; title: string }[] = [
  { id: "reasonable-doubt", title: "Reasonable Doubt (2022)" },
  { id: "90-day-hunt-for-love", title: "90 Day: Hunt for Love" },
  { id: "rhol", title: "The Real Housewives of London" },
  { id: "forever-girls", title: "Forever Girls" },
  { id: "baddies-usa", title: "Baddies USA" },
  { id: "rhop", title: "The Real Housewives of Potomac" },
  { id: "90-day-other-way", title: "90 Day Fiancé: The Other Way" },
  { id: "south-central", title: "South Central Family Reunion Tour" },
  { id: "love-on-both-sides", title: "Love On Both Sides" },
  { id: "baddies-gone-wild", title: "Baddies Gone Wild Cancun" },
  { id: "bad-boys-cancun", title: "Bad Boys Cancun" },
  { id: "love-marriage-huntsville", title: "Love & Marriage Huntsville" },
  { id: "love-after-lockup", title: "Love After Lockup: Relationship Rehab" },
  { id: "the-traitors-new-blood", title: "The Traitors: New Blood" },
  { id: "american-horror-story", title: "American Horror Story" },
  { id: "rhoc", title: "The Real Housewives of Orange County" },
  { id: "coming-up-miami", title: "Coming Up Miami" },
  { id: "drag-race-uk", title: "RuPaul’s Drag Race UK" },
  { id: "sistas", title: "Sistas" },
  { id: "the-kardashians", title: "The Kardashians" },
  { id: "rhoslc", title: "The Real Housewives of Salt Lake City" },
  { id: "wayh", title: "WAYH TV Comedy House Bootcamp" },
  { id: "abbott-elementary", title: "Abbott Elementary" },
  { id: "caught-in-the-act", title: "Caught in the Act: Unfaithful" },
  { id: "the-challenge", title: "The Challenge" },
  { id: "sacrifice", title: "Sacrifice" },
  { id: "the-drop", title: "The Drop: A Snowfall Saga" },
  { id: "rhony", title: "The Real Housewives of New York City" },
]

export const SITE_POSTS: SitePost[] = [
  { showId: "forever-girls", showTitle: "Forever Girls: ATL", season: 1, number: 2, title: "", aired: "2026-10-19" },
  { showId: "south-central", showTitle: "South Central Family Reunion", season: 1, number: 5, title: "", aired: "2026-10-18" },
  { showId: "baddies-usa", showTitle: "Baddies USA", season: 2, number: 21, title: "", aired: "2026-10-18" },
  { showId: "love-on-both-sides", showTitle: "Love On Both Sides", season: 1, number: 10, title: "", aired: "2026-10-18" },
  { showId: "bad-boys-cancun", showTitle: "Bad Boys: Cancun", season: 1, number: 7, title: "", aired: "2026-10-18" },
  { showId: "baddies-gone-wild", showTitle: "Baddies Gone Wild: Cancun", season: 1, number: 6, title: "", aired: "2026-10-18" },
  { showId: "forever-girls", showTitle: "Forever Girls: ATL", season: 1, number: 1, title: "", aired: "2026-10-18" },
  { showId: "love-marriage-huntsville", showTitle: "Love & Marriage Huntsville", season: 11, number: 6, title: "The Art of War", aired: "2026-10-18" },
  { showId: "love-after-lockup", showTitle: "Love After Lockup: Relationship Rehab", season: 1, number: 3, title: "Breakdowns & Breakthroughs", aired: "2026-10-17" },
  { showId: "ready-to-love", showTitle: "Ready To Love", season: 13, number: 3, title: "Stepping Into Your Chicago", aired: "2026-10-17" },
  { showId: "baddies-retreat", showTitle: "Baddies Retreat", season: 2, number: 1, title: "", aired: "2026-10-16" },
  { showId: "coming-up-miami", showTitle: "Coming Up Miami", season: 2, number: 18, title: "", aired: "2026-10-15" },
  { showId: "sistas", showTitle: "Sistas", season: 10, number: 13, title: "Long Row To Hoe", aired: "2026-10-14" },
  { showId: "sistas", showTitle: "Sistas", season: 10, number: 12, title: "Hello Goodbye", aired: "2026-10-14" },
  { showId: "caught-in-the-act", showTitle: "Unfaithful: Caught In The Act", season: 4, number: 26, title: "Never Tell The Whole Truth", aired: "2026-10-14" },
  { showId: "the-drop", showTitle: "The Drop: A Snowfall Saga", season: 1, number: 6, title: "Exit Wounds", aired: "2026-10-14" },
  { showId: "abbott-elementary", showTitle: "Abbott Elementary", season: 6, number: 2, title: "Check-Ins", aired: "2026-10-14" },
  { showId: "rhony", showTitle: "Real Housewives Of New York", season: 16, number: 6, title: "Moskito Madness", aired: "2026-10-13" },
  { showId: "varnell-hill", showTitle: "The Varnell Hill Show", season: 1, number: 8, title: "Two Steps Back", aired: "2026-10-13" },
  { showId: "reasonable-doubt", showTitle: "Reasonable Doubt", season: 4, number: 4, title: "", aired: "2026-10-13" },
  { showId: "rhop", showTitle: "Real Housewives Of Potomac", season: 11, number: 1, title: "Read Between The Lies", aired: "2026-10-11" },
  { showId: "baddies-usa", showTitle: "Baddies USA", season: 2, number: 20, title: "", aired: "2026-10-11" },
  { showId: "all-or-nothing", showTitle: "All Or Nothing: Atlanta", season: 1, number: 4, title: "", aired: "2026-10-11" },
  { showId: "south-central", showTitle: "South Central Family Reunion", season: 1, number: 4, title: "", aired: "2026-10-11" },
  { showId: "pretty-hustlers", showTitle: "Pretty Hustlers", season: 1, number: 5, title: "", aired: "2026-10-11" },
  { showId: "love-on-both-sides", showTitle: "Love On Both Sides", season: 1, number: 9, title: "", aired: "2026-10-11" },
  { showId: "bad-boys-cancun", showTitle: "Bad Boys: Cancun", season: 1, number: 6, title: "", aired: "2026-10-11" },
  { showId: "baddies-gone-wild", showTitle: "Baddies Gone Wild: Cancun", season: 1, number: 5, title: "", aired: "2026-10-11" },
  { showId: "love-marriage-huntsville", showTitle: "Love & Marriage Huntsville", season: 11, number: 5, title: "Martell’s Destiny?", aired: "2026-10-10" },
]
