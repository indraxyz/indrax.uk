import { Toast } from "@base-ui/react/toast"
import { X } from "lucide-react"
import type { ReactNode } from "react"

import { focusControlClassNames } from "@/components/ui/variants"

export const useToast = Toast.useToastManager

function ToastList() {
  const { toasts } = useToast()
  return toasts.map((toast) => (
    <Toast.Root
      key={toast.id}
      toast={toast}
      className="flex items-start gap-3 border-2 border-border bg-popover p-3 text-popover-foreground shadow-soft-lg data-[limited]:hidden"
    >
      <Toast.Content className="min-w-0 flex-1 self-center">
        <Toast.Title className="text-sm font-medium" />
      </Toast.Content>
      <Toast.Close
        aria-label="Dismiss notification"
        className={`inline-flex h-7 w-7 shrink-0 items-center justify-center hover:text-muted-foreground ${focusControlClassNames}`}
      >
        <X className="h-3.5 w-3.5" aria-hidden />
      </Toast.Close>
    </Toast.Root>
  ))
}

/** Scoped providers avoid adding notification code to unrelated routes. */
export function ToastProvider({ children }: { children: ReactNode }) {
  return (
    <Toast.Provider timeout={5000} limit={1}>
      {children}
      <Toast.Portal>
        <Toast.Viewport
          aria-label="Notifications"
          className="fixed right-4 top-4 z-[100] flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-2 outline-none print:hidden"
        >
          <ToastList />
        </Toast.Viewport>
      </Toast.Portal>
    </Toast.Provider>
  )
}
