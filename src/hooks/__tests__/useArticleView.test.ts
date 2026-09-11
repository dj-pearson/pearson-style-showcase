import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc } }));

import { useArticleView } from '../useArticleView';

describe('useArticleView', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    rpc.mockReset();
    rpc.mockResolvedValue({ error: null });
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('counts the view once the reader has stayed five seconds', async () => {
    renderHook(() => useArticleView('crm-alpha'));
    expect(rpc).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(5000);
    expect(rpc).toHaveBeenCalledWith('increment_article_view', { article_slug: 'crm-alpha' });
  });

  it('does not count a reader who leaves before the delay', async () => {
    const { unmount } = renderHook(() => useArticleView('crm-alpha'));
    await vi.advanceTimersByTimeAsync(3000);
    unmount();
    await vi.advanceTimersByTimeAsync(5000);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('counts an article once per session, however often it is reopened', async () => {
    const first = renderHook(() => useArticleView('crm-alpha'));
    await vi.advanceTimersByTimeAsync(5000);
    first.unmount();

    renderHook(() => useArticleView('crm-alpha'));
    await vi.advanceTimersByTimeAsync(5000);
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it('counts a different article separately', async () => {
    renderHook(() => useArticleView('crm-alpha'));
    renderHook(() => useArticleView('crm-beta'));
    await vi.advanceTimersByTimeAsync(5000);
    expect(rpc).toHaveBeenCalledTimes(2);
  });

  it('does nothing without a slug, or when disabled', async () => {
    renderHook(() => useArticleView(null));
    renderHook(() => useArticleView('crm-alpha', false));
    await vi.advanceTimersByTimeAsync(5000);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('swallows a failing call rather than surfacing it to the reader', async () => {
    rpc.mockResolvedValue({ error: { message: 'function does not exist' } });
    renderHook(() => useArticleView('crm-alpha'));
    await expect(vi.advanceTimersByTimeAsync(5000)).resolves.not.toThrow();
  });
});
