import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

const STORAGE_KEY = 'splitwise_current_user_name';

interface AppContextValue {
  currentUserName: string | null;
  setCurrentUserName: (name: string) => void;
  showNameModal: boolean;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [currentUserName, setNameState] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored?.trim()) {
      setNameState(stored.trim());
    }
    setHydrated(true);
  }, []);

  const setCurrentUserName = useCallback((name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    localStorage.setItem(STORAGE_KEY, trimmed);
    setNameState(trimmed);
  }, []);

  const value = useMemo(
    () => ({
      currentUserName,
      setCurrentUserName,
      showNameModal: hydrated && !currentUserName,
    }),
    [currentUserName, hydrated, setCurrentUserName],
  );

  if (!hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-500">
        Loading…
      </div>
    );
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
