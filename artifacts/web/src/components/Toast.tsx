import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

type ToastFn = (message: string) => void;
const ToastContext = createContext<ToastFn>(() => undefined);
export function ToastProvider({ children }: { children: ReactNode }) {
  const [message,setMessage] = useState("");
  const toast = useCallback((next: string) => setMessage(next), []);
  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(""), 3200);
    return () => window.clearTimeout(timer);
  }, [message]);
  return <ToastContext.Provider value={toast}>{children}{message && <div className="toast" role="status" data-testid="status-toast">{message}</div>}</ToastContext.Provider>;
}
export function useToast() { return useContext(ToastContext); }