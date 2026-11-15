import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@/test/test-utils';
import userEvent from '@testing-library/user-event';

vi.mock('@/integrations/supabase/client', async () => {
  const { createSupabaseMock } = await import('@/test/mocks/supabase');
  return { supabase: createSupabaseMock() };
});

import { TaskFormDialog } from '../TaskFormDialog';

const renderDialog = () =>
  render(
    <TaskFormDialog
      open
      onOpenChange={() => {}}
      editingTask={null}
      projects={[{ id: 'p1', name: 'Platform' }]}
      onSuccess={() => {}}
    />
  );

describe('TaskFormDialog accessible names', () => {
  // getByLabelText resolves label -> control through htmlFor/id, so these fail if
  // the association is missing. A <label> that merely sits next to its input
  // looks identical on screen and is invisible to a screen reader.
  it.each([['Title *'], ['Description'], ['Category'], ['Source/Platform']])(
    'associates the %s field with its control',
    (labelText) => {
      renderDialog();
      expect(screen.getByLabelText(labelText)).toBeInTheDocument();
    }
  );

  // Radix renders the dialog through a portal, so it lands in document.body
  // rather than under the render container. Querying the container instead
  // finds no labels at all and passes for the wrong reason.
  const labelsInDocument = () => Array.from(document.body.querySelectorAll('label'));

  it('gives every rendered field an accessible name', () => {
    renderDialog();
    const labels = labelsInDocument();
    expect(labels.length).toBeGreaterThan(0);
    const orphans = labels.filter((l) => !l.getAttribute('for')).map((l) => l.textContent?.trim());
    expect(orphans).toEqual([]);
  });

  it('scopes ids per instance so two dialogs cannot collide', () => {
    renderDialog();
    const first = new Set(labelsInDocument().map((l) => l.getAttribute('for')));
    expect(first.size).toBeGreaterThan(0);

    renderDialog();
    const added = labelsInDocument()
      .map((l) => l.getAttribute('for'))
      .filter((id) => !first.has(id));

    // useId gives the second instance its own prefix, so none of its ids repeat
    // one from the first. Static ids would make `added` empty.
    expect(added.length).toEqual(first.size);
  });
});

describe('TaskFormDialog close guard', () => {
  const renderWith = (onOpenChange: (open: boolean) => void) =>
    render(
      <TaskFormDialog
        open
        onOpenChange={onOpenChange}
        editingTask={null}
        projects={[]}
        onSuccess={() => {}}
      />
    );

  it('closes straight away when nothing was typed', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    renderWith(onOpenChange);
    await user.keyboard('{Escape}');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('asks before Esc throws away typed input', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    renderWith(onOpenChange);
    await user.type(screen.getByLabelText('Title *'), 'Renew TLS cert');
    await user.keyboard('{Escape}');

    expect(onOpenChange).not.toHaveBeenCalled();
    expect(await screen.findByText('Discard unsaved changes?')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /keep editing/i }));
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Title *')).toHaveValue('Renew TLS cert');

    await user.click(screen.getByRole('button', { name: /^cancel$/i }));
    await user.click(await screen.findByRole('button', { name: /discard/i }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
