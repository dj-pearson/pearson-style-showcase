import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2, Save, User } from 'lucide-react';

const ProfileSettingsManager = () => {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);

  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile-settings-admin'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profile_settings' as any)
        .select('*')
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const [formData, setFormData] = useState<any>(profile || {});

  const updateProfile = useMutation({
    mutationFn: async (data: any) => {
      if (!profile?.id) throw new Error('Profile not found');
      const { error } = await supabase
        .from('profile_settings' as any)
        .update(data)
        .eq('id', profile.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile-settings-admin'] });
      queryClient.invalidateQueries({ queryKey: ['profile-settings'] });
      queryClient.invalidateQueries({ queryKey: ['profile-settings-nav'] });
      toast.success('Profile settings updated successfully!');
      setIsEditing(false);
    },
    onError: (error: any) => {
      toast.error(`Failed to update profile: ${error.message}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfile.mutate(formData);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="w-5 h-5" />
          Profile Settings
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Photo URL */}
          <div className="space-y-2">
            <Label htmlFor="profile_photo_url">Profile Photo URL</Label>
            <Input
              id="profile_photo_url"
              value={formData.profile_photo_url || ''}
              onChange={(e) => setFormData({ ...formData, profile_photo_url: e.target.value })}
              placeholder="https://example.com/photo.jpg"
              disabled={!isEditing}
            />
            <p className="text-sm text-muted-foreground">
              Upload your photo to public storage and paste the URL here
            </p>
          </div>

          {/* Bio Headline */}
          <div className="space-y-2">
            <Label htmlFor="bio_headline">Bio Headline</Label>
            <Input
              id="bio_headline"
              value={formData.bio_headline || ''}
              onChange={(e) => setFormData({ ...formData, bio_headline: e.target.value })}
              placeholder="Bridging the gap between sales and technology"
              disabled={!isEditing}
            />
          </div>

          {/* Bio Subheadline */}
          <div className="space-y-2">
            <Label htmlFor="bio_subheadline">Bio Subheadline</Label>
            <Textarea
              id="bio_subheadline"
              value={formData.bio_subheadline || ''}
              onChange={(e) => setFormData({ ...formData, bio_subheadline: e.target.value })}
              placeholder="With 15+ years closing deals..."
              rows={3}
              disabled={!isEditing}
            />
          </div>

          {/* Availability Status */}
          <div className="space-y-2">
            <Label htmlFor="availability_status">Availability Status</Label>
            <Select
              value={formData.availability_status || 'available'}
              onValueChange={(value) => setFormData({ ...formData, availability_status: value })}
              disabled={!isEditing}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="available">Available</SelectItem>
                <SelectItem value="limited">Limited</SelectItem>
                <SelectItem value="unavailable">Unavailable</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Calendly URL */}
          <div className="space-y-2">
            <Label htmlFor="calendly_url">Calendly/Booking URL</Label>
            <Input
              id="calendly_url"
              value={formData.calendly_url || ''}
              onChange={(e) => setFormData({ ...formData, calendly_url: e.target.value })}
              placeholder="https://calendly.com/yourusername"
              disabled={!isEditing}
            />
          </div>

          {/* Location */}
          <div className="space-y-2">
            <Label htmlFor="location">Location</Label>
            <Input
              id="location"
              value={formData.location || ''}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              placeholder="Des Moines Metropolitan Area"
              disabled={!isEditing}
            />
          </div>

          {/* Years Experience */}
          <div className="space-y-2">
            <Label htmlFor="years_experience">Years of Experience</Label>
            <Input
              id="years_experience"
              type="number"
              value={formData.years_experience || 15}
              onChange={(e) => setFormData({ ...formData, years_experience: parseInt(e.target.value) })}
              disabled={!isEditing}
            />
          </div>

          {/* Social Links */}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="linkedin_url">LinkedIn URL</Label>
              <Input
                id="linkedin_url"
                value={formData.linkedin_url || ''}
                onChange={(e) => setFormData({ ...formData, linkedin_url: e.target.value })}
                placeholder="https://linkedin.com/in/username"
                disabled={!isEditing}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="github_url">GitHub URL</Label>
              <Input
                id="github_url"
                value={formData.github_url || ''}
                onChange={(e) => setFormData({ ...formData, github_url: e.target.value })}
                placeholder="https://github.com/username"
                disabled={!isEditing}
              />
            </div>
          </div>

          {/* Email & Phone */}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email || ''}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                disabled={!isEditing}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone (optional)</Label>
              <Input
                id="phone"
                value={formData.phone || ''}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+1 (555) 123-4567"
                disabled={!isEditing}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-4">
            {!isEditing ? (
              <Button
                type="button"
                onClick={() => {
                  setIsEditing(true);
                  setFormData(profile || {});
                }}
              >
                Edit Profile
              </Button>
            ) : (
              <>
                <Button type="submit" disabled={updateProfile.isPending}>
                  {updateProfile.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Save Changes
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsEditing(false);
                    setFormData(profile || {});
                  }}
                >
                  Cancel
                </Button>
              </>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default ProfileSettingsManager;
