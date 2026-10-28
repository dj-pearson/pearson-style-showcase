import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Public profile fields shared by Navigation, Footer, AuthorByline and the
 * About page. They used to run four separate queries against the same
 * single-row table under four keys, so a first paint fetched the row twice
 * (nav + footer) and every other page added one more. One key and one column
 * list means one request per cache lifetime, shared by every consumer.
 *
 * The admin ProfileSettingsManager invalidates ['profile-settings'] after a
 * save, which matches this key.
 */
export const PROFILE_SETTINGS_QUERY_KEY = ['profile-settings', 'public'] as const;

export const PROFILE_SETTINGS_PUBLIC_COLUMNS =
  'availability_status, availability_text, linkedin_url, github_url, email, bio_headline, bio_subheadline, profile_photo_url, location, years_experience';

export interface PublicProfileSettings {
  availability_status: string | null;
  availability_text: string | null;
  linkedin_url: string | null;
  github_url: string | null;
  email: string | null;
  bio_headline: string | null;
  bio_subheadline: string | null;
  profile_photo_url: string | null;
  location: string | null;
  years_experience: number | null;
}

export const fetchPublicProfileSettings = async (): Promise<PublicProfileSettings | null> => {
  const { data, error } = await supabase
    .from('profile_settings')
    .select(PROFILE_SETTINGS_PUBLIC_COLUMNS)
    .maybeSingle();
  if (error) throw error;
  return (data as PublicProfileSettings | null) ?? null;
};

export const useProfileSettings = () =>
  useQuery({
    queryKey: PROFILE_SETTINGS_QUERY_KEY,
    queryFn: fetchPublicProfileSettings,
    staleTime: 10 * 60 * 1000,
  });
