import { createElement, lazy, useRef, type ComponentType } from 'react';

type Factory<P> = () => Promise<{ default: ComponentType<P> }>;

export type PreloadableComponent<P> = ComponentType<P> & {
  /** Starts (or reuses) the chunk download; resolves with the loaded component. */
  preload: () => Promise<ComponentType<P>>;
};

/**
 * React.lazy with a preload() hook. React.lazy always suspends on its first
 * render, even when the chunk is already in memory, because it only reads the
 * factory's promise asynchronously. That turns a prerendered page into a
 * skeleton for one frame. This wrapper caches the resolved module: once
 * preload() (or a previous render) has resolved it, the component renders
 * synchronously with no Suspense boundary involved.
 */
export function lazyWithPreload<P extends object>(factory: Factory<P>): PreloadableComponent<P> {
  let loaded: ComponentType<P> | undefined;
  let pending: Promise<ComponentType<P>> | undefined;

  const preload = (): Promise<ComponentType<P>> => {
    if (!pending) {
      pending = factory().then(
        (mod) => {
          loaded = mod.default;
          return mod.default;
        },
        (error: unknown) => {
          // Let a later call retry after a failed chunk fetch.
          pending = undefined;
          throw error;
        }
      );
    }
    return pending;
  };

  const LazyComponent = lazy(() => preload().then((component) => ({ default: component })));

  const Preloadable = (props: P) => {
    // Pin the choice per mount: swapping element types between renders would
    // remount the page and drop its state.
    const target = useRef<ComponentType<P>>(
      loaded ?? (LazyComponent as unknown as ComponentType<P>)
    );
    return createElement(target.current, props);
  };

  return Object.assign(Preloadable, { preload });
}
