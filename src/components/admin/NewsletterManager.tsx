import { useEffect, useState } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Search, Mail, Users, TrendingUp, Download } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { logger } from '@/lib/logger';

interface Subscriber {
  id: string;
  email: string;
  subscribed_at: string;
  welcome_email_sent: boolean;
  active: boolean;
  created_at: string;
  // Added by 20261116000107_newsletter_double_opt_in.sql.
  confirmed_at: string | null;
  unsubscribed_at: string | null;
}

const PAGE_SIZE = 50;
/** PostgREST max_rows (supabase/config.toml). */
const EXPORT_PAGE = 1000;
const SUBSCRIBER_COLUMNS =
  'id, email, subscribed_at, welcome_email_sent, active, created_at, confirmed_at, unsubscribed_at';

const escapeLike = (term: string) => term.replace(/[\\%_]/g, (ch) => `\\${ch}`);

type SubscriberStatus = 'confirmed' | 'pending' | 'unsubscribed' | 'inactive';

function subscriberStatus(s: Subscriber): SubscriberStatus {
  if (s.unsubscribed_at) return 'unsubscribed';
  if (s.active && s.confirmed_at) return 'confirmed';
  if (!s.active && !s.confirmed_at) return 'pending';
  return 'inactive';
}

const STATUS_BADGE: Record<
  SubscriberStatus,
  { label: string; variant: 'default' | 'secondary' | 'outline' }
> = {
  confirmed: { label: 'Confirmed', variant: 'default' },
  pending: { label: 'Pending', variant: 'outline' },
  unsubscribed: { label: 'Unsubscribed', variant: 'secondary' },
  inactive: { label: 'Inactive', variant: 'secondary' },
};

// The generated types predate the double opt-in columns, so the table is
// queried untyped and rows are cast to Subscriber.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const subscribersTable = () => supabase.from('newsletter_subscribers') as any;

/** Head-only count: PostgREST returns the number without any rows. */
async function countWhere(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  filter: (q: any) => any = (q) => q
): Promise<number> {
  const { count, error } = await filter(
    subscribersTable().select('id', { count: 'exact', head: true })
  );
  if (error) throw error;
  return count ?? 0;
}

