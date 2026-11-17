import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, Pencil, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ToggleChips } from '@/components/admin/voice/ToggleChips';
import {
  VOICE_PRODUCTS,
  VOICE_PRODUCT_LABELS,
  VOICE_TRACKS,
  VOICE_TRACK_LABELS,
  labelFor,
} from '@/components/admin/voice/constants';
import { logger } from '@/lib/logger';
import { validateTextInput } from '@/lib/security';

type Story = Tables<'voice_stories'>;

const STORY_MAX_LENGTH = 2000;
const STORIES_KEY = ['voice-stories'];

const formatDate = (iso: string | null): string =>
  iso ? new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'never';

/**
 * The Story Bank: one-line true stories the engine may quote. A post can only
 * state a personal fact that traces back to a confirmed row here.
 */
export const StoryBank = () => {
  const queryClient = useQueryClient();

  const [body, setBody] = useState('');
  const [tracks, setTracks] = useState<string[]>([]);
  const [products, setProducts] = useState<string[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  const [trackFilter, setTrackFilter] = useState<string[]>([]);
  const [editing, setEditing] = useState<Story | null>(null);
  const [editBody, setEditBody] = useState('');
  const [editTracks, setEditTracks] = useState<string[]>([]);
  const [editProducts, setEditProducts] = useState<string[]>([]);
  const [deleting, setDeleting] = useState<Story | null>(null);

  const {
    data: stories = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: STORIES_KEY,
    queryFn: async () => {
      const { data, error: queryError } = await supabase
        .from('voice_stories')
        .select('*')
        .order('created_at', { ascending: false });
      if (queryError) throw queryError;
      return (data ?? []) as Story[];
    },
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: STORIES_KEY });

  const onMutationError = (action: string) => (mutationError: Error) => {
    logger.error(`Voice story ${action} failed:`, mutationError);
    toast.error(`Could not ${action} the story: ${mutationError.message}`);
  };

  const addStory = useMutation({
    mutationFn: async (input: { body: string; tracks: string[]; products: string[] }) => {
      const { error: insertError } = await supabase
        .from('voice_stories')
        .insert({ ...input, source: 'manual' });
      if (insertError) throw insertError;
    },
    onSuccess: () => {
      setBody('');
      setTracks([]);
      setProducts([]);
      toast.success('Story saved');
      invalidate();
    },
    onError: onMutationError('save'),
  });

  const updateStory = useMutation({
    mutationFn: async (input: { id: string; patch: Partial<Story> }) => {
      const { error: updateError } = await supabase
        .from('voice_stories')
        .update(input.patch)
        .eq('id', input.id);
      if (updateError) throw updateError;
    },
    onSuccess: () => {
      setEditing(null);
      invalidate();
    },
    onError: onMutationError('update'),
  });

  const deleteStory = useMutation({
    mutationFn: async (id: string) => {
      const { error: deleteError } = await supabase.from('voice_stories').delete().eq('id', id);
      if (deleteError) throw deleteError;
    },
    onSuccess: () => {
      setDeleting(null);
      toast.success('Story deleted');
      invalidate();
    },
    onError: onMutationError('delete'),
  });

  const handleAdd = (event: React.FormEvent) => {
    event.preventDefault();
    const clean = validateTextInput(body, STORY_MAX_LENGTH);
    if (!clean) {
      setFormError(`Write the story first (up to ${STORY_MAX_LENGTH} characters).`);
      return;
    }
    setFormError(null);
    addStory.mutate({ body: clean, tracks, products });
  };

  const openEdit = (story: Story) => {
    setEditing(story);
    setEditBody(story.body);
    setEditTracks(story.tracks);
    setEditProducts(story.products);
  };

  const handleEditSave = () => {
    if (!editing) return;
    const clean = validateTextInput(editBody, STORY_MAX_LENGTH);
    if (!clean) {
      toast.error('A story needs some text.');
      return;
    }
    updateStory.mutate({
      id: editing.id,
      patch: { body: clean, tracks: editTracks, products: editProducts },
    });
  };

  const activeTrack = trackFilter[0];
  const visible = activeTrack ? stories.filter((s) => s.tracks.includes(activeTrack)) : stories;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Add a story</CardTitle>
          <CardDescription>
            One true thing that happened, in your own words. Tag it so the right track can use it.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="voice-story-body">Story</Label>
              <Textarea
                id="voice-story-body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Tried tacos tonight, ate the shell only."
                rows={3}
                maxLength={STORY_MAX_LENGTH}
                aria-invalid={formError ? true : undefined}
                aria-describedby={formError ? 'voice-story-error' : undefined}
              />
              {formError && (
                <p id="voice-story-error" role="alert" className="text-sm text-destructive">
                  {formError}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Tracks</p>
              <ToggleChips
                label="Tracks"
                options={VOICE_TRACKS}
                labels={VOICE_TRACK_LABELS}
                selected={tracks}
                onChange={setTracks}
              />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Products</p>
              <ToggleChips
                label="Products"
                options={VOICE_PRODUCTS}
                labels={VOICE_PRODUCT_LABELS}
                selected={products}
                onChange={setProducts}
              />
            </div>
            <Button type="submit" disabled={addStory.isPending} className="w-full sm:w-auto">
              {addStory.isPending && <Loader2 className="animate-spin" />}
              Save story
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Stories</CardTitle>
          <CardDescription>
            Newest first. An unconfirmed story stays here but the engine will not use it.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm font-medium">Filter by track</p>
            <ToggleChips
              label="Filter by track"
              options={VOICE_TRACKS}
              labels={VOICE_TRACK_LABELS}
              selected={trackFilter}
              onChange={setTrackFilter}
              single
            />
          </div>

          {isLoading && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading stories...
            </p>
          )}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              Could not load stories: {(error as Error).message}
            </p>
          )}
          {!isLoading && !error && visible.length === 0 && (
            <p className="text-sm text-muted-foreground">
              {activeTrack
                ? `No stories tagged ${labelFor(VOICE_TRACK_LABELS, activeTrack)} yet.`
                : 'No stories yet. Add the first one above.'}
            </p>
          )}

          <ul className="divide-y divide-border">
            {visible.map((story) => (
              <li key={story.id} className="space-y-2 py-3">
                <p className={story.confirmed ? 'text-sm' : 'text-sm text-muted-foreground'}>
                  {story.body}
                </p>
                <div className="flex flex-wrap items-center gap-1.5">
                  {!story.confirmed && <Badge variant="outline">Not confirmed</Badge>}
                  {story.tracks.map((t) => (
                    <Badge key={`t-${t}`} variant="secondary">
                      {labelFor(VOICE_TRACK_LABELS, t)}
                    </Badge>
                  ))}
                  {story.source === 'vault-import' && <Badge variant="outline">From vault</Badge>}
                </div>
                {story.products.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Products:{' '}
                    {story.products.map((p) => labelFor(VOICE_PRODUCT_LABELS, p)).join(', ')}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Used {story.times_used} {story.times_used === 1 ? 'time' : 'times'}, last used{' '}
                  {formatDate(story.last_used_at)}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openEdit(story)}
                    aria-label={`Edit story: ${story.body.slice(0, 40)}`}
                  >
                    <Pencil /> Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={updateStory.isPending}
                    onClick={() =>
                      updateStory.mutate({
                        id: story.id,
                        patch: { confirmed: !story.confirmed },
                      })
                    }
                  >
                    {story.confirmed ? 'Unconfirm' : 'Confirm'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDeleting(story)}
                    aria-label={`Delete story: ${story.body.slice(0, 40)}`}
                  >
                    <Trash2 /> Delete
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit story</DialogTitle>
            <DialogDescription>Change the wording or where it can be used.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="voice-story-edit-body">Story</Label>
              <Textarea
                id="voice-story-edit-body"
                value={editBody}
                onChange={(e) => setEditBody(e.target.value)}
                rows={4}
                maxLength={STORY_MAX_LENGTH}
              />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Tracks</p>
              <ToggleChips
                label="Edit tracks"
                options={VOICE_TRACKS}
                labels={VOICE_TRACK_LABELS}
                selected={editTracks}
                onChange={setEditTracks}
              />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Products</p>
              <ToggleChips
                label="Edit products"
                options={VOICE_PRODUCTS}
                labels={VOICE_PRODUCT_LABELS}
                selected={editProducts}
                onChange={setEditProducts}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button onClick={handleEditSave} disabled={updateStory.isPending}>
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this story?</AlertDialogTitle>
            <AlertDialogDescription>
              It is removed from the Story Bank for good. To keep it but stop the engine using it,
              unconfirm it instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleting && deleteStory.mutate(deleting.id)}>
              Delete story
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
