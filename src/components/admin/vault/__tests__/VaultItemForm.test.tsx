import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@/test/test-utils';

// sonner's toast and the edge-function helper are the form's side channels.
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/lib/edge-functions', () => ({ invokeEdgeFunction: vi.fn() }));

import { toast } from 'sonner';
import { invokeEdgeFunction } from '@/lib/edge-functions';
import { VaultItemForm } from '../VaultItemForm';

function baseProps() {
  return {
    types: [{ id: 't1', name: 'Password', icon: 'lock', is_system: true }],
    projects: [],
    platforms: [],
    onSuccess: vi.fn(),
    onCancel: vi.fn(),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('VaultItemForm', () => {
  it('renders the form fields', () => {
    const { container } = render(<VaultItemForm {...baseProps()} />);
    expect(screen.getByLabelText('Name *')).toBeInTheDocument();
    expect(screen.getByLabelText('Value *')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
    expect(container.querySelector('form')).not.toBeNull();
  });

  it('validates that the name is required', () => {
    const { container } = render(<VaultItemForm {...baseProps()} />);
    // Submit the form directly to bypass native required-field gating and reach
    // the component's own validation.
    fireEvent.submit(container.querySelector('form')!);
    expect(toast.error).toHaveBeenCalledWith('Name is required');
    expect(invokeEdgeFunction).not.toHaveBeenCalled();
  });

  it('validates that the value is required', () => {
    const { container } = render(<VaultItemForm {...baseProps()} />);
    fireEvent.change(screen.getByLabelText('Name *'), { target: { value: 'GitHub Token' } });
    fireEvent.submit(container.querySelector('form')!);
    expect(toast.error).toHaveBeenCalledWith('Value is required');
    expect(invokeEdgeFunction).not.toHaveBeenCalled();
  });

  it('submits valid data through the secure-vault function and calls onSuccess', async () => {
    vi.mocked(invokeEdgeFunction).mockResolvedValue({ data: { success: true }, error: null });
    const props = baseProps();
    const { container } = render(<VaultItemForm {...props} />);

    fireEvent.change(screen.getByLabelText('Name *'), { target: { value: 'GitHub Token' } });
    fireEvent.change(screen.getByLabelText('Value *'), { target: { value: 'ghp_secret' } });
    fireEvent.submit(container.querySelector('form')!);

    await waitFor(() => expect(invokeEdgeFunction).toHaveBeenCalledWith(
      'secure-vault',
      expect.objectContaining({
        body: expect.objectContaining({ action: 'encrypt', name: 'GitHub Token', value: 'ghp_secret' }),
      })
    ));
    await waitFor(() => expect(props.onSuccess).toHaveBeenCalled());
  });

  it('surfaces a save failure (e.g. MFA required) via a toast', async () => {
    vi.mocked(invokeEdgeFunction).mockResolvedValue({
      data: { success: false, error: 'MFA verification required' },
      error: null,
    });
    const props = baseProps();
    const { container } = render(<VaultItemForm {...props} />);

    fireEvent.change(screen.getByLabelText('Name *'), { target: { value: 'Token' } });
    fireEvent.change(screen.getByLabelText('Value *'), { target: { value: 'v' } });
    fireEvent.submit(container.querySelector('form')!);

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('Failed to save'))
    );
    expect(props.onSuccess).not.toHaveBeenCalled();
  });
});