const NewsletterManager = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [search, setSearch] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    const id = setTimeout(() => setSearch(searchTerm.trim()), 300);
    return () => clearTimeout(id);
  }, [searchTerm]);

  const countsQuery = useQuery({
    queryKey: ['newsletter-subscribers', 'counts'],
    queryFn: async () => {
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const [total, confirmed, pending, unsubscribed, welcomeSent, last30] = await Promise.all([
        countWhere(),
        countWhere((q) => q.eq('active', true).not('confirmed_at', 'is', null)),
        countWhere((q) =>
          q.eq('active', false).is('confirmed_at', null).is('unsubscribed_at', null)
        ),
        countWhere((q) => q.not('unsubscribed_at', 'is', null)),
        countWhere((q) => q.eq('welcome_email_sent', true)),
        countWhere((q) => q.gte('subscribed_at', since)),
      ]);
      return { total, confirmed, pending, unsubscribed, welcomeSent, last30 };
    },
  });
  const counts = countsQuery.data;

  const listQuery = useInfiniteQuery({
    queryKey: ['newsletter-subscribers', 'list', search],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const from = pageParam * PAGE_SIZE;
      let q = subscribersTable()
        .select(SUBSCRIBER_COLUMNS, { count: 'exact' })
        .order('subscribed_at', { ascending: false })
        .order('id', { ascending: true });
      if (search) q = q.ilike('email', `%${escapeLike(search)}%`);
      const { data, error, count } = await q.range(from, from + PAGE_SIZE - 1);
      if (error) throw error;
      return { rows: (data ?? []) as Subscriber[], count: (count as number | null) ?? 0 };
    },
    getNextPageParam: (last, pages) => {
      const loaded = pages.reduce((n, p) => n + p.rows.length, 0);
      return loaded < last.count ? pages.length : undefined;
    },
  });
  const subscribers = listQuery.data?.pages.flatMap((p) => p.rows) ?? [];
  const matchCount = listQuery.data?.pages[0]?.count ?? 0;

  const [isExporting, setIsExporting] = useState(false);
  const exportSubscribers = async () => {
    setIsExporting(true);
    try {
      // Confirmed, still-subscribed addresses only, every page of them.
      const rows: Subscriber[] = [];
      for (let from = 0; ; from += EXPORT_PAGE) {
        const { data, error } = await subscribersTable()
          .select(SUBSCRIBER_COLUMNS)
          .eq('active', true)
          .not('confirmed_at', 'is', null)
          .order('subscribed_at', { ascending: false })
          .order('id', { ascending: true })
          .range(from, from + EXPORT_PAGE - 1);
        if (error) throw error;
        rows.push(...((data ?? []) as Subscriber[]));
        if (!data || data.length < EXPORT_PAGE) break;
      }

      if (rows.length === 0) {
        toast({
          title: 'No data to export',
          description: 'There are no confirmed subscribers to export.',
          variant: 'destructive',
        });
        return;
      }

      const csvContent = [
        ['Email', 'Subscribed At', 'Confirmed At', 'Welcome Email Sent'].join(','),
        ...rows.map((sub) =>
          [
            sub.email,
            new Date(sub.subscribed_at).toLocaleDateString(),
            sub.confirmed_at ? new Date(sub.confirmed_at).toLocaleDateString() : '',
            sub.welcome_email_sent ? 'Yes' : 'No',
          ].join(',')
        ),
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `newsletter-subscribers-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast({
        title: 'Export successful',
        description: `Exported ${rows.length} confirmed subscribers to CSV.`,
      });
    } catch (error) {
      logger.error('Newsletter export failed:', error);
      toast({
        title: 'Export failed',
        description: 'Could not load subscribers. Try again.',
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  };

  const show = (n: number | undefined) => (countsQuery.isError ? '-' : (n ?? '...'));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Newsletter Management</h2>
        <p className="text-muted-foreground">
          Manage your newsletter subscribers and track engagement metrics.
        </p>
      </div>

      {countsQuery.isError && (
        <div
          role="alert"
          className="flex items-center justify-between gap-2 rounded-lg border border-destructive/40 p-3 text-sm"
        >
          <span>Subscriber counts could not be loaded.</span>
          <Button variant="outline" size="sm" onClick={() => countsQuery.refetch()}>
            Retry
          </Button>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Confirmed Subscribers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{show(counts?.confirmed)}</div>
            <p className="text-xs text-muted-foreground">
              {show(counts?.pending)} pending, {show(counts?.unsubscribed)} unsubscribed,{' '}
              {show(counts?.total)} total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Welcome Emails</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{show(counts?.welcomeSent)}</div>
            <p className="text-xs text-muted-foreground">
              {counts && counts.confirmed > 0
                ? `${Math.round((counts.welcomeSent / counts.confirmed) * 100)}% of confirmed`
                : 'No confirmed subscribers yet'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">New Signups</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{show(counts?.last30)}</div>
            <p className="text-xs text-muted-foreground">Last 30 days</p>
          </CardContent>
        </Card>
      </div>

      {/* Subscribers Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle>Subscribers</CardTitle>
              <CardDescription>Manage and view all newsletter subscribers</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={exportSubscribers}
                disabled={isExporting || !counts || counts.confirmed === 0}
              >
                <Download className="h-4 w-4 mr-2" />
                {isExporting ? 'Exporting...' : 'Export CSV'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-2 mb-4">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search subscribers..."
              aria-label="Search subscribers by email"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
            {listQuery.data && (
              <span className="text-xs text-muted-foreground" aria-live="polite">
                Showing {subscribers.length} of {matchCount}
              </span>
            )}
          </div>

          {listQuery.isLoading ? (
            <div className="flex justify-center py-8">
              <div className="text-muted-foreground">Loading subscribers...</div>
            </div>
          ) : listQuery.isError ? (
            <div
              role="alert"
              className="flex items-center justify-between gap-2 rounded-lg border border-destructive/40 p-3 text-sm"
            >
              <span>Subscribers could not be loaded.</span>
              <Button variant="outline" size="sm" onClick={() => listQuery.refetch()}>
                Retry
              </Button>
            </div>
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Subscribed</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Welcome Email</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {subscribers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                          {search
                            ? 'No subscribers found matching your search.'
                            : 'No subscribers yet.'}
                        </TableCell>
                      </TableRow>
                    ) : (
                      subscribers.map((subscriber) => {
                        const badge = STATUS_BADGE[subscriberStatus(subscriber)];
                        return (
                          <TableRow key={subscriber.id}>
                            <TableCell className="font-medium">{subscriber.email}</TableCell>
                            <TableCell>
                              {new Date(subscriber.subscribed_at).toLocaleDateString()}
                            </TableCell>
                            <TableCell>
                              <Badge variant={badge.variant}>{badge.label}</Badge>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={subscriber.welcome_email_sent ? 'default' : 'outline'}
                              >
                                {subscriber.welcome_email_sent ? 'Sent' : 'Not sent'}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
              {listQuery.hasNextPage && (
                <div className="flex justify-center pt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => listQuery.fetchNextPage()}
                    disabled={listQuery.isFetchingNextPage}
                  >
                    {listQuery.isFetchingNextPage ? 'Loading...' : 'Load more'}
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default NewsletterManager;
