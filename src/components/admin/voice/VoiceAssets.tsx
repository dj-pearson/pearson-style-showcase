import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, Trash2, Upload } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ToggleChips } from '@/components/admin/voice/ToggleChips';
import {
  VOICE_ASSET_KINDS,
  VOICE_ASSET_KIND_LABELS,
  VOICE_MEDIA_BUCKET,
  VOICE_PRODUCTS,
  VOICE_PRODUCT_LABELS,
  assetStoragePath,
  labelFor,
  validateAssetUpload,
  type VoiceAssetKind,
} from '@/components/admin/voice/constants';
import { logger } from '@/lib/logger';
import { validateTextInput } from '@/lib/security';

type Asset = Tables<'voice_assets'>;

const ASSETS_KEY = ['voice-assets'];
const CAPTION_MAX_LENGTH = 200;

const KIND_SINGULAR: Record<VoiceAssetKind, string> = {
  headshot: 'Headshot',
  photo: 'Photo',
  screenshot: 'Screenshot',
  music: 'Music',
};

const publicUrl = (path: string): string =>
  supabase.storage.from(VOICE_MEDIA_BUCKET).getPublicUrl(path).data.publicUrl;

interface CaptionFieldProps {
  asset: Asset;
  onSave: (id: string, caption: string | null) => void;
}

const CaptionField = ({ asset, onSave }: CaptionFieldProps) => {
  const [value, setValue] = useState(asset.caption ?? '');
  const inputId = `voice-asset-caption-${asset.id}`;

  const commit = () => {
    const next = value.trim() ? validateTextInput(value, CAPTION_MAX_LENGTH) : null;
    if ((next ?? '') !== (asset.caption ?? '')) onSave(asset.id, next);
  };

  return (
    <div className="space-y-1">
      <Label htmlFor={inputId} className="text-xs text-muted-foreground">
        Caption
      </Label>
      <Input
        id={inputId}
        value={value}
        maxLength={CAPTION_MAX_LENGTH}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
        }}
        placeholder="What this shows"
      />
    </div>
  );
};

/**
 * Media the engine may put on a slide or under a video: Dan's headshot, his
 * photos, real app screenshots per product, and music beds.
 */
