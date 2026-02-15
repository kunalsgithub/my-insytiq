import { useEffect, useMemo, useState } from 'react';

/**
 * Determines dev mode dynamically without server restart.
 * Priority:
 * 1) window.__DEV_MODE__ (boolean) for immediate overrides in console
 * 2) localStorage('VITE_DEV_MODE') = 'true'|'false' for runtime toggles
 * 3) import.meta.env.VITE_DEV_MODE for default from .env
 */
export function useDevMode(): boolean {
  const envDefault = useMemo(() => {
    const raw = (import.meta as any)?.env?.VITE_DEV_MODE;
    if (typeof raw === 'boolean') return raw;
    if (typeof raw === 'string') return raw.toLowerCase() === 'true';
    return false;
  }, []);

  const getFromLocalStorage = () => {
    try {
      const val = localStorage.getItem('VITE_DEV_MODE');
      if (val == null) return undefined;
      return val.toLowerCase() === 'true';
    } catch {
      return undefined;
    }
  };

  const getFromWindow = () => {
    try {
      const w = window as any;
      if (typeof w.__DEV_MODE__ === 'boolean') return w.__DEV_MODE__ as boolean;
      return undefined;
    } catch {
      return undefined;
    }
  };

  const compute = (): boolean => {
    const winVal = getFromWindow();
    if (typeof winVal === 'boolean') return winVal;
    const lsVal = getFromLocalStorage();
    if (typeof lsVal === 'boolean') return lsVal;
    return envDefault;
  };

  const [devMode, setDevMode] = useState<boolean>(compute);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'VITE_DEV_MODE') {
        setDevMode(compute());
      }
    };
    window.addEventListener('storage', onStorage);

    // Allow manual overrides via custom event when setting window.__DEV_MODE__ programmatically
    const onCustom = () => setDevMode(compute());
    window.addEventListener('dev-mode-changed', onCustom as EventListener);

    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('dev-mode-changed', onCustom as EventListener);
    };
  }, [envDefault]);

  return devMode;
}

export function setDevModeRuntime(value: boolean) {
  try {
    localStorage.setItem('VITE_DEV_MODE', value ? 'true' : 'false');
    // Dispatch a custom event to update all tabs immediately
    window.dispatchEvent(new Event('dev-mode-changed'));
  } catch {
    // ignore
  }
}

