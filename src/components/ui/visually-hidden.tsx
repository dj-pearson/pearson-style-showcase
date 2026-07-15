import React from 'react';

interface VisuallyHiddenProps {
  /** Content to be hidden visually but available to screen readers */
  children: React.ReactNode;
  /** HTML element to render (defaults to span) */
  as?: React.ElementType;
}

/**
 * VisuallyHidden component - hides content visually while keeping it
 * accessible to screen readers. Use for:
 * - Icon-only buttons that need labels
 * - Contextual information for screen readers
 * - Skip link text
 * - Table header context
 *
 * This is equivalent to Tailwind's `sr-only` class but as a component
 * for more semantic usage in JSX.
 */
const VisuallyHidden: React.FC<VisuallyHiddenProps> = ({
  children,
  as: Component = 'span'
}) => {
  return (
    <Component className="sr-only">
      {children}
    </Component>
  );
};

export default VisuallyHidden;
