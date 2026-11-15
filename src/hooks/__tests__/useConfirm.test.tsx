import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, renderHook, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfirmProvider } from '@/components/ui/confirm-dialog';
import { useConfirm } from '@/hooks/useConfirm';

function Harness() {
  const confirm = useConfirm();
  const [result, setResult] = useState('pending');
  return (
    <>
      <button
        type="button"
        onClick={async () => {
          const ok = await confirm({
            title: 'Delete invoice INV-0042?',
            description: 'The invoice and its line items are removed for good.',
            confirmLabel: 'Delete invoice',
            destructive: true,
          });
          setResult(String(ok));
        }}
      >
        Ask
      </button>
      <output>{result}</output>
    </>
  );
}

function setup() {
  const user = userEvent.setup();
  render(
    <ConfirmProvider>
      <Harness />
    </ConfirmProvider>
  );
  return user;
}

describe('useConfirm', () => {
  it('shows the title, description and action label, with focus on Cancel', async () => {
    const user = setup();
    await user.click(screen.getByRole('button', { name: 'Ask' }));

    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent('Delete invoice INV-0042?');
    expect(dialog).toHaveTextContent('The invoice and its line items are removed for good.');
    expect(screen.getByRole('button', { name: 'Delete invoice' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus());
  });

  it('resolves true when the action is confirmed', async () => {
    const user = setup();
    await user.click(screen.getByRole('button', { name: 'Ask' }));
    await user.click(await screen.findByRole('button', { name: 'Delete invoice' }));

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('true'));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('resolves false when Cancel is clicked', async () => {
    const user = setup();
    await user.click(screen.getByRole('button', { name: 'Ask' }));
    await user.click(await screen.findByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('false'));
  });

  it('resolves false when Escape is pressed', async () => {
    const user = setup();
    await user.click(screen.getByRole('button', { name: 'Ask' }));
    await screen.findByRole('alertdialog');
    await user.keyboard('{Escape}');

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('false'));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('throws a clear error outside the provider', () => {
    // React logs the thrown render error; keep the test output readable.
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => renderHook(() => useConfirm())).toThrow(/ConfirmProvider/);
    consoleError.mockRestore();
  });
});
