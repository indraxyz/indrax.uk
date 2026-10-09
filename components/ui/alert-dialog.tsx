import { AlertDialog as AlertDialogPrimitive } from "@base-ui/react/alert-dialog"
import type { ComponentProps } from "react"

import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const AlertDialog = AlertDialogPrimitive.Root
const AlertDialogTrigger = AlertDialogPrimitive.Trigger

function AlertDialogContent({
  className,
  ...props
}: ComponentProps<typeof AlertDialogPrimitive.Popup>) {
  return (
    <AlertDialogPrimitive.Portal>
      <AlertDialogPrimitive.Backdrop className="fixed inset-0 z-[70] bg-black/60" />
      <AlertDialogPrimitive.Popup
        className={cn(
          "fixed top-1/2 left-1/2 z-[70] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 border-2 border-border bg-card p-6 text-card-foreground shadow-soft-lg outline-none",
          className
        )}
        {...props}
      />
    </AlertDialogPrimitive.Portal>
  )
}

function AlertDialogHeader({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("space-y-2", className)} {...props} />
}

function AlertDialogTitle({
  className,
  ...props
}: ComponentProps<typeof AlertDialogPrimitive.Title>) {
  return (
    <AlertDialogPrimitive.Title
      className={cn("text-lg font-black uppercase tracking-tight", className)}
      {...props}
    />
  )
}

function AlertDialogDescription({
  className,
  ...props
}: ComponentProps<typeof AlertDialogPrimitive.Description>) {
  return (
    <AlertDialogPrimitive.Description
      className={cn("text-sm font-semibold text-muted-foreground", className)}
      {...props}
    />
  )
}

function AlertDialogFooter({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("mt-6 flex flex-wrap justify-end gap-2", className)} {...props} />
}

function AlertDialogCancel({
  className,
  ...props
}: ComponentProps<typeof AlertDialogPrimitive.Close>) {
  return (
    <AlertDialogPrimitive.Close
      className={cn(buttonVariants({ variant: "secondary", size: "sm" }), className)}
      {...props}
    />
  )
}

function AlertDialogAction({ className, ...props }: ComponentProps<"button">) {
  return (
    <button
      type="button"
      className={cn(buttonVariants({ variant: "destructive", size: "sm" }), className)}
      {...props}
    />
  )
}

export {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
}
