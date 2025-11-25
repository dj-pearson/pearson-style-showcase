import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { usePermission, PERMISSIONS } from '@/hooks/usePermission';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  FileText,
  Download,
  Users,
  Shield,
  ShieldCheck,
  Eye,
  AlertTriangle,
  CheckCircle,
  Clock,
} from 'lucide-react';
import { format, subDays } from 'date-fns';

interface WhitelistEntry {
  id: string;
  email: string;
  is_active: boolean;
  added_at: string;
  notes: string | null;
}

interface UserRole {
  id: string;
  user_id: string;
  role: string;
  granted_at: string;
  expires_at: string | null;
  is_active: boolean;
}

interface ActivitySummary {
  admin_email: string;
  action_count: number;
  last_activity: string;
}

const ROLE_COLORS: Record<string, string> = {
  admin: 'bg-red-500',
  editor: 'bg-blue-500',
  viewer: 'bg-gray-500',
};

const AccessReviewReport: React.FC = () => {
  const canViewRoles = usePermission(PERMISSIONS.ROLES_READ);
  const canViewWhitelist = usePermission(PERMISSIONS.WHITELIST_READ);
  const canViewActivity = usePermission(PERMISSIONS.ACTIVITY_LOG_VIEW);

  const [reportPeriod, setReportPeriod] = useState<string>('30days');

  // Fetch whitelist
  const { data: whitelist, isLoading: whitelistLoading } = useQuery({
    queryKey: ['whitelist-report'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('admin_whitelist')
        .select('*')
        .order('added_at', { ascending: false });

      if (error) throw error;
      return data as WhitelistEntry[];
    },
    enabled: canViewWhitelist,
  });

  // Fetch user roles
  const { data: userRoles, isLoading: rolesLoading } = useQuery({
    queryKey: ['roles-report'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_roles')
        .select('*')
        .order('granted_at', { ascending: false });

      if (error) throw error;
      return data as UserRole[];
    },
    enabled: canViewRoles,
  });

  // Fetch activity summary
  const { data: activitySummary, isLoading: activityLoading } = useQuery({
    queryKey: ['activity-summary', reportPeriod],
    queryFn: async () => {
      const daysAgo = reportPeriod === '7days' ? 7 : reportPeriod === '30days' ? 30 : 90;
      const startDate = subDays(new Date(), daysAgo);

      const { data, error } = await supabase
        .from('admin_activity_log')
        .select('admin_email, timestamp')
        .gte('timestamp', startDate.toISOString());

      if (error) throw error;

      // Aggregate by email
      const summary: Record<string, { count: number; lastActivity: string }> = {};
      (data || []).forEach((log: { admin_email: string; timestamp: string }) => {
        if (!summary[log.admin_email]) {
          summary[log.admin_email] = { count: 0, lastActivity: log.timestamp };
        }
        summary[log.admin_email].count++;
        if (log.timestamp > summary[log.admin_email].lastActivity) {
          summary[log.admin_email].lastActivity = log.timestamp;
        }
      });

      return Object.entries(summary).map(([email, data]) => ({
        admin_email: email,
        action_count: data.count,
        last_activity: data.lastActivity,
      })) as ActivitySummary[];
    },
    enabled: canViewActivity,
  });

  // Calculate statistics
  const stats = {
    totalAdmins: whitelist?.filter((w) => w.is_active).length || 0,
    totalRoles: userRoles?.filter((r) => r.is_active).length || 0,
    adminRoles: userRoles?.filter((r) => r.role === 'admin' && r.is_active).length || 0,
    editorRoles: userRoles?.filter((r) => r.role === 'editor' && r.is_active).length || 0,
    viewerRoles: userRoles?.filter((r) => r.role === 'viewer' && r.is_active).length || 0,
    expiringRoles: userRoles?.filter(
      (r) => r.expires_at && new Date(r.expires_at) < subDays(new Date(), -30) && r.is_active
    ).length || 0,
    inactiveWhitelist: whitelist?.filter((w) => !w.is_active).length || 0,
    activeInPeriod: activitySummary?.length || 0,
  };

  // Export report
  const handleExport = () => {
    const report = {
      generatedAt: new Date().toISOString(),
      period: reportPeriod,
      summary: stats,
      whitelist: whitelist || [],
      roles: userRoles || [],
      activitySummary: activitySummary || [],
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `access-review-${format(new Date(), 'yyyy-MM-dd')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const isLoading = whitelistLoading || rolesLoading || activityLoading;

  if (!canViewRoles && !canViewWhitelist) {
    return (
      <Alert>
        <FileText className="h-4 w-4" />
        <AlertDescription>
          You don't have permission to view access review reports.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Access Review Report
              </CardTitle>
              <CardDescription>
                Comprehensive overview of user access and permissions.
              </CardDescription>
            </div>
            <div className="flex items-center gap-4">
              <Select value={reportPeriod} onValueChange={setReportPeriod}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Report Period" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7days">Last 7 days</SelectItem>
                  <SelectItem value="30days">Last 30 days</SelectItem>
                  <SelectItem value="90days">Last 90 days</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={handleExport}>
                <Download className="h-4 w-4 mr-2" />
                Export Report
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-primary/10">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active Admins</p>
                <p className="text-2xl font-bold">{stats.totalAdmins}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-green-500/10">
                <CheckCircle className="h-6 w-6 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active Roles</p>
                <p className="text-2xl font-bold">{stats.totalRoles}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-blue-500/10">
                <Clock className="h-6 w-6 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active in Period</p>
                <p className="text-2xl font-bold">{stats.activeInPeriod}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-yellow-500/10">
                <AlertTriangle className="h-6 w-6 text-yellow-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Expiring Soon</p>
                <p className="text-2xl font-bold">{stats.expiringRoles}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Role Distribution */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Role Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-20 w-full" />
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 w-24">
                  <ShieldCheck className="h-4 w-4 text-red-500" />
                  <span className="text-sm">Admin</span>
                </div>
                <div className="flex-1">
                  <Progress
                    value={
                      stats.totalRoles > 0
                        ? (stats.adminRoles / stats.totalRoles) * 100
                        : 0
                    }
                    className="h-2"
                  />
                </div>
                <span className="text-sm font-medium w-8">{stats.adminRoles}</span>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 w-24">
                  <Shield className="h-4 w-4 text-blue-500" />
                  <span className="text-sm">Editor</span>
                </div>
                <div className="flex-1">
                  <Progress
                    value={
                      stats.totalRoles > 0
                        ? (stats.editorRoles / stats.totalRoles) * 100
                        : 0
                    }
                    className="h-2"
                  />
                </div>
                <span className="text-sm font-medium w-8">{stats.editorRoles}</span>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 w-24">
                  <Eye className="h-4 w-4 text-gray-500" />
                  <span className="text-sm">Viewer</span>
                </div>
                <div className="flex-1">
                  <Progress
                    value={
                      stats.totalRoles > 0
                        ? (stats.viewerRoles / stats.totalRoles) * 100
                        : 0
                    }
                    className="h-2"
                  />
                </div>
                <span className="text-sm font-medium w-8">{stats.viewerRoles}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Activity Summary */}
      {canViewActivity && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Activity Summary</CardTitle>
            <CardDescription>
              Admin activity over the selected period.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {activityLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : !activitySummary || activitySummary.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No activity recorded in the selected period.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Admin Email</TableHead>
                    <TableHead>Actions</TableHead>
                    <TableHead>Last Active</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activitySummary
                    .sort((a, b) => b.action_count - a.action_count)
                    .map((summary) => (
                      <TableRow key={summary.admin_email}>
                        <TableCell className="font-medium">
                          {summary.admin_email}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{summary.action_count} actions</Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {format(new Date(summary.last_activity), 'MMM d, yyyy HH:mm')}
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Whitelist Status */}
      {canViewWhitelist && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Whitelist Status</CardTitle>
            <CardDescription>
              Current admin whitelist entries.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {whitelistLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : !whitelist || whitelist.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No entries in whitelist.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Added</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {whitelist.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="font-medium">{entry.email}</TableCell>
                      <TableCell>
                        <Badge variant={entry.is_active ? 'default' : 'secondary'}>
                          {entry.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(new Date(entry.added_at), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {entry.notes || '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Role Assignments */}
      {canViewRoles && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Role Assignments</CardTitle>
            <CardDescription>
              All current role assignments in the system.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {rolesLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : !userRoles || userRoles.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No role assignments found.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User ID</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Granted</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {userRoles.map((role) => (
                    <TableRow key={role.id}>
                      <TableCell>
                        <code className="text-xs bg-muted px-2 py-1 rounded">
                          {role.user_id.substring(0, 8)}...
                        </code>
                      </TableCell>
                      <TableCell>
                        <Badge className={`${ROLE_COLORS[role.role] || 'bg-gray-500'} text-white`}>
                          {role.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(new Date(role.granted_at), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {role.expires_at
                          ? format(new Date(role.expires_at), 'MMM d, yyyy')
                          : 'Never'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={role.is_active ? 'default' : 'secondary'}>
                          {role.is_active ? 'Active' : 'Revoked'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Report Footer */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              Report generated: {format(new Date(), 'MMMM d, yyyy HH:mm:ss')}
            </span>
            <span>Period: {reportPeriod === '7days' ? 'Last 7 days' : reportPeriod === '30days' ? 'Last 30 days' : 'Last 90 days'}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AccessReviewReport;
