import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { usePermission, PERMISSIONS } from '@/hooks/usePermission';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Activity,
  Search,
  Filter,
  Calendar,
  User,
  FileText,
  Settings,
  Shield,
  Download,
  ChevronLeft,
  ChevronRight,
  Eye,
} from 'lucide-react';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';

interface ActivityLogEntry {
  id: string;
  admin_id: string | null;
  admin_email: string;
  action: string;
  action_category: string | null;
  resource_type: string | null;
  resource_id: string | null;
  resource_title: string | null;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  success: boolean | null;
  timestamp: string;
}

const ACTION_COLORS: Record<string, string> = {
  INSERT: 'bg-green-500',
  UPDATE: 'bg-blue-500',
  DELETE: 'bg-red-500',
  LOGIN: 'bg-purple-500',
  LOGOUT: 'bg-gray-500',
};

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  content: <FileText className="h-4 w-4" />,
  users: <User className="h-4 w-4" />,
  system: <Settings className="h-4 w-4" />,
  authentication: <Shield className="h-4 w-4" />,
};

const PAGE_SIZE = 20;

const ActivityLogViewer: React.FC = () => {
  const canView = usePermission(PERMISSIONS.ACTIVITY_LOG_VIEW);

  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState<string>('7days');
  const [page, setPage] = useState(1);
  const [selectedEntry, setSelectedEntry] = useState<ActivityLogEntry | null>(null);

  // Calculate date range
  const getDateRange = () => {
    const now = new Date();
    switch (dateRange) {
      case 'today':
        return { start: startOfDay(now), end: endOfDay(now) };
      case '7days':
        return { start: startOfDay(subDays(now, 7)), end: endOfDay(now) };
      case '30days':
        return { start: startOfDay(subDays(now, 30)), end: endOfDay(now) };
      case '90days':
        return { start: startOfDay(subDays(now, 90)), end: endOfDay(now) };
      default:
        return { start: startOfDay(subDays(now, 7)), end: endOfDay(now) };
    }
  };

  // Fetch activity logs
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['activity-logs', searchQuery, actionFilter, categoryFilter, dateRange, page],
    queryFn: async () => {
      const { start, end } = getDateRange();

      let query = supabase
        .from('admin_activity_log')
        .select('*', { count: 'exact' })
        .gte('timestamp', start.toISOString())
        .lte('timestamp', end.toISOString())
        .order('timestamp', { ascending: false })
        .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

      if (actionFilter !== 'all') {
        query = query.eq('action', actionFilter);
      }

      if (categoryFilter !== 'all') {
        query = query.eq('action_category', categoryFilter);
      }

      if (searchQuery) {
        query = query.or(
          `admin_email.ilike.%${searchQuery}%,resource_title.ilike.%${searchQuery}%,resource_type.ilike.%${searchQuery}%`
        );
      }

      const { data, error, count } = await query;

      if (error) throw error;
      return { logs: data as ActivityLogEntry[], totalCount: count || 0 };
    },
    enabled: canView,
  });

  // Export to CSV
  const handleExport = async () => {
    const { start, end } = getDateRange();

    const { data: exportData, error } = await supabase
      .from('admin_activity_log')
      .select('*')
      .gte('timestamp', start.toISOString())
      .lte('timestamp', end.toISOString())
      .order('timestamp', { ascending: false });

    if (error) {
      console.error('Export failed:', error);
      return;
    }

    // Convert to CSV
    const headers = [
      'Timestamp',
      'Admin Email',
      'Action',
      'Category',
      'Resource Type',
      'Resource Title',
      'IP Address',
      'Success',
    ];
    const rows = (exportData || []).map((log: ActivityLogEntry) => [
      log.timestamp,
      log.admin_email,
      log.action,
      log.action_category || '',
      log.resource_type || '',
      log.resource_title || '',
      log.ip_address || '',
      log.success ? 'Yes' : 'No',
    ]);

    const csv = [headers, ...rows].map((row) => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `activity-log-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalPages = data ? Math.ceil(data.totalCount / PAGE_SIZE) : 0;

  if (!canView) {
    return (
      <Alert>
        <Activity className="h-4 w-4" />
        <AlertDescription>
          You don't have permission to view activity logs.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Activity Log
            </CardTitle>
            <CardDescription>
              View and search admin activity across the system.
            </CardDescription>
          </div>
          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Filters */}
        <div className="flex flex-wrap gap-4 mb-6">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by email, resource..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                className="pl-10"
              />
            </div>
          </div>

          <Select
            value={actionFilter}
            onValueChange={(value) => {
              setActionFilter(value);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[140px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Action" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Actions</SelectItem>
              <SelectItem value="INSERT">Create</SelectItem>
              <SelectItem value="UPDATE">Update</SelectItem>
              <SelectItem value="DELETE">Delete</SelectItem>
              <SelectItem value="LOGIN">Login</SelectItem>
              <SelectItem value="LOGOUT">Logout</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={categoryFilter}
            onValueChange={(value) => {
              setCategoryFilter(value);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="content">Content</SelectItem>
              <SelectItem value="users">Users</SelectItem>
              <SelectItem value="system">System</SelectItem>
              <SelectItem value="authentication">Authentication</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={dateRange}
            onValueChange={(value) => {
              setDateRange(value);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[140px]">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Date Range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="7days">Last 7 days</SelectItem>
              <SelectItem value="30days">Last 30 days</SelectItem>
              <SelectItem value="90days">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : error ? (
          <Alert variant="destructive">
            <AlertDescription>
              Failed to load activity logs: {(error as Error).message}
            </AlertDescription>
          </Alert>
        ) : !data?.logs || data.logs.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            No activity logs found for the selected filters.
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Admin</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Resource</TableHead>
                  <TableHead className="text-right">Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      <div className="text-sm">
                        {format(new Date(log.timestamp), 'MMM d, yyyy')}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {format(new Date(log.timestamp), 'HH:mm:ss')}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{log.admin_email}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={`${ACTION_COLORS[log.action] || 'bg-gray-500'} text-white`}
                      >
                        {log.action}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {log.action_category && (
                        <div className="flex items-center gap-2">
                          {CATEGORY_ICONS[log.action_category] || null}
                          <span className="text-sm capitalize">
                            {log.action_category}
                          </span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {log.resource_type && (
                        <div>
                          <div className="text-sm font-medium capitalize">
                            {log.resource_type}
                          </div>
                          {log.resource_title && (
                            <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                              {log.resource_title}
                            </div>
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedEntry(log)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                          <DialogHeader>
                            <DialogTitle>Activity Details</DialogTitle>
                            <DialogDescription>
                              Full details for this activity log entry.
                            </DialogDescription>
                          </DialogHeader>
                          <ScrollArea className="max-h-[60vh]">
                            <div className="space-y-4 p-4">
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <label className="text-sm font-medium text-muted-foreground">
                                    Timestamp
                                  </label>
                                  <p className="text-sm">
                                    {format(
                                      new Date(log.timestamp),
                                      'PPpp'
                                    )}
                                  </p>
                                </div>
                                <div>
                                  <label className="text-sm font-medium text-muted-foreground">
                                    Admin Email
                                  </label>
                                  <p className="text-sm">{log.admin_email}</p>
                                </div>
                                <div>
                                  <label className="text-sm font-medium text-muted-foreground">
                                    Action
                                  </label>
                                  <p className="text-sm">{log.action}</p>
                                </div>
                                <div>
                                  <label className="text-sm font-medium text-muted-foreground">
                                    Category
                                  </label>
                                  <p className="text-sm capitalize">
                                    {log.action_category || 'N/A'}
                                  </p>
                                </div>
                                <div>
                                  <label className="text-sm font-medium text-muted-foreground">
                                    Resource Type
                                  </label>
                                  <p className="text-sm capitalize">
                                    {log.resource_type || 'N/A'}
                                  </p>
                                </div>
                                <div>
                                  <label className="text-sm font-medium text-muted-foreground">
                                    Resource ID
                                  </label>
                                  <p className="text-sm font-mono text-xs">
                                    {log.resource_id || 'N/A'}
                                  </p>
                                </div>
                                <div className="col-span-2">
                                  <label className="text-sm font-medium text-muted-foreground">
                                    Resource Title
                                  </label>
                                  <p className="text-sm">
                                    {log.resource_title || 'N/A'}
                                  </p>
                                </div>
                                <div>
                                  <label className="text-sm font-medium text-muted-foreground">
                                    IP Address
                                  </label>
                                  <p className="text-sm font-mono">
                                    {log.ip_address || 'N/A'}
                                  </p>
                                </div>
                                <div>
                                  <label className="text-sm font-medium text-muted-foreground">
                                    Success
                                  </label>
                                  <p className="text-sm">
                                    {log.success === null
                                      ? 'N/A'
                                      : log.success
                                      ? 'Yes'
                                      : 'No'}
                                  </p>
                                </div>
                              </div>

                              {log.old_values && (
                                <div>
                                  <label className="text-sm font-medium text-muted-foreground">
                                    Previous Values
                                  </label>
                                  <pre className="mt-1 p-3 bg-muted rounded-md text-xs overflow-auto">
                                    {JSON.stringify(log.old_values, null, 2)}
                                  </pre>
                                </div>
                              )}

                              {log.new_values && (
                                <div>
                                  <label className="text-sm font-medium text-muted-foreground">
                                    New Values
                                  </label>
                                  <pre className="mt-1 p-3 bg-muted rounded-md text-xs overflow-auto">
                                    {JSON.stringify(log.new_values, null, 2)}
                                  </pre>
                                </div>
                              )}

                              {log.user_agent && (
                                <div>
                                  <label className="text-sm font-medium text-muted-foreground">
                                    User Agent
                                  </label>
                                  <p className="text-xs text-muted-foreground break-all">
                                    {log.user_agent}
                                  </p>
                                </div>
                              )}
                            </div>
                          </ScrollArea>
                        </DialogContent>
                      </Dialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* Pagination */}
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted-foreground">
                Showing {(page - 1) * PAGE_SIZE + 1} to{' '}
                {Math.min(page * PAGE_SIZE, data.totalCount)} of {data.totalCount}{' '}
                entries
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default ActivityLogViewer;
