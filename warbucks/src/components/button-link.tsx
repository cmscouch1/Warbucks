import { type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { Link, type LinkProps } from "react-router-dom"

import { buttonVariants } from "@/components/ui/button"

type ButtonLinkProps = LinkProps & VariantProps<typeof buttonVariants>

export function ButtonLink({
  className,
  variant,
  size,
  ...props
}: ButtonLinkProps) {
  return (
    <Link
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}
