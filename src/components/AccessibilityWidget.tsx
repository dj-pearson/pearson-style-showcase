import React, { useState, useEffect, useRef } from 'react';
import { useAccessibility } from '@/contexts/AccessibilityContext';
import {
  Accessibility,
  Type,
  Sun,
  Pause,
  Link2,
  MousePointer2,
  RotateCcw,
  X,
  Minus,
  Plus,
} from 'lucide-react';

const AccessibilityWidget: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const {
    preferences,
    setFontSize,
    toggleHighContrast,
    toggleReducedMotion,
    toggleHighlightLinks,
    toggleLargeCursor,
    resetPreferences,
    announce,
  } = useAccessibility();

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Focus trap within the panel
  useEffect(() => {
    if (!isOpen || !panelRef.current) return;

    const panel = panelRef.current;
    const focusableElements = panel.querySelectorAll<HTMLElement>(
      'button, [tabindex]:not([tabindex="-1"])'
    );
    const firstFocusable = focusableElements[0];
    const lastFocusable = focusableElements[focusableElements.length - 1];

    // Focus close button when panel opens
    const closeBtn = panel.querySelector<HTMLElement>('[data-close-btn]');
    closeBtn?.focus();

    const handleTabTrap = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstFocusable) {
          e.preventDefault();
          lastFocusable?.focus();
        }
      } else {
        if (document.activeElement === lastFocusable) {
          e.preventDefault();
          firstFocusable?.focus();
        }
      }
    };

    panel.addEventListener('keydown', handleTabTrap);
    return () => panel.removeEventListener('keydown', handleTabTrap);
  }, [isOpen]);

  // Close when clicking outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const fontSizeLabel =
    preferences.fontSize === 1
      ? 'Default'
      : preferences.fontSize === 1.125
        ? 'Large'
        : preferences.fontSize === 1.25
          ? 'Extra Large'
          : `${Math.round(preferences.fontSize * 100)}%`;

  const decreaseFontSize = () => {
    const newSize = Math.max(0.875, preferences.fontSize - 0.125);
    setFontSize(newSize);
    announce(`Font size decreased to ${Math.round(newSize * 100)}%`);
  };

  const increaseFontSize = () => {
    const newSize = Math.min(1.5, preferences.fontSize + 0.125);
    setFontSize(newSize);
    announce(`Font size increased to ${Math.round(newSize * 100)}%`);
  };

  const handleToggle = (
    toggle: () => void,
    name: string,
    currentState: boolean
  ) => {
    toggle();
    announce(`${name} ${currentState ? 'disabled' : 'enabled'}`);
  };

  const handleReset = () => {
    resetPreferences();
    announce('Accessibility preferences reset to defaults');
  };

  return (
    <>
      {/* Trigger Button - Fixed position */}
      <button
        ref={triggerRef}
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-controls="accessibility-panel"
        aria-label="Accessibility options"
        className="fixed bottom-6 right-6 z-[9999] w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center hover:scale-105 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <Accessibility className="w-6 h-6" aria-hidden="true" />
      </button>

      {/* Panel */}
      {isOpen && (
        <>
          {/* Backdrop for mobile */}
          <div
            className="fixed inset-0 bg-black/40 z-[9998] lg:hidden"
            aria-hidden="true"
            onClick={() => setIsOpen(false)}
          />

          <div
            ref={panelRef}
            id="accessibility-panel"
            role="dialog"
            aria-label="Accessibility settings"
            aria-modal="true"
            className="fixed bottom-24 right-6 z-[9999] w-[calc(100vw-3rem)] max-w-sm bg-background border border-border rounded-xl shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border bg-muted/30">
              <div className="flex items-center gap-2">
                <Accessibility className="w-5 h-5 text-primary" aria-hidden="true" />
                <h2 className="text-lg font-semibold text-foreground">
                  Accessibility
                </h2>
              </div>
              <button
                data-close-btn
                onClick={() => {
                  setIsOpen(false);
                  triggerRef.current?.focus();
                }}
                aria-label="Close accessibility settings"
                className="w-10 h-10 rounded-lg flex items-center justify-center hover:bg-muted transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            {/* Content */}
            <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
              {/* Font Size Control */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground flex items-center gap-2">
                  <Type className="w-4 h-4 text-primary" aria-hidden="true" />
                  Text Size
                  <span className="ml-auto text-xs text-muted-foreground">
                    {fontSizeLabel}
                  </span>
                </label>
                <div className="flex items-center gap-2">
                  <button
                    onClick={decreaseFontSize}
                    disabled={preferences.fontSize <= 0.875}
                    aria-label="Decrease text size"
                    className="w-10 h-10 rounded-lg border border-border flex items-center justify-center hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    <Minus className="w-4 h-4" aria-hidden="true" />
                  </button>
                  <div
                    className="flex-1 h-2 bg-muted rounded-full overflow-hidden"
                    role="progressbar"
                    aria-valuenow={Math.round(preferences.fontSize * 100)}
                    aria-valuemin={87.5}
                    aria-valuemax={150}
                    aria-label={`Text size: ${Math.round(preferences.fontSize * 100)}%`}
                  >
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-200"
                      style={{
                        width: `${((preferences.fontSize - 0.875) / (1.5 - 0.875)) * 100}%`,
                      }}
                    />
                  </div>
                  <button
                    onClick={increaseFontSize}
                    disabled={preferences.fontSize >= 1.5}
                    aria-label="Increase text size"
                    className="w-10 h-10 rounded-lg border border-border flex items-center justify-center hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    <Plus className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>
              </div>

              {/* Toggle Options */}
              <div className="space-y-2">
                <ToggleOption
                  icon={<Sun className="w-4 h-4" aria-hidden="true" />}
                  label="High Contrast"
                  description="Increase color contrast for better readability"
                  checked={preferences.highContrast}
                  onChange={() =>
                    handleToggle(
                      toggleHighContrast,
                      'High contrast',
                      preferences.highContrast
                    )
                  }
                />
                <ToggleOption
                  icon={<Pause className="w-4 h-4" aria-hidden="true" />}
                  label="Reduce Motion"
                  description="Minimize animations and transitions"
                  checked={preferences.reducedMotion}
                  onChange={() =>
                    handleToggle(
                      toggleReducedMotion,
                      'Reduced motion',
                      preferences.reducedMotion
                    )
                  }
                />
                <ToggleOption
                  icon={<Link2 className="w-4 h-4" aria-hidden="true" />}
                  label="Highlight Links"
                  description="Underline and highlight all links"
                  checked={preferences.highlightLinks}
                  onChange={() =>
                    handleToggle(
                      toggleHighlightLinks,
                      'Highlight links',
                      preferences.highlightLinks
                    )
                  }
                />
                <ToggleOption
                  icon={<MousePointer2 className="w-4 h-4" aria-hidden="true" />}
                  label="Large Cursor"
                  description="Increase the cursor size for visibility"
                  checked={preferences.largeCursor}
                  onChange={() =>
                    handleToggle(
                      toggleLargeCursor,
                      'Large cursor',
                      preferences.largeCursor
                    )
                  }
                />
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-border bg-muted/30">
              <button
                onClick={handleReset}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground rounded-lg border border-border hover:bg-muted transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                <RotateCcw className="w-4 h-4" aria-hidden="true" />
                Reset to Defaults
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
};

interface ToggleOptionProps {
  icon: React.ReactNode;
  label: string;
  description: string;
  checked: boolean;
  onChange: () => void;
}

const ToggleOption: React.FC<ToggleOptionProps> = ({
  icon,
  label,
  description,
  checked,
  onChange,
}) => {
  const id = `a11y-${label.toLowerCase().replace(/\s+/g, '-')}`;

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
      <div className="text-primary flex-shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <label htmlFor={id} className="text-sm font-medium text-foreground cursor-pointer block">
          {label}
        </label>
        <p className="text-xs text-muted-foreground" id={`${id}-desc`}>
          {description}
        </p>
      </div>
      <button
        id={id}
        role="switch"
        aria-checked={checked}
        aria-describedby={`${id}-desc`}
        onClick={onChange}
        className={`relative flex-shrink-0 w-11 h-6 rounded-full transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
          checked ? 'bg-primary' : 'bg-muted-foreground/30'
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
          aria-hidden="true"
        />
      </button>
    </div>
  );
};

export default AccessibilityWidget;
