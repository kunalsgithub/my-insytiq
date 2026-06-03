import { useToast } from "../../hooks/use-toast"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "./toast"

export function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, ...props }) {
        return (
          <Toast key={id} {...props} className="flex-col items-stretch gap-3">
            <div className="flex w-full items-start gap-3 pr-6">
              <div className="grid flex-1 gap-1">
                {title && <ToastTitle>{title}</ToastTitle>}
                {description && (
                  <ToastDescription>{description}</ToastDescription>
                )}
              </div>
              <ToastClose />
            </div>
            {action ? (
              <div className="flex w-full shrink-0">{action}</div>
            ) : null}
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}
