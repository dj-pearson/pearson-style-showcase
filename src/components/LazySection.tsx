import { Suspense, useEffect, useRef, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';

interface LazySectionProps {
  /** Usually a React.lazy component. It is not rendered, so its chunk and its
   * queries do not start, until the section comes within `rootMargin` of the
   * viewport. */
  children: ReactNode;
  /**
   * min-height utilities for the placeholder, close to the rendered height at
   * each breakpoint so nothing below moves when the section mounts. An empty
   * string reserves nothing, for sections that may render nothing at all.
   */
  reserveClassName: string;
  /** Lands on the wrapper, so `#id` scrolls to the right place even before
   * the section has mounted, and a matching hash mounts it straight away. */
  id?: string;
  /** Other ids that should mount the section when the hash names them: ids
   * rendered inside the children, or on a static element wrapping this one. */
  anchorIds?: string[];
  className?: string;
  /** How far outside the viewport to start loading. */
  rootMargin?: string;
}

/**
 * Defers a below-the-fold section until it nears the viewport, then keeps it
 * mounted. Without IntersectionObserver the section renders immediately.
 */
const LazySection = ({
  children,
  reserveClassName,
  id,
  anchorIds,
  className,
  rootMargin = '400px 0px',
}: LazySectionProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const { hash } = useLocation();
  const target = hash ? decodeURIComponent(hash.slice(1)) : '';
  const targeted = target !== '' && (target === id || (anchorIds?.includes(target) ?? false));

  const [visible, setVisible] = useState(
    () => typeof IntersectionObserver === 'undefined' || targeted
  );

  // A later in-page link to this section mounts it too.
  useEffect(() => {
    if (targeted) setVisible(true);
  }, [targeted]);

  useEffect(() => {
    if (visible || !ref.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin }
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [visible, rootMargin]);

  const placeholder = <div aria-hidden="true" className={reserveClassName} />;

  return (
    <div ref={ref} id={id} className={className}>
      {visible ? <Suspense fallback={placeholder}>{children}</Suspense> : placeholder}
    </div>
  );
};

export default LazySection;
