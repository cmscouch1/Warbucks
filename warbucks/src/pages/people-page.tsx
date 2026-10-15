import { useMemo, useState } from "react"
import { Link } from "react-router-dom"

import { PersonAvatar } from "@/components/person-avatar"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"
import { Input } from "@/components/ui/input"
import { creditsForPerson, searchPeople } from "@/lib/queries"

export function PeoplePage() {
  const [query, setQuery] = useState("")
  const people = useMemo(() => searchPeople(query), [query])

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="font-heading text-3xl">Cast</h1>
        <p className="text-muted-foreground">
          Every billed and supporting name in the catalog, with the shows they
          appear in.
        </p>
      </div>
      <Input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search people"
        aria-label="Search people"
        className="max-w-sm"
      />
      {people.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>No people match</EmptyTitle>
            <EmptyDescription>Try another name.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {people.map((person) => {
            const credits = creditsForPerson(person.id)
            const shows = credits.map((credit) => credit.show.title).join(" · ")
            return (
              <Link
                key={person.id}
                to={`/people/${person.id}`}
                className="flex items-center gap-3 rounded-xl border p-3 hover:bg-muted/60"
              >
                <PersonAvatar person={person} size="lg" />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate font-medium">{person.name}</span>
                  <span className="truncate text-sm text-muted-foreground">
                    {shows || "No credits yet"}
                  </span>
                </span>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
