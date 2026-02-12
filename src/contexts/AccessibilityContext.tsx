import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

interface AccessibilityPreferences {
  /** Font size multiplier: 1 = default, 1.25 = large, 1.5 = extra large */
  fontSize: number;
  /** High contrast mode */
  highContrast: boolean;
  /** Reduced motion preference (respects OS-level by default) */
  reducedMotion: boolean;
  /** Highlight links for visibility */
  highlightLinks: boolean;
  /** Large cursor mode */
  largeCursor: boolean;
}

interface AccessibilityContextType {
  preferences: AccessibilityPreferences;
  setFontSize: (size: number) => void;
  toggleHighContrast: () => void;
  toggleReducedMotion: () => void;
  toggleHighlightLinks: () => void;
  toggleLargeCursor: () => void;
  resetPreferences: () => void;
  /** Announce a message to screen readers via live region */
  announce: (message: string, priority?: 'polite' | 'assertive') => void;
}

const STORAGE_KEY = 'a11y-preferences';

const defaultPreferences: AccessibilityPreferences = {
  fontSize: 1,
  highContrast: false,
  reducedMotion: false,
  highlightLinks: false,
  largeCursor: false,
};

function getSystemReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function loadPreferences(): AccessibilityPreferences {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return { ...defaultPreferences, ...parsed };
    }
  } catch {
    // Ignore parse errors
  }
  return {
    ...defaultPreferences,
    reducedMotion: getSystemReducedMotion(),
  };
}

function savePreferences(prefs: AccessibilityPreferences): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Ignore storage errors
  }
}

const AccessibilityContext = createContext<AccessibilityContextType | undefined>(undefined);

export const AccessibilityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [preferences, setPreferences] = useState<AccessibilityPreferences>(loadPreferences);
  const [politeMessage, setPoliteMessage] = useState('');
  const [assertiveMessage, setAssertiveMessage] = useState('');

  // Apply preferences to document
  useEffect(() => {
    const root = document.documentElement;

    // Font size
    root.style.setProperty('--a11y-font-scale', String(preferences.fontSize));
    if (preferences.fontSize !== 1) {
      root.style.fontSize = `${preferences.fontSize * 100}%`;
    } else {
      root.style.fontSize = '';
    }

    // High contrast
    root.classList.toggle('a11y-high-contrast', preferences.highContrast);

    // Reduced motion
    root.classList.toggle('a11y-reduced-motion', preferences.reducedMotion);

    // Highlight links
    root.classList.toggle('a11y-highlight-links', preferences.highlightLinks);

    // Large cursor
    root.classList.toggle('a11y-large-cursor', preferences.largeCursor);

    // Persist
    savePreferences(preferences);
  }, [preferences]);

  // Listen for OS-level motion preference changes
  useEffect(() => {
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = (e: MediaQueryListEvent) => {
      setPreferences(prev => ({ ...prev, reducedMotion: e.matches }));
    };
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  const setFontSize = useCallback((size: number) => {
    setPreferences(prev => ({ ...prev, fontSize: size }));
  }, []);

  const toggleHighContrast = useCallback(() => {
    setPreferences(prev => ({ ...prev, highContrast: !prev.highContrast }));
  }, []);

  const toggleReducedMotion = useCallback(() => {
    setPreferences(prev => ({ ...prev, reducedMotion: !prev.reducedMotion }));
  }, []);

  const toggleHighlightLinks = useCallback(() => {
    setPreferences(prev => ({ ...prev, highlightLinks: !prev.highlightLinks }));
  }, []);

  const toggleLargeCursor = useCallback(() => {
    setPreferences(prev => ({ ...prev, largeCursor: !prev.largeCursor }));
  }, []);

  const resetPreferences = useCallback(() => {
    const defaults = {
      ...defaultPreferences,
      reducedMotion: getSystemReducedMotion(),
    };
    setPreferences(defaults);
  }, []);

  const announce = useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    if (priority === 'assertive') {
      setAssertiveMessage('');
      // Force re-render for screen reader to pick up change
      requestAnimationFrame(() => setAssertiveMessage(message));
    } else {
      setPoliteMessage('');
      requestAnimationFrame(() => setPoliteMessage(message));
    }
  }, []);

  return (
    <AccessibilityContext.Provider
      value={{
        preferences,
        setFontSize,
        toggleHighContrast,
        toggleReducedMotion,
        toggleHighlightLinks,
        toggleLargeCursor,
        resetPreferences,
        announce,
      }}
    >
      {children}

      {/* Global screen reader live regions */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {politeMessage}
      </div>
      <div
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
        className="sr-only"
      >
        {assertiveMessage}
      </div>
    </AccessibilityContext.Provider>
  );
};

export function useAccessibility(): AccessibilityContextType {
  const context = useContext(AccessibilityContext);
  if (!context) {
    throw new Error('useAccessibility must be used within an AccessibilityProvider');
  }
  return context;
}

export default AccessibilityContext;
