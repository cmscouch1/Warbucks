const STORAGE_KEY = "warbucks-continue"

export type ContinueWatching = {
  showId: string
  season: number
  number: number
}

export function readContinue(): ContinueWatching | null {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) {
    return null
  }
  try {
    const parsed: unknown = JSON.parse(raw)
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("showId" in parsed) ||
      !("season" in parsed) ||
      !("number" in parsed)
    ) {
      return null
    }
    const record = parsed as Record<string, unknown>
    if (
      typeof record.showId !== "string" ||
      typeof record.season !== "number" ||
      typeof record.number !== "number"
    ) {
      return null
    }
    return {
      showId: record.showId,
      season: record.season,
      number: record.number,
    }
  } catch {
    return null
  }
}

export function writeContinue(progress: ContinueWatching): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress))
}
