import { cn } from "cn"

import { formatEpisodeCode } from "@/lib/queries"
import type { Show } from "@/lib/types"

type PosterProps = {
  show: Pick<Show, "title" | "network" | "posterHue" | "year">
  className?: string
  size?: "card" | "hero" | "thumb"
  episode?: { season: number; number: number }
}

export function Poster({
  show,
  className,
  size = "card",
  episode,
}: PosterProps) {
  return (
    <div
      className={cn(
        "relative flex overflow-hidden rounded-lg text-left",
        size === "hero" && "min-h-72 w-full items-end p-6 md:min-h-96",
        size === "card" && "aspect-2/3 w-full flex-col justify-end p-3",
        size === "thumb" && "size-16 shrink-0 items-end p-1.5",
        className
      )}
      style={{
        background: `oklch(0.32 0.09 ${show.posterHue})`,
        color: `oklch(0.96 0.03 ${show.posterHue})`,
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          background: `repeating-linear-gradient(-12deg, transparent, transparent 18px, oklch(1 0 0 / 6%) 18px, oklch(1 0 0 / 6%) 19px)`,
        }}
      />
      <div className="relative flex w-full flex-col gap-1">
        {size !== "thumb" ? (
          <p className="text-[0.65rem] font-medium tracking-[0.18em] uppercase opacity-80">
            {show.network}
          </p>
        ) : null}
        <p
          className={cn(
            "font-heading leading-tight",
            size === "hero" && "text-3xl md:text-5xl",
            size === "card" && "text-lg",
            size === "thumb" && "truncate text-[0.65rem]"
          )}
        >
          {show.title}
        </p>
        {size === "hero" ? (
          <p className="text-sm opacity-80">{show.year}</p>
        ) : null}
        {episode ? (
          <p className="text-xs opacity-80">
            {formatEpisodeCode(episode.season, episode.number)}
          </p>
        ) : null}
      </div>
    </div>
  )
}
