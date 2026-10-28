import { describe, it, expect, vi } from 'vitest';
import { Suspense } from 'react';
import { render, screen } from '@testing-library/react';
import { lazyWithPreload } from '../lazyWithPreload';
import { prerenderedRouteFor } from '../routeComponents';

const Page = ({ label }: { label: string }) => <p>{label}</p>;

describe('lazyWithPreload', () => {
  it('renders synchronously, without the fallback, once preloaded', async () => {
    const factory = vi.fn(() => Promise.resolve({ default: Page }));
    const Lazy = lazyWithPreload(factory);
    await Lazy.preload();

    render(
      <Suspense fallback={<p>loading</p>}>
        <Lazy label="ready" />
      </Suspense>
    );

    expect(screen.getByText('ready')).toBeInTheDocument();
    expect(screen.queryByText('loading')).not.toBeInTheDocument();
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it('falls back to Suspense when not preloaded', async () => {
    const Lazy = lazyWithPreload(() => Promise.resolve({ default: Page }));
    render(
      <Suspense fallback={<p>loading</p>}>
        <Lazy label="later" />
      </Suspense>
    );

    expect(screen.getByText('loading')).toBeInTheDocument();
    expect(await screen.findByText('later')).toBeInTheDocument();
  });

  it('shares one in-flight load and retries after a failure', async () => {
    const factory = vi
      .fn<() => Promise<{ default: typeof Page }>>()
      .mockRejectedValueOnce(new Error('chunk failed'))
      .mockResolvedValue({ default: Page });
    const Lazy = lazyWithPreload(factory);

    await expect(Lazy.preload()).rejects.toThrow('chunk failed');
    const [a, b] = await Promise.all([Lazy.preload(), Lazy.preload()]);
    expect(a).toBe(Page);
    expect(b).toBe(Page);
    expect(factory).toHaveBeenCalledTimes(2);
  });
});

describe('prerenderedRouteFor', () => {
  it('matches exactly the routes scripts/prerender.mjs fills', () => {
    expect(prerenderedRouteFor('/news/some-article')).toBe('Article');
    expect(prerenderedRouteFor('/ai-crm-automation')).toBe('AICrmAutomation');
    expect(prerenderedRouteFor('/topics/ai-crm-automation')).toBe('TopicHub');
    expect(prerenderedRouteFor('/')).toBeUndefined();
    expect(prerenderedRouteFor('/news')).toBeUndefined();
    expect(prerenderedRouteFor('/news/category/ai')).toBeUndefined();
    expect(prerenderedRouteFor('/topics/other')).toBeUndefined();
  });
});
