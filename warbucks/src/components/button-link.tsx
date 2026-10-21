import { Link, type LinkProps } from "react-router-dom"

import {
  buttonClass,
  type ButtonSize,
  type ButtonVariant,
} from "@/components/ui/button"

type ButtonLinkProps = LinkProps & {
  variant?: ButtonVariant
  size?: ButtonSize
}

export function ButtonLink({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonLinkProps) {
  return <Link className={buttonClass(variant, size, className)} {...props} />
}
