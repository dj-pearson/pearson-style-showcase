/**
 * Stand-in for src/integrations/supabase/public-client.ts that routes every
 * query to whatever the test has mocked '@/integrations/supabase/client' with,
 * so one supabase mock covers code on either client. Use alongside that mock:
 *
 *   vi.mock('@/integrations/supabase/public-client', () => import('@/test/mocks/public-client'));
 *
 * Behaves as an anonymous visitor: no stored session, no access token.
 */
import { supabase } from '@/integrations/supabase/client';

export const publicDb = supabase;
export const hasStoredSession = (): boolean => false;
export const getAccessToken = async (): Promise<string | null> => null;
export const getDbForCurrentUser = async () => supabase;
