/**
 * Media Library Component
 *
 * A comprehensive media browser for managing and reusing assets.
 * Supports grid/list views, search, filtering, upload, and metadata editing.
 */

import React, { useState, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useDropzone } from 'react-dropzone';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import {
  Search,
  Upload,
  Grid3X3,
  List,
  Image,
  Video,
  FileText,
  Music,
  File,
  Folder,
  FolderPlus,
  MoreVertical,
  Pencil,
  Trash2,
  Download,
  Copy,
  Check,
  X,
  Loader2,
  RefreshCw,
  Filter,
  SortAsc,
  SortDesc,
  Eye,
  Link,
} from 'lucide-react';
import {
  uploadMedia,
  searchMedia,
  updateMedia,
  deleteMedia,
  getFolders,
  createFolder,
  getMediaType,
  formatBytes,
  type MediaAsset,
  type MediaFolder,
  type MediaSearchOptions,
  type UploadMediaOptions,
} from '@/services/media/library';
import { cn } from '@/lib/utils';

// Types
interface MediaLibraryProps {
  /** Mode: browse or select */
  mode?: 'browse' | 'select';
  /** Allow multiple selection */
  multiple?: boolean;
  /** Filter by mime type (e.g., 'image', 'video') */
  acceptedTypes?: string[];
  /** Callback when media is selected */
  onSelect?: (assets: MediaAsset[]) => void;
  /** Callback when dialog is closed */
  onClose?: () => void;
  /** Initial selected assets */
  initialSelection?: string[];
  /** Additional class names */
  className?: string;
}

type ViewMode = 'grid' | 'list';
type SortField = 'created_at' | 'file_name' | 'file_size' | 'usage_count';

// Icon mapping
const MediaIcon = ({ mimeType, className }: { mimeType: string; className?: string }) => {
  const type = getMediaType(mimeType);
  switch (type) {
    case 'image': return <Image className={className} />;
    case 'video': return <Video className={className} />;
    case 'audio': return <Music className={className} />;
    case 'document': return <FileText className={className} />;
    default: return <File className={className} />;
  }
};

