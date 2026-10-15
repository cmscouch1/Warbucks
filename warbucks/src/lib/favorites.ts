const STORAGE_KEY = "warbucks-favorites"

export function readFavorites(): string[] {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) {
    return []
  }
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) {
      return []
    }
    return parsed.filter((value): value is string => typeof value === "string")
  } catch {
    return []
  }
}

export function writeFavorites(ids: string[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ids))
}

export function toggleFavorite(id: string, current: string[]): string[] {
  if (current.includes(id)) {
    return current.filter((item) => item !== id)
  }
  return [...current, id]
}
