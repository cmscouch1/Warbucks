import { Link, useParams } from "react-router-dom"

import { PersonAvatar } from "@/components/person-avatar"
import { ShowCard } from "@/components/show-card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"
import { creditsForPerson, getPerson } from "@/lib/queries"

export function PersonDetailPage() {
  const { personId } = useParams()
  const person = personId ? getPerson(personId) : undefined

  if (!person) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyTitle>Person not in the catalog</EmptyTitle>
          <EmptyDescription>Browse the full cast list instead.</EmptyDescription>
        </EmptyHeader>
        <Button render={<Link to="/people" />}>Back to cast</Button>
      </Empty>
    )
  }

  const credits = creditsForPerson(person.id)

  return (
    <div className="flex flex-col gap-8">
      <section className="flex items-center gap-4">
        <PersonAvatar person={person} size="lg" />
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-3xl">{person.name}</h1>
          <p className="text-sm text-muted-foreground">
            {credits.length} {credits.length === 1 ? "credit" : "credits"} in this
            catalog
          </p>
        </div>
      </section>
      <section className="flex flex-col gap-4">
        <h2 className="font-heading text-2xl">Credits</h2>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {credits.map((credit) => (
            <div key={credit.show.id} className="flex flex-col gap-2">
              <ShowCard show={credit.show} />
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{credit.role}</Badge>
                {credit.billed ? <Badge>Billed</Badge> : <Badge variant="secondary">Supporting</Badge>}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
