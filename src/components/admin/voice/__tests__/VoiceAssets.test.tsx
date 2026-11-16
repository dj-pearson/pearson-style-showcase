import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@/test/test-utils';
import type { SupabaseMock } from '@/test/mocks/supabase';
import { callsTo } from './helpers';

vi.mock('@/integrations/supabase/client', async () => {
  const { createSupabaseMock } = await import('@/test/mocks/supabase');
  return { supabase: createSupabaseMock() };
});

import { supabase } from '@/integrations/supabase/client';
import { VoiceAssets } from '../VoiceAssets';
import { MAX_IMAGE_BYTES, assetStoragePath, validateAssetUpload } from '../constants';

const mock = supabase as unknown as SupabaseMock;
const bucket = () => mock.storage.from.mock.results[0]?.value ?? mock.storage.from();

const png = (name = 'screen.png') => new File(['x'], name, { type: 'image/png' });

beforeEach(() => {
  mock.from.mockClear();
  mock.resetTableResults();
  mock.setTableResult('voice_assets', { data: [], error: null });
  bucket().upload.mockClear();
});

async function chooseKind(name: string) {
  const kinds = screen.getByRole('group', { name: 'Kind' });
  fireEvent.click(within(kinds).getByRole('button', { name }));
}

describe('VoiceAssets', () => {
  it('refuses a screenshot with no product and uploads nothing', async () => {
    render(<VoiceAssets />);
    await waitFor(() => expect(screen.getByText(/Nothing uploaded yet/)).toBeInTheDocument());

    await chooseKind('Screenshot');
    fireEvent.change(screen.getByLabelText('File'), { target: { files: [png()] } });
    fireEvent.click(screen.getByRole('button', { name: 'Upload' }));

    expect(
      await screen.findByText('Pick the product this screenshot belongs to.')
    ).toBeInTheDocument();
    expect(bucket().upload).not.toHaveBeenCalled();
    expect(callsTo(mock, 'voice_assets', 'insert')).toHaveLength(0);
  });

  it('uploads a screenshot once a product is picked, under screenshot/{product}/', async () => {
    render(<VoiceAssets />);
    await waitFor(() => expect(screen.getByText(/Nothing uploaded yet/)).toBeInTheDocument());

    await chooseKind('Screenshot');
    const products = screen.getByRole('group', { name: 'Product' });
    fireEvent.click(within(products).getByRole('button', { name: 'Brikly' }));
    fireEvent.change(screen.getByLabelText('File'), { target: { files: [png()] } });
    fireEvent.click(screen.getByRole('button', { name: 'Upload' }));

    await waitFor(() => expect(bucket().upload).toHaveBeenCalledTimes(1));
    const path = bucket().upload.mock.calls[0][0] as string;
    expect(path).toMatch(/^screenshot\/brikly\/[0-9a-f-]{36}\.png$/);
    await waitFor(() => expect(callsTo(mock, 'voice_assets', 'insert')).toHaveLength(1));
    expect(callsTo(mock, 'voice_assets', 'insert')[0][0]).toEqual({
      kind: 'screenshot',
      product: 'brikly',
      storage_path: path,
      caption: null,
    });
  });

  it('applies the file rules', () => {
    const file = (type: string, size: number, name: string) => ({ type, size, name });
    expect(validateAssetUpload('photo', null, file('image/png', 10, 'a.png'))).toBeNull();
    expect(validateAssetUpload('photo', null, file('image/gif', 10, 'a.gif'))).toMatch(/png, jpg/);
    expect(
      validateAssetUpload('photo', null, file('image/jpeg', MAX_IMAGE_BYTES + 1, 'a.jpg'))
    ).toMatch(/5 MB/);
    expect(
      validateAssetUpload('photo', null, file('image/jpeg', MAX_IMAGE_BYTES, 'a.jpg'))
    ).toBeNull();
    expect(validateAssetUpload('music', null, file('audio/mpeg', 10, 'a.mp3'))).toBeNull();
    expect(validateAssetUpload('music', null, file('audio/wav', 10, 'a.wav'))).toMatch(/mp3/);
    expect(
      validateAssetUpload('screenshot', 'eatpal', file('image/webp', 10, 'a.webp'))
    ).toBeNull();
  });

  it('builds storage paths with and without a product', () => {
    expect(assetStoragePath('headshot', null, 'Me.JPG', 'id-1')).toBe('headshot/id-1.jpg');
    expect(assetStoragePath('screenshot', 'eatpal', 'plan.png', 'id-2')).toBe(
      'screenshot/eatpal/id-2.png'
    );
  });

  it('groups the library by kind and product', async () => {
    mock.setTableResult('voice_assets', {
      data: [
        {
          id: 'a1',
          kind: 'headshot',
          product: null,
          storage_path: 'headshot/a1.jpg',
          caption: 'Studio headshot',
          created_at: '2026-11-10T00:00:00Z',
        },
        {
          id: 'a2',
          kind: 'screenshot',
          product: 'eatpal',
          storage_path: 'screenshot/eatpal/a2.png',
          caption: 'Meal plan screen',
          created_at: '2026-11-11T00:00:00Z',
        },
      ],
      error: null,
    });
    render(<VoiceAssets />);

    const headshots = await screen.findByRole('region', { name: 'Headshots' });
    expect(within(headshots).getByAltText('Studio headshot')).toBeInTheDocument();
    const screenshots = screen.getByRole('region', { name: 'Screenshots: EatPal' });
    expect(within(screenshots).getByAltText('Meal plan screen')).toBeInTheDocument();
  });
});