export const VoiceAssets = () => {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [kind, setKind] = useState<VoiceAssetKind>('headshot');
  const [product, setProduct] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Asset | null>(null);

  const {
    data: assets = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ASSETS_KEY,
    queryFn: async () => {
      const { data, error: queryError } = await supabase
        .from('voice_assets')
        .select('*')
        .order('created_at', { ascending: false });
      if (queryError) throw queryError;
      return (data ?? []) as Asset[];
    },
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ASSETS_KEY });

  const upload = useMutation({
    mutationFn: async (input: {
      kind: VoiceAssetKind;
      product: string | null;
      caption: string | null;
      file: File;
    }) => {
      const path = assetStoragePath(
        input.kind,
        input.product,
        input.file.name,
        crypto.randomUUID()
      );
      const bucket = supabase.storage.from(VOICE_MEDIA_BUCKET);
      const { error: uploadError } = await bucket.upload(path, input.file, {
        contentType: input.file.type || undefined,
        upsert: false,
      });
      if (uploadError) throw uploadError;

      const { error: insertError } = await supabase.from('voice_assets').insert({
        kind: input.kind,
        product: input.product,
        storage_path: path,
        caption: input.caption,
      });
      if (insertError) {
        // Do not leave an object behind that no row points at.
        await bucket.remove([path]);
        throw insertError;
      }
    },
    onSuccess: () => {
      setFile(null);
      setCaption('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      toast.success('Uploaded');
      invalidate();
    },
    onError: (uploadError: Error) => {
      logger.error('Voice asset upload failed:', uploadError);
      toast.error(`Upload failed: ${uploadError.message}`);
    },
  });

  const saveCaption = useMutation({
    mutationFn: async (input: { id: string; caption: string | null }) => {
      const { error: updateError } = await supabase
        .from('voice_assets')
        .update({ caption: input.caption })
        .eq('id', input.id);
      if (updateError) throw updateError;
    },
    onSuccess: () => {
      toast.success('Caption saved');
      invalidate();
    },
    onError: (captionError: Error) => {
      logger.error('Voice asset caption save failed:', captionError);
      toast.error(`Could not save the caption: ${captionError.message}`);
    },
  });

  const remove = useMutation({
    mutationFn: async (asset: Asset) => {
      const { error: storageError } = await supabase.storage
        .from(VOICE_MEDIA_BUCKET)
        .remove([asset.storage_path]);
      if (storageError) throw storageError;
      const { error: deleteError } = await supabase
        .from('voice_assets')
        .delete()
        .eq('id', asset.id);
      if (deleteError) throw deleteError;
    },
    onSuccess: () => {
      setDeleting(null);
      toast.success('Deleted');
      invalidate();
    },
    onError: (removeError: Error) => {
      logger.error('Voice asset delete failed:', removeError);
      toast.error(`Could not delete it: ${removeError.message}`);
    },
  });

  const handleKindChange = (next: string[]) => {
    const picked = (next[0] ?? kind) as VoiceAssetKind;
    setKind(picked);
    setFormError(null);
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const problem = validateAssetUpload(kind, product, file);
    if (problem || !file) {
      setFormError(problem ?? 'Choose a file to upload.');
      return;
    }
    setFormError(null);
    upload.mutate({
      kind,
      product,
      caption: caption.trim() ? validateTextInput(caption, CAPTION_MAX_LENGTH) : null,
      file,
    });
  };

  // Group by kind, then by product, in a fixed order.
  const groups = VOICE_ASSET_KINDS.flatMap((k) => {
    const ofKind = assets.filter((a) => a.kind === k);
    const productKeys = Array.from(new Set(ofKind.map((a) => a.product ?? '')));
    return productKeys.map((p) => ({
      key: `${k}:${p}`,
      title: p
        ? `${VOICE_ASSET_KIND_LABELS[k]}: ${labelFor(VOICE_PRODUCT_LABELS, p)}`
        : VOICE_ASSET_KIND_LABELS[k],
      items: ofKind.filter((a) => (a.product ?? '') === p),
    }));
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Upload</CardTitle>
          <CardDescription>
            Images: png, jpg or webp up to 5 MB. Music: mp3. A screenshot needs its product.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div className="space-y-2">
              <p className="text-sm font-medium">Kind</p>
              <ToggleChips
                label="Kind"
                options={VOICE_ASSET_KINDS}
                labels={KIND_SINGULAR}
                selected={[kind]}
                onChange={handleKindChange}
                single
              />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">
                Product{kind === 'screenshot' ? ' (required)' : ' (optional)'}
              </p>
              <ToggleChips
                label="Product"
                options={VOICE_PRODUCTS}
                labels={VOICE_PRODUCT_LABELS}
                selected={product ? [product] : []}
                onChange={(next) => setProduct(next[0] ?? null)}
                single
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="voice-asset-file">File</Label>
              <Input
                id="voice-asset-file"
                ref={fileInputRef}
                type="file"
                accept={kind === 'music' ? '.mp3,audio/mpeg' : 'image/png,image/jpeg,image/webp'}
                onChange={(e) => {
                  setFile(e.target.files?.[0] ?? null);
                  setFormError(null);
                }}
                aria-invalid={formError ? true : undefined}
                aria-describedby={formError ? 'voice-asset-error' : undefined}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="voice-asset-caption">Caption (optional)</Label>
              <Input
                id="voice-asset-caption"
                value={caption}
                maxLength={CAPTION_MAX_LENGTH}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="What this shows"
              />
            </div>
            {formError && (
              <p id="voice-asset-error" role="alert" className="text-sm text-destructive">
                {formError}
              </p>
            )}
            <Button type="submit" disabled={upload.isPending} className="w-full sm:w-auto">
              {upload.isPending ? <Loader2 className="animate-spin" /> : <Upload />}
              Upload
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Library</CardTitle>
          <CardDescription>Everything the engine can pick from, grouped by kind.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {isLoading && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading assets...
            </p>
          )}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              Could not load assets: {(error as Error).message}
            </p>
          )}
          {!isLoading && !error && assets.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Nothing uploaded yet. Start with a headshot: it goes on the first and last slide.
            </p>
          )}

          {groups.map((group) => (
            <section key={group.key} aria-label={group.title} className="space-y-3">
              <h3 className="text-sm font-semibold">
                {group.title}{' '}
                <span className="font-normal text-muted-foreground">({group.items.length})</span>
              </h3>
              <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {group.items.map((asset) => (
                  <li key={asset.id} className="space-y-2 rounded-md border border-border p-3">
                    {asset.kind === 'music' ? (
                      // Music beds have no dialogue to caption.
                      // eslint-disable-next-line jsx-a11y/media-has-caption
                      <audio
                        controls
                        preload="none"
                        src={publicUrl(asset.storage_path)}
                        className="w-full"
                      />
                    ) : (
                      <img
                        src={publicUrl(asset.storage_path)}
                        alt={asset.caption || `${KIND_SINGULAR[asset.kind as VoiceAssetKind]}`}
                        loading="lazy"
                        className="aspect-video w-full rounded bg-muted object-contain"
                      />
                    )}
                    <CaptionField
                      asset={asset}
                      onSave={(id, next) => saveCaption.mutate({ id, caption: next })}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDeleting(asset)}
                      aria-label={`Delete ${asset.caption || asset.storage_path}`}
                    >
                      <Trash2 /> Delete
                    </Button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </CardContent>
      </Card>

      <AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this file?</AlertDialogTitle>
            <AlertDialogDescription>
              The file is removed from storage and the engine can no longer use it. Posts that
              already went out are not affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleting && remove.mutate(deleting)}>
              Delete file
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
