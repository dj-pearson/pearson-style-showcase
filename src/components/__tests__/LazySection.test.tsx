import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import LazySection from '../LazySection';

type Callback = (entries: Partial<IntersectionObserverEntry>[]) => void;

const observers: {
  callback: Callback;
  options?: IntersectionObserverInit;
  disconnected: boolean;
}[] = [];

class FakeIntersectionObserver {
  record: (typeof observers)[number];
  constructor(callback: Callback, options?: IntersectionObserverInit) {
    this.record = { callback, options, disconnected: false };
    observers.push(this.record);
  }
  observe() {}
  unobserve() {}
  takeRecords() {
    return [];
  }
  disconnect() {
    this.record.disconnected = true;
  }
}

const original = globalThis.IntersectionObserver;

beforeEach(() => {
  observers.length = 0;
  vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
});

afterEach(() => {
  vi.unstubAllGlobals();
  globalThis.IntersectionObserver = original;
});

const renderAt = (url: string, props: Partial<Parameters<typeof LazySection>[0]> = {}) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <LazySection reserveClassName="min-h-[900px]" {...props}>
        <p>section body</p>
      </LazySection>
    </MemoryRouter>
  );

describe('LazySection', () => {
  it('holds a sized placeholder until the section nears the viewport, then stays mounted', () => {
    const { container } = renderAt('/', { id: 'case-studies' });

    expect(screen.queryByText('section body')).not.toBeInTheDocument();
    const placeholder = container.querySelector('#case-studies > div');
    expect(placeholder).toHaveClass('min-h-[900px]');
    expect(placeholder).toHaveAttribute('aria-hidden', 'true');
    expect(observers[0].options?.rootMargin).toBe('400px 0px');

    act(() => observers[0].callback([{ isIntersecting: false }]));
    expect(screen.queryByText('section body')).not.toBeInTheDocument();

    act(() => observers[0].callback([{ isIntersecting: true }]));
    expect(screen.getByText('section body')).toBeInTheDocument();
    expect(observers[0].disconnected).toBe(true);
    // No observer is created again, so scrolling away cannot unmount it.
    expect(observers).toHaveLength(1);
  });

  it('renders straight away when IntersectionObserver is missing', () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    renderAt('/');
    expect(screen.getByText('section body')).toBeInTheDocument();
  });

  it('mounts immediately when the hash names the section', () => {
    const { container } = renderAt('/#testimonials', { id: 'testimonials' });
    expect(screen.getByText('section body')).toBeInTheDocument();
    expect(container.querySelector('#testimonials')).not.toBeNull();
    expect(observers).toHaveLength(0);
  });

  it('mounts immediately when the hash names one of its anchor ids', () => {
    renderAt('/#authority-heading', { id: 'authority', anchorIds: ['authority-heading'] });
    expect(screen.getByText('section body')).toBeInTheDocument();
  });

  it('ignores a hash aimed at some other section', () => {
    renderAt('/#newsletter', { id: 'authority', anchorIds: ['authority-heading'] });
    expect(screen.queryByText('section body')).not.toBeInTheDocument();
  });
});
