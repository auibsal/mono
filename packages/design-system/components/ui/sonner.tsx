"use client"

import { CheckIcon, Loader2Icon } from "lucide-react"
import { Toaster as Sonner, type ToasterProps } from "sonner"

const Toaster = ({ ...props }: ToasterProps) => {
  // SAL: light only; functional icons only (check, loading).
  return (
    <Sonner
      theme="light"
      className="toaster group"
      icons={{
        success: <CheckIcon aria-hidden="true" className="size-4" />,
        info: null,
        warning: null,
        error: null,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
