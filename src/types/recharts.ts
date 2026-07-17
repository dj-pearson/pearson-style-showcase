/**
 * Shared types for Recharts custom tooltip and formatter props.
 *
 * Recharts does not export precise prop types for custom `content` tooltips or
 * value formatters, so these lightweight generics let components type their
 * tooltip/formatter callbacks instead of using `any`.
 */
import type { ReactNode } from 'react';

/** A single series entry passed to a custom tooltip in `payload`. */
export interface RechartsTooltipEntry<TDatum = Record<string, unknown>> {
  value: number | string;
  name?: string;
  dataKey?: string | number;
  color?: string;
  /** The full data object for the hovered point. */
  payload: TDatum;
}

/** Props Recharts passes to a custom tooltip `content` component. */
export interface CustomTooltipProps<TDatum = Record<string, unknown>> {
  active?: boolean;
  label?: string | number;
  payload?: RechartsTooltipEntry<TDatum>[];
}

/** Signature for a Recharts value formatter (axis ticks, tooltip values, ...). */
export type RechartsValueFormatter = (value: number | string, name?: string) => ReactNode;
