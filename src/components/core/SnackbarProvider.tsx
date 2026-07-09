import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from "react";

import { Snackbar } from "./Snackbar";

type SnackbarVariant = "default" | "error";
type SnackbarPosition = "top" | "bottom";

type ShowSnackbarOptions = {
  message: string;
  duration?: number;
  actionLabel?: string;
  onAction?: () => void;
  variant?: SnackbarVariant;
  position?: SnackbarPosition;
};

type SnackbarContextValue = {
  showSnackbar: (options: ShowSnackbarOptions | string) => void;
  hideSnackbar: () => void;
};

const SnackbarContext = createContext<SnackbarContextValue | null>(null);

export function useSnackbar(): SnackbarContextValue {
  const ctx = useContext(SnackbarContext);
  if (!ctx) {
    throw new Error("useSnackbar must be used within a SnackbarProvider");
  }
  return ctx;
}

type SnackbarState = ShowSnackbarOptions & { visible: boolean; nonce: number };

export function SnackbarProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SnackbarState | null>(null);
  const nonceRef = useRef(0);

  const showSnackbar = useCallback((options: ShowSnackbarOptions | string) => {
    const normalized: ShowSnackbarOptions =
      typeof options === "string" ? { message: options } : options;
    nonceRef.current += 1;
    setState({ ...normalized, visible: true, nonce: nonceRef.current });
  }, []);

  const hideSnackbar = useCallback(() => {
    setState((prev) => (prev ? { ...prev, visible: false } : prev));
  }, []);

  const value = useMemo<SnackbarContextValue>(
    () => ({ showSnackbar, hideSnackbar }),
    [showSnackbar, hideSnackbar]
  );

  return (
    <SnackbarContext.Provider value={value}>
      {children}
      {state ? (
        <Snackbar
          // Remount on every call so the animation replays even if the
          // message is identical to the previous one.
          key={state.nonce}
          visible={state.visible}
          message={state.message}
          duration={state.duration}
          actionLabel={state.actionLabel}
          onAction={state.onAction}
          variant={state.variant}
          position={state.position}
          onDismiss={hideSnackbar}
        />
      ) : null}
    </SnackbarContext.Provider>
  );
}
