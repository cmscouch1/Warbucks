import type { ButtonHTMLAttributes } from "react"

const variants = {
  default: "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
  outline: "border-border bg-background hover:bg-muted hover:text-foreground",
  ghost: "border-transparent hover:bg-muted hover:text-foreground",
} as const

const sizes = {
  default: "h-11 px-3",
  sm: "h-9 px-2.5 text-[0.8rem]",
  lg: "h-12 px-4",
} as const

export type ButtonVariant = keyof typeof variants
export type ButtonSize = keyof typeof sizes

export function buttonClass(
  variant: ButtonVariant = "default",
  size: ButtonSize = "default",
  className = ""
): string {
  return [
    "inline-flex items-center justify-center gap-1.5 rounded-lg border text-sm font-medium whitespace-nowrap transition-colors outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50",
    variants[variant],
    sizes[size],
    className,
  ]
    .filter(Boolean)
    .join(" ")
}

function Button({
  className,
  variant = "default",
  size = "default",
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: ButtonSize
}) {
  return (
    <button
      type={type}
      className={buttonClass(variant, size, className)}
      {...props}
    />
  )
}

export { Button }
