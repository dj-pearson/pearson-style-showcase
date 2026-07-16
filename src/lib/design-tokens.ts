/**
 * Design tokens — the single source of truth for interactive-element sizing,
 * touch targets, radii, and badge opacities used across the UI.
 *
 * These constants document the design system; the actual enforcement lives in
 * the shared primitives (src/components/ui/button.tsx, input.tsx, badge.tsx) so
 * components stay consistent without per-instance overrides. Import these when
 * you need the raw values (e.g. computing layout in JS/canvas/charts).
 */

/** Button heights (visual). Every button also enforces a 44px minimum touch target. */
export const BUTTON_HEIGHT = {
  sm: 36,
  md: 44,
  lg: 52,
} as const;

/** Standard form input height. */
export const INPUT_HEIGHT = 44;

/**
 * Minimum accessible touch-target size (WCAG 2.5.5 / Apple HIG). Applied as a
 * floor to all buttons, inputs, and icon buttons.
 */
export const MIN_TOUCH_TARGET = 44;

/**
 * Minimum readable font size on mobile (px). Body/meta text must not render
 * smaller than this on small screens (Tailwind `text-sm`).
 */
export const MIN_MOBILE_FONT_SIZE = 14;

/** Standard border radius values (px), matching the Tailwind/`--radius` scale. */
export const BORDER_RADIUS = {
  sm: 4,
  md: 6,
  lg: 8,
  xl: 12,
  full: 9999,
} as const;

/**
 * Badge background opacity convention:
 * - `informational` badges use a 20% tinted background (subtle).
 * - `critical` / featured badges use a 90% solid background (high emphasis).
 */
export const BADGE_OPACITY = {
  informational: 0.2,
  critical: 0.9,
} as const;

export type ButtonSizeToken = keyof typeof BUTTON_HEIGHT;
export type BorderRadiusToken = keyof typeof BORDER_RADIUS;