export const MediaLibrary: React.FC<MediaLibraryProps> = ({
  mode = 'browse',
  multiple = false,
  acceptedTypes,
  onSelect,
  onClose,
  initialSelection = [],
  className,
}) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // State
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFolder, setSelectedFolder] = useState<string>('');
  const [selectedMimeType, setSelectedMimeType] = useState<string>('');
  const [sortBy, setSortBy] = useState<SortField>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedAssets, setSelectedAssets] = useState<Set<string>>(new Set(initialSelection));
  const [editingAsset, setEditingAsset] = useState<MediaAsset | null>(null);
  const [deletingAsset, setDeletingAsset] = useState<MediaAsset | null>(null);
  const [previewAsset, setPreviewAsset] = useState<MediaAsset | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [newFolderDialogOpen, setNewFolderDialogOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  // Build search options
  const searchOptions: MediaSearchOptions = {
    query: searchQuery || undefined,
    folder: selectedFolder || undefined,
    mimeType: selectedMimeType || acceptedTypes?.[0] || undefined,
    sortBy,
    sortOrder,
    limit: 50,
  };

  // Fetch media assets
  const { data: mediaData, isLoading: isLoadingMedia, refetch: refetchMedia } = useQuery({
    queryKey: ['media-assets', searchOptions],
    queryFn: () => searchMedia(searchOptions),
  });

  // Fetch folders
  const { data: folders = [] } = useQuery({
    queryKey: ['media-folders'],
    queryFn: getFolders,
  });

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async ({ file, options }: { file: File; options: UploadMediaOptions }) => {
      return uploadMedia(file, options);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['media-assets'] });
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<MediaAsset> }) => {
      return updateMedia(id, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['media-assets'] });
      setEditingAsset(null);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return deleteMedia(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['media-assets'] });
      setDeletingAsset(null);
      setSelectedAssets((prev) => {
        const next = new Set(prev);
        next.delete(deletingAsset?.id || '');
        return next;
      });
    },
  });

  // Create folder mutation
  const createFolderMutation = useMutation({
    mutationFn: async (name: string) => {
      return createFolder(name);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['media-folders'] });
      setNewFolderDialogOpen(false);
      setNewFolderName('');
    },
  });

  // Handle file drop
  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      setIsUploading(true);
      setUploadProgress(0);

      const total = acceptedFiles.length;
      let completed = 0;

      for (const file of acceptedFiles) {
        try {
          const result = await uploadMutation.mutateAsync({
            file,
            options: {
              folder: selectedFolder || 'uploads',
              optimize: true,
              generateThumbnail: true,
            },
          });

          if (result && mode === 'select' && !multiple) {
            setSelectedAssets(new Set([result.id]));
          }
        } catch (error) {
          toast({
            variant: 'destructive',
            title: 'Upload failed',
            description: `Failed to upload ${file.name}`,
          });
        }

        completed++;
        setUploadProgress(Math.round((completed / total) * 100));
      }

      setIsUploading(false);
      toast({
        title: 'Upload complete',
        description: `${completed} file(s) uploaded successfully`,
      });
    },
    [uploadMutation, selectedFolder, mode, multiple, toast]
  );

  const { getRootProps, getInputProps, isDragActive, open: openFileDialog } = useDropzone({
    onDrop,
    accept: acceptedTypes
      ? acceptedTypes.reduce((acc, type) => ({ ...acc, [`${type}/*`]: [] }), {})
      : undefined,
    noClick: true,
    noKeyboard: true,
  });

  // Toggle asset selection
  const toggleSelection = (asset: MediaAsset) => {
    setSelectedAssets((prev) => {
      const next = new Set(prev);
      if (next.has(asset.id)) {
        next.delete(asset.id);
      } else {
        if (!multiple) {
          next.clear();
        }
        next.add(asset.id);
      }
      return next;
    });
  };

  // Handle confirm selection
  const handleConfirmSelection = () => {
    const selected = mediaData?.assets.filter((a) => selectedAssets.has(a.id)) || [];
    onSelect?.(selected);
    onClose?.();
  };

  // Copy URL to clipboard
  const copyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    toast({ title: 'URL copied to clipboard' });
  };

  // Download file
  const downloadFile = (asset: MediaAsset) => {
    if (asset.public_url) {
      window.open(asset.public_url, '_blank');
    }
  };

  // Render asset card
  const renderAssetCard = (asset: MediaAsset) => {
    const isSelected = selectedAssets.has(asset.id);
    const isImage = asset.mime_type.startsWith('image/');

    return (
      <div
        key={asset.id}
        className={cn(
          'group relative rounded-lg border bg-card transition-all cursor-pointer',
          isSelected && 'ring-2 ring-primary border-primary',
          viewMode === 'grid' ? 'aspect-square' : 'flex items-center gap-4 p-3'
        )}
        onClick={() => toggleSelection(asset)}
      >
        {/* Checkbox */}
        <div
          className={cn(
            'absolute z-10',
            viewMode === 'grid' ? 'top-2 left-2' : 'left-3'
          )}
        >
          <Checkbox checked={isSelected} className="bg-background" />
        </div>

        {/* Preview */}
        {viewMode === 'grid' ? (
          <div className="relative w-full h-full overflow-hidden rounded-lg">
            {isImage && asset.thumbnail_url ? (
              <img
                src={asset.thumbnail_url}
                alt={asset.alt_text || asset.original_name}
                className="w-full h-full object-cover"
              />
            ) : isImage && asset.public_url ? (
              <img
                src={asset.public_url}
                alt={asset.alt_text || asset.original_name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-muted">
                <MediaIcon mimeType={asset.mime_type} className="h-12 w-12 text-muted-foreground" />
              </div>
            )}

            {/* Overlay */}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
              <Button
                variant="secondary"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  setPreviewAsset(asset);
                }}
              >
                <Eye className="h-4 w-4 mr-1" />
                Preview
              </Button>
            </div>

            {/* Info bar */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
              <p className="text-white text-xs truncate">{asset.original_name}</p>
              <p className="text-white/70 text-xs">{formatBytes(asset.file_size)}</p>
            </div>
          </div>
        ) : (
          <>
            {/* List view thumbnail */}
            <div className="w-16 h-16 shrink-0 rounded overflow-hidden bg-muted ml-8">
              {isImage && (asset.thumbnail_url || asset.public_url) ? (
                <img
                  src={asset.thumbnail_url || asset.public_url || ''}
                  alt={asset.alt_text || asset.original_name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <MediaIcon mimeType={asset.mime_type} className="h-6 w-6 text-muted-foreground" />
                </div>
              )}
            </div>

            {/* List view info */}
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{asset.original_name}</p>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>{formatBytes(asset.file_size)}</span>
                {asset.width && asset.height && (
                  <span>{asset.width}×{asset.height}</span>
                )}
                <Badge variant="outline" className="text-xs">
                  {getMediaType(asset.mime_type)}
                </Badge>
              </div>
              {asset.alt_text && (
                <p className="text-xs text-muted-foreground truncate mt-1">{asset.alt_text}</p>
              )}
            </div>

            {/* Actions */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button variant="ghost" size="sm">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setPreviewAsset(asset)}>
                  <Eye className="h-4 w-4 mr-2" />
                  Preview
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => copyUrl(asset.public_url || '')}>
                  <Link className="h-4 w-4 mr-2" />
                  Copy URL
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => downloadFile(asset)}>
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setEditingAsset(asset)}>
                  <Pencil className="h-4 w-4 mr-2" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={() => setDeletingAsset(asset)}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}
      </div>
    );
  };

  return (
    <div className={cn('flex flex-col h-full', className)} {...getRootProps()}>
      <input {...getInputProps()} />

      {/* Header */}
      <div className="border-b p-4 space-y-4">
        {/* Title and actions */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Media Library</h2>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => refetchMedia()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setNewFolderDialogOpen(true)}>
              <FolderPlus className="h-4 w-4 mr-2" />
              New Folder
            </Button>
            <Button size="sm" onClick={openFileDialog}>
              <Upload className="h-4 w-4 mr-2" />
              Upload
            </Button>
          </div>
        </div>

        {/* Search and filters */}
        <div className="flex items-center gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search media..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          <Select value={selectedFolder} onValueChange={setSelectedFolder}>
            <SelectTrigger className="w-40">
              <Folder className="h-4 w-4 mr-2" />
              <SelectValue placeholder="All folders" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All folders</SelectItem>
              {folders.map((folder) => (
                <SelectItem key={folder.id} value={folder.slug}>
                  {folder.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedMimeType} onValueChange={setSelectedMimeType}>
            <SelectTrigger className="w-36">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All types</SelectItem>
              <SelectItem value="image">Images</SelectItem>
              <SelectItem value="video">Videos</SelectItem>
              <SelectItem value="audio">Audio</SelectItem>
              <SelectItem value="application/pdf">PDFs</SelectItem>
            </SelectContent>
          </Select>

          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
            <TabsList className="h-9">
              <TabsTrigger value="grid" className="px-2">
                <Grid3X3 className="h-4 w-4" />
              </TabsTrigger>
              <TabsTrigger value="list" className="px-2">
                <List className="h-4 w-4" />
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Upload progress */}
      {isUploading && (
        <div className="p-4 bg-muted/50 border-b">
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <div className="flex-1">
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
            <span className="text-sm text-muted-foreground">{uploadProgress}%</span>
          </div>
        </div>
      )}

      {/* Drop zone indicator */}
      {isDragActive && (
        <div className="absolute inset-0 z-50 bg-primary/10 border-2 border-dashed border-primary rounded-lg flex items-center justify-center">
          <div className="text-center">
            <Upload className="h-12 w-12 mx-auto mb-2 text-primary" />
            <p className="text-lg font-medium text-primary">Drop files to upload</p>
          </div>
        </div>
      )}

      {/* Content */}
      <ScrollArea className="flex-1 p-4">
        {isLoadingMedia ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : mediaData?.assets.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center">
            <Image className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium">No media found</p>
            <p className="text-sm text-muted-foreground">Upload files or adjust your filters</p>
            <Button className="mt-4" onClick={openFileDialog}>
              <Upload className="h-4 w-4 mr-2" />
              Upload Files
            </Button>
          </div>
        ) : (
          <div
            className={cn(
              viewMode === 'grid'
                ? 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4'
                : 'space-y-2'
            )}
          >
            {mediaData?.assets.map(renderAssetCard)}
          </div>
        )}
      </ScrollArea>

      {/* Footer (selection mode) */}
      {mode === 'select' && (
        <div className="border-t p-4 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {selectedAssets.size} item{selectedAssets.size !== 1 ? 's' : ''} selected
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleConfirmSelection} disabled={selectedAssets.size === 0}>
              <Check className="h-4 w-4 mr-2" />
              Select {selectedAssets.size > 0 && `(${selectedAssets.size})`}
            </Button>
          </div>
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editingAsset} onOpenChange={() => setEditingAsset(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Media</DialogTitle>
            <DialogDescription>Update media metadata and accessibility information.</DialogDescription>
          </DialogHeader>

          {editingAsset && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Title</Label>
                <Input
                  value={editingAsset.title || ''}
                  onChange={(e) =>
                    setEditingAsset({ ...editingAsset, title: e.target.value })
                  }
                  placeholder="Enter a title"
                />
              </div>

              <div className="space-y-2">
                <Label>
                  Alt Text <span className="text-destructive">*</span>
                </Label>
                <Input
                  value={editingAsset.alt_text || ''}
                  onChange={(e) =>
                    setEditingAsset({ ...editingAsset, alt_text: e.target.value })
                  }
                  placeholder="Describe the image for accessibility"
                />
                <p className="text-xs text-muted-foreground">
                  Required for accessibility. Describe the content and purpose.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={editingAsset.description || ''}
                  onChange={(e) =>
                    setEditingAsset({ ...editingAsset, description: e.target.value })
                  }
                  placeholder="Add a detailed description"
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label>Caption</Label>
                <Input
                  value={editingAsset.caption || ''}
                  onChange={(e) =>
                    setEditingAsset({ ...editingAsset, caption: e.target.value })
                  }
                  placeholder="Caption text"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingAsset(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (editingAsset) {
                  updateMutation.mutate({
                    id: editingAsset.id,
                    updates: {
                      title: editingAsset.title,
                      alt_text: editingAsset.alt_text,
                      description: editingAsset.description,
                      caption: editingAsset.caption,
                    },
                  });
                }
              }}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingAsset} onOpenChange={() => setDeletingAsset(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Media?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingAsset?.original_name}"? This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deletingAsset) {
                  deleteMutation.mutate(deletingAsset.id);
                }
              }}
            >
              {deleteMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Preview Dialog */}
      <Dialog open={!!previewAsset} onOpenChange={() => setPreviewAsset(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{previewAsset?.original_name}</DialogTitle>
          </DialogHeader>

          {previewAsset && (
            <div className="space-y-4">
              {/* Preview */}
              <div className="relative aspect-video bg-muted rounded-lg overflow-hidden flex items-center justify-center">
                {previewAsset.mime_type.startsWith('image/') ? (
                  <img
                    src={previewAsset.public_url || ''}
                    alt={previewAsset.alt_text || previewAsset.original_name}
                    className="max-w-full max-h-full object-contain"
                  />
                ) : previewAsset.mime_type.startsWith('video/') ? (
                  <video
                    src={previewAsset.public_url || ''}
                    controls
                    className="max-w-full max-h-full"
                  />
                ) : (
                  <div className="text-center">
                    <MediaIcon
                      mimeType={previewAsset.mime_type}
                      className="h-16 w-16 mx-auto mb-4 text-muted-foreground"
                    />
                    <p className="text-muted-foreground">Preview not available</p>
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">File size</p>
                  <p className="font-medium">{formatBytes(previewAsset.file_size)}</p>
                </div>
                {previewAsset.width && previewAsset.height && (
                  <div>
                    <p className="text-muted-foreground">Dimensions</p>
                    <p className="font-medium">
                      {previewAsset.width} × {previewAsset.height}
                    </p>
                  </div>
                )}
                <div>
                  <p className="text-muted-foreground">Type</p>
                  <p className="font-medium">{previewAsset.mime_type}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Uploaded</p>
                  <p className="font-medium">
                    {new Date(previewAsset.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>

              {/* URL */}
              <div className="flex items-center gap-2">
                <Input
                  value={previewAsset.public_url || ''}
                  readOnly
                  className="font-mono text-xs"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyUrl(previewAsset.public_url || '')}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* New Folder Dialog */}
      <Dialog open={newFolderDialogOpen} onOpenChange={setNewFolderDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Folder</DialogTitle>
            <DialogDescription>Create a new folder to organize your media.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Folder Name</Label>
              <Input
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Enter folder name"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setNewFolderDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createFolderMutation.mutate(newFolderName)}
              disabled={!newFolderName.trim() || createFolderMutation.isPending}
            >
              {createFolderMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <FolderPlus className="h-4 w-4 mr-2" />
              )}
              Create Folder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MediaLibrary;
