import { ButtonLink } from "@/components/button-link"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"

export function NotFoundPage() {
  return (
    <Empty className="border">
      <EmptyHeader>
        <EmptyTitle>Page not found</EmptyTitle>
        <EmptyDescription>That route is not in this guide.</EmptyDescription>
      </EmptyHeader>
      <ButtonLink to="/">Go home</ButtonLink>
    </Empty>
  )
}
