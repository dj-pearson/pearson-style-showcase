import { describe, it, expect, afterEach } from 'vitest';
import type { ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import { useUnsavedChangesViewParam } from '@/hooks/useUnsavedChangesViewParam';
import { registerUnsavedGuard, __clearUnsavedGuards } from '@/lib/unsaved-changes';

const VIEWS = ['overview', 'articles', 'accounting', 'support'] as const;

function setup(initialEntry = '/admin/dashboard') {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[initialEntry]}>{children}</MemoryRouter>
  );
  return renderHook(
    () => ({
      view: useUnsavedChangesViewParam({ validViews: VIEWS, fallback: 'overview' }),
      location: useLocation(),
      navigate: useNavigate(),
    }),
    { wrapper }
  );
}

afterEach(() => __clearUnsavedGuards());

describe('useUnsavedChangesViewParam', () => {
  it('reads the view from the URL on load', () => {
    const { result } = setup('/admin/dashboard?view=support');
    expect(result.current.view.activeView).toBe('support');
  });

  it('falls back to overview for missing or unknown values', () => {
    expect(setup('/admin/dashboard').result.current.view.activeView).toBe('overview');
    expect(setup('/admin/dashboard?view=nope').result.current.view.activeView).toBe('overview');
  });

  it('writes ?view= on change and keeps other params', () => {
    const { result } = setup('/admin/dashboard?tab=invoices');
    act(() => result.current.view.requestView('accounting'));
    expect(result.current.view.activeView).toBe('accounting');
    const params = new URLSearchParams(result.current.location.search);
    expect(params.get('view')).toBe('accounting');
    expect(params.get('tab')).toBe('invoices');

    act(() => result.current.view.requestView('overview'));
    expect(new URLSearchParams(result.current.location.search).has('view')).toBe(false);
  });

  it('Back and Forward move between views', () => {
    const { result } = setup();
    act(() => result.current.view.requestView('articles'));
    act(() => result.current.view.requestView('support'));
    expect(result.current.view.activeView).toBe('support');

    act(() => result.current.navigate(-1));
    expect(result.current.view.activeView).toBe('articles');
    act(() => result.current.navigate(-1));
    expect(result.current.view.activeView).toBe('overview');
    act(() => result.current.navigate(1));
    expect(result.current.view.activeView).toBe('articles');
  });

  it('holds a user change while a form is dirty until discard is confirmed', () => {
    const { result } = setup();
    registerUnsavedGuard(() => true);

    act(() => result.current.view.requestView('articles'));
    expect(result.current.view.activeView).toBe('overview');
    expect(result.current.view.pendingView).toBe('articles');
    expect(result.current.location.search).toBe('');

    act(() => result.current.view.confirmViewChange());
    expect(result.current.view.activeView).toBe('articles');
    expect(result.current.view.pendingView).toBeNull();
    expect(result.current.location.search).toBe('?view=articles');
  });

  it('keep editing after Back restores the param and the view', () => {
    const { result } = setup();
    act(() => result.current.view.requestView('articles'));
    const unregister = registerUnsavedGuard(() => true);

    act(() => result.current.navigate(-1));
    expect(result.current.view.activeView).toBe('articles');
    expect(result.current.view.pendingView).toBe('overview');

    act(() => result.current.view.cancelViewChange());
    expect(result.current.view.pendingView).toBeNull();
    expect(result.current.view.activeView).toBe('articles');
    expect(result.current.location.search).toBe('?view=articles');
    unregister();
  });

  it('discard after Back commits the view the URL already shows', () => {
    const { result } = setup();
    act(() => result.current.view.requestView('articles'));
    registerUnsavedGuard(() => true);

    act(() => result.current.navigate(-1));
    act(() => result.current.view.confirmViewChange());
    expect(result.current.view.activeView).toBe('overview');
    expect(result.current.location.search).toBe('');
  });
});
