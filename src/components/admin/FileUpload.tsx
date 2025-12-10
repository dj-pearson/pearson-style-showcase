import React, { useCallback, useState } from 'react';
import { logger } from "@/lib/logger";
import { useDropzone } from 'react-dropzone';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Upload, X, Image, Loader2, AlertCircle, CheckCircle, Info } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { validateImageAltText, AltTextValidationResult } from '@/lib/security';
import { cn } from '@/lib/utils';

export interface ImageUploadData {
  url: string;
  altText: string;
}

interface FileUploadProps {
  /** Callback when upload completes - receives URL string for backward compatibility */
  onUpload: (url: string) => void;
  /** Enhanced callback that includes alt text - preferred for accessibility */
  onUploadWithAlt?: (data: ImageUploadData) => void;
  acceptedTypes?: string[];
  maxSize?: number;
  currentImage?: string;
  /** Current alt text value for editing */
  currentAltText?: string;
  className?: string;
  /** Require alt text for image uploads (default: false for backward compatibility) */
  requireAltText?: boolean;
  /** Mark image as decorative (no alt text needed) */
  isDecorativeImage?: boolean;
  /** Custom placeholder for alt text input */
  altTextPlaceholder?: string;
}

export const FileUpload: React.FC<FileUploadProps> = ({
  onUpload,
  onUploadWithAlt,
  acceptedTypes = ['image/*'],
  maxSize = 5 * 1024 * 1024, // 5MB default
  currentImage,
  currentAltText = '',
  className,
  requireAltText = false,
  isDecorativeImage = false,
  altTextPlaceholder = 'Describe the image for screen readers (e.g., "Team meeting in conference room")'
}) => {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(currentImage || null);
  const [altText, setAltText] = useState(currentAltText);
  const [altTextValidation, setAltTextValidation] = useState<AltTextValidationResult | null>(null);
  const [pendingUpload, setPendingUpload] = useState<File | null>(null);
  const { toast } = useToast();

  // Validate alt text whenever it changes
  const handleAltTextChange = (value: string) => {
    setAltText(value);
    if (requireAltText && !isDecorativeImage) {
      const validation = validateImageAltText(value, { isDecorativeImage });
      setAltTextValidation(validation);
    }
  };

  // Check if alt text is valid for submission
  const isAltTextValid = () => {
    if (!requireAltText || isDecorativeImage) return true;
    const validation = validateImageAltText(altText, { isDecorativeImage });
    return validation.isValid;
  };

  const performUpload = useCallback(async (file: File, altTextValue: string) => {
    setUploading(true);

    try {
      // Generate unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `uploads/${fileName}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('admin-uploads')
        .upload(filePath, file);

      if (uploadError) {
        throw uploadError;
      }

      // Get public URL
      const { data: publicUrlData } = supabase.storage
        .from('admin-uploads')
        .getPublicUrl(filePath);

      const publicUrl = publicUrlData.publicUrl;
      setPreview(publicUrl);
      setPendingUpload(null);

      // Call callbacks
      onUpload(publicUrl);
      if (onUploadWithAlt) {
        onUploadWithAlt({ url: publicUrl, altText: altTextValue });
      }

      toast({
        title: "File uploaded successfully",
        description: requireAltText ? "Your file has been uploaded with alt text." : "Your file has been uploaded and is ready to use.",
      });

    } catch (error) {
      logger.error('Upload error:', error);
      toast({
        variant: "destructive",
        title: "Upload failed",
        description: "There was an error uploading your file. Please try again.",
      });
    } finally {
      setUploading(false);
    }
  }, [onUpload, onUploadWithAlt, requireAltText, toast]);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    // If alt text is required and not a decorative image, store the file and prompt for alt text
    if (requireAltText && !isDecorativeImage) {
      // Create local preview
      const localPreview = URL.createObjectURL(file);
      setPreview(localPreview);
      setPendingUpload(file);
      setAltTextValidation(validateImageAltText('', { isDecorativeImage: false }));
      toast({
        title: "Alt text required",
        description: "Please add a description for accessibility before the image is saved.",
      });
      return;
    }

    // If no alt text required, proceed with upload immediately
    await performUpload(file, isDecorativeImage ? '' : altText);
  }, [performUpload, requireAltText, isDecorativeImage, altText, toast]);

  const handleConfirmUpload = async () => {
    if (!pendingUpload) return;

    if (!isAltTextValid()) {
      toast({
        variant: "destructive",
        title: "Invalid alt text",
        description: "Please provide a descriptive alt text for the image.",
      });
      return;
    }

    await performUpload(pendingUpload, altText);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: acceptedTypes.reduce((acc, type) => ({ ...acc, [type]: [] }), {}),
    maxSize,
    multiple: false
  });

  const removeImage = () => {
    // Revoke object URL if it was a local preview
    if (preview && preview.startsWith('blob:')) {
      URL.revokeObjectURL(preview);
    }
    setPreview(null);
    setAltText('');
    setAltTextValidation(null);
    setPendingUpload(null);
    onUpload('');
    if (onUploadWithAlt) {
      onUploadWithAlt({ url: '', altText: '' });
    }
  };

  const cancelPendingUpload = () => {
    if (preview && preview.startsWith('blob:')) {
      URL.revokeObjectURL(preview);
    }
    setPreview(null);
    setAltText('');
    setAltTextValidation(null);
    setPendingUpload(null);
  };

  return (
    <div className={className}>
      {preview ? (
        <Card>
          <CardContent className="p-4 space-y-4">
            <div className="relative">
              <img
                src={preview}
                alt={altText || "Preview"}
                className="w-full h-48 object-cover rounded-md"
              />
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="absolute top-2 right-2"
                onClick={pendingUpload ? cancelPendingUpload : removeImage}
              >
                <X className="h-4 w-4" />
              </Button>
              {pendingUpload && (
                <div className="absolute bottom-2 left-2 bg-yellow-500/90 text-yellow-950 text-xs px-2 py-1 rounded flex items-center gap-1">
                  <Info className="h-3 w-3" />
                  Pending upload
                </div>
              )}
            </div>

            {/* Alt text input for images when required */}
            {requireAltText && !isDecorativeImage && acceptedTypes.includes('image/*') && (
              <div className="space-y-2">
                <Label htmlFor="alt-text" className="flex items-center gap-2">
                  Alt Text
                  <span className="text-red-500">*</span>
                  <span className="text-xs text-muted-foreground font-normal">(Required for accessibility)</span>
                </Label>
                <Input
                  id="alt-text"
                  type="text"
                  value={altText}
                  onChange={(e) => handleAltTextChange(e.target.value)}
                  placeholder={altTextPlaceholder}
                  className={cn(
                    altTextValidation && !altTextValidation.isValid && "border-red-500 focus-visible:ring-red-500"
                  )}
                  maxLength={125}
                />

                {/* Validation feedback */}
                {altTextValidation && (
                  <div className="space-y-1">
                    {altTextValidation.errors.length > 0 && (
                      <div className="flex items-start gap-2 text-red-500 text-sm">
                        <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                        <span>{altTextValidation.errors[0]}</span>
                      </div>
                    )}
                    {altTextValidation.isValid && altText.length > 0 && (
                      <div className="flex items-center gap-2 text-green-600 text-sm">
                        <CheckCircle className="h-4 w-4" />
                        <span>Alt text looks good!</span>
                      </div>
                    )}
                    {altTextValidation.suggestions.length > 0 && altTextValidation.isValid && (
                      <div className="flex items-start gap-2 text-amber-600 text-sm">
                        <Info className="h-4 w-4 mt-0.5 shrink-0" />
                        <span>{altTextValidation.suggestions[0]}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Character counter */}
                <p className="text-xs text-muted-foreground text-right">
                  {altText.length}/125 characters
                </p>
              </div>
            )}

            {/* Confirm upload button when pending */}
            {pendingUpload && (
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={cancelPendingUpload}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  className="flex-1"
                  onClick={handleConfirmUpload}
                  disabled={uploading || !isAltTextValid()}
                >
                  {uploading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Confirm Upload
                    </>
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-6">
            <div
              {...getRootProps()}
              className={`
                border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
                ${isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'}
                ${uploading ? 'pointer-events-none opacity-50' : 'hover:border-primary hover:bg-primary/5'}
              `}
            >
              <input {...getInputProps()} />

              {uploading ? (
                <div className="flex flex-col items-center space-y-2">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">Uploading...</p>
                </div>
              ) : (
                <div className="flex flex-col items-center space-y-2">
                  {acceptedTypes.includes('image/*') ? (
                    <Image className="h-8 w-8 text-muted-foreground" />
                  ) : (
                    <Upload className="h-8 w-8 text-muted-foreground" />
                  )}
                  <div>
                    <p className="text-sm font-medium">
                      {isDragActive ? 'Drop the file here' : 'Click to upload or drag and drop'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {acceptedTypes.includes('image/*') ? 'PNG, JPG, GIF up to' : 'Files up to'} {Math.round(maxSize / (1024 * 1024))}MB
                    </p>
                    {requireAltText && acceptedTypes.includes('image/*') && !isDecorativeImage && (
                      <p className="text-xs text-amber-600 mt-2 flex items-center justify-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        Alt text will be required for accessibility
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};