import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { initials } from "@/lib/queries"
import type { Person } from "@/lib/types"

type PersonAvatarProps = {
  person: Person
  size?: "default" | "sm" | "lg"
}

export function PersonAvatar({ person, size = "default" }: PersonAvatarProps) {
  return (
    <Avatar size={size}>
      <AvatarFallback>{initials(person.name)}</AvatarFallback>
    </Avatar>
  )
}
