import { Link } from "react-router-dom"

import { Button } from "@/components/ui/button"
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
      <Button render={<Link to="/" />}>Go home</Button>
    </Empty>
  )
}
