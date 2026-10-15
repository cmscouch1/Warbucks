import { useCallback, useState } from "react"

import { readFavorites, toggleFavorite, writeFavorites } from "@/lib/favorites"

export function useFavorites() {
  const [ids, setIds] = useState<string[]>(() => readFavorites())

  const isSaved = useCallback((id: string) => ids.includes(id), [ids])

  const toggle = useCallback((id: string) => {
    setIds((current) => {
      const next = toggleFavorite(id, current)
      writeFavorites(next)
      return next
    })
  }, [])

  return { ids, isSaved, toggle }
}
