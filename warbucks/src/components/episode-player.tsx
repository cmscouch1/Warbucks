import { useRef, useState } from "react"

import { Button } from "@/components/ui/button"

type EpisodePlayerProps = {
  src: string
  title: string
  onEnded?: () => void
}

export function EpisodePlayer({ src, title, onEnded }: EpisodePlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [started, setStarted] = useState(false)

  function play() {
    const video = videoRef.current
    if (!video) {
      return
    }
    setStarted(true)
    void video.play().catch(() => undefined)
  }

  return (
    <div className="relative overflow-hidden rounded-xl bg-black">
      <video
        ref={videoRef}
        className="aspect-video w-full"
        src={src}
        controls={started}
        playsInline
        preload="none"
        aria-label={title}
        data-testid="episode-player"
        onEnded={onEnded}
      />
      {started ? null : (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40">
          <Button size="lg" onClick={play} data-testid="play-episode">
            Play
          </Button>
        </div>
      )}
    </div>
  )
}
