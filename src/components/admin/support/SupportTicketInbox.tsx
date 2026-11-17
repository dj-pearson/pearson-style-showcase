import LoadingSpinner from '@/components/LoadingSpinner';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { RealtimePayload } from '@/types/supabase-realtime';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Inbox,
  Search,
  AlertCircle,
  MessageSquare,
  Clock,
  CheckCircle2,
  XCircle,
  User,
  Archive,
  Trash2,
  CheckCheck,
  X as XIcon,
  Filter,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { useConfirm } from '@/hooks/useConfirm';
import { applyTicketFilters, pageRange, TICKET_PAGE_SIZE } from './ticketQuery';

interface SupportTicket {
  id: string;
  ticket_number: string;
  subject: string;
  message: string;
  user_email: string;
  user_name: string;
  category: string;
  priority: number;
  status: string;
  assigned_to: string | null;
  ai_sentiment_score: number | null;
  created_at: string;
  last_activity_at: string;
  first_response_at: string | null;
}

interface SupportTicketInboxProps {
  onSelectTicket: (ticket: SupportTicket) => void;
  selectedTicketId?: string;
}

export const SupportTicketInbox: React.FC<SupportTicketInboxProps> = ({
  onSelectTicket,
  selectedTicketId,
}) => {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const confirm = useConfirm();
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [stats, setStats] = useState({
    open: 0,
    inProgress: 0,
    waitingForUser: 0,
    waitingForAgent: 0,
    unresponded: 0,
    archived: 0,
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('active');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [showArchived, setShowArchived] = useState(false);
  const [selectedTickets, setSelectedTickets] = useState<Set<string>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  // Debounce typing so each keystroke doesn't hit the database.
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(id);
  }, [searchQuery]);

  // Responses from an older filter set must not overwrite a newer one.
  const requestIdRef = useRef(0);

  const loadTickets = useCallback(
    async (nextPage = 0) => {
      const requestId = ++requestIdRef.current;
      if (nextPage === 0) setIsLoading(true);
      else setIsLoadingMore(true);
      try {
        const [from, to] = pageRange(nextPage);
        const base = supabase.from('support_tickets').select('*', { count: 'exact' });
        const filtered = applyTicketFilters(base, {
          search: debouncedSearch,
          status: statusFilter,
          category: categoryFilter,
          priority: priorityFilter,
          showArchived,
        });
        const { data, error, count } = await filtered
          .order('last_activity_at', { ascending: false })
          .range(from, to);

        if (error) throw error;
        if (requestId !== requestIdRef.current) return;

        const rows = (data || []) as SupportTicket[];
        setTickets((prev) => {
          if (nextPage === 0) return rows;
          // Offsets shift when tickets arrive mid-scroll; drop repeats.
          const seen = new Set(prev.map((t) => t.id));
          return [...prev, ...rows.filter((t) => !seen.has(t.id))];
        });
        setTotalCount(count ?? from + rows.length);
        setPage(nextPage);
        setLoadError(false);
      } catch (error) {
        if (requestId !== requestIdRef.current) return;
        logger.error('Failed to load tickets:', error);
        setLoadError(true);
      } finally {
        if (requestId === requestIdRef.current) {
          setIsLoading(false);
          setIsLoadingMore(false);
        }
      }
    },
    [debouncedSearch, statusFilter, categoryFilter, priorityFilter, showArchived]
  );

  // Status tiles count every ticket, independent of the list filters.
  const loadStats = useCallback(async () => {
    const count = async (
      build: (
        q: ReturnType<ReturnType<typeof supabase.from>['select']>
      ) => PromiseLike<{ count: number | null; error: unknown }>
    ) => {
      const { count: n, error } = await build(
        supabase.from('support_tickets').select('id', { count: 'exact', head: true })
      );
      if (error) throw error;
      return n ?? 0;
    };
    try {
      const [open, inProgress, waitingForUser, waitingForAgent, archived, unresponded] =
        await Promise.all([
          count((q) => q.eq('status', 'open')),
          count((q) => q.eq('status', 'in_progress')),
          count((q) => q.eq('status', 'waiting_for_user')),
          count((q) => q.eq('status', 'waiting_for_agent')),
          count((q) => q.in('status', ['closed', 'resolved'])),
          count((q) => q.is('first_response_at', null).neq('status', 'closed')),
        ]);
      setStats({ open, inProgress, waitingForUser, waitingForAgent, archived, unresponded });
    } catch (error) {
      logger.error('Failed to load ticket counts:', error);
    }
  }, []);

  const refresh = useCallback(() => {
    void loadTickets(0);
    void loadStats();
  }, [loadTickets, loadStats]);

  useEffect(() => {
    void loadTickets(0);
  }, [loadTickets]);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  // Realtime handlers are registered once; read the latest refresh via a ref.
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  useEffect(() => {
    const handleNewTicket = () => {
      // A new ticket may or may not match the current filters; reload page 1.
      refreshRef.current();
    };
    const handleTicketUpdate = (payload: RealtimePayload) => {
      const ticket = payload.new as unknown as SupportTicket;
      setTickets((prev) => prev.map((t) => (t.id === ticket.id ? ticket : t)));
      void loadStats();
    };

    const subscription = supabase
      .channel('support-tickets')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'support_tickets',
        },
        handleNewTicket
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'support_tickets',
        },
        handleTicketUpdate
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [loadStats]);

  const hasMore = tickets.length < totalCount;

  const getPriorityBadge = (priority: number) => {
    const config = {
      4: { label: 'Urgent', color: 'bg-red-500/10 text-red-500 border-red-500/20' },
      3: { label: 'High', color: 'bg-orange-500/10 text-orange-500 border-orange-500/20' },
      2: { label: 'Normal', color: 'bg-blue-500/10 text-blue-500 border-blue-500/20' },
      1: { label: 'Low', color: 'bg-gray-500/10 text-gray-500 border-gray-500/20' },
    };
    const { label, color } = config[priority as keyof typeof config] || config[2];
    return (
      <Badge variant="outline" className={`text-xs ${color}`}>
        {label}
      </Badge>
    );
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'open':
        return <Inbox className="h-4 w-4 text-blue-500" />;
      case 'in_progress':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'waiting_for_user':
        return <User className="h-4 w-4 text-purple-500" />;
      case 'waiting_for_agent':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'resolved':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'closed':
        return <XCircle className="h-4 w-4 text-gray-500" />;
      default:
        return <MessageSquare className="h-4 w-4" />;
    }
  };

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      bug: 'Bug Report',
      feature_request: 'Feature Request',
      question: 'Question',
      billing: 'Billing',
      spam: 'Spam',
      other: 'Other',
    };
    return labels[category] || category;
  };

  const getSentimentIcon = (score: number | null) => {
    if (score === null) return null;

    if (score < -0.3) {
      return <AlertCircle className="h-3 w-3 text-red-500" />;
    } else if (score > 0.3) {
      return <CheckCircle2 className="h-3 w-3 text-green-500" />;
    }
    return null;
  };

  const toggleTicketSelection = (ticketId: string) => {
    const newSelected = new Set(selectedTickets);
    if (newSelected.has(ticketId)) {
      newSelected.delete(ticketId);
    } else {
      newSelected.add(ticketId);
    }
    setSelectedTickets(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedTickets.size === tickets.length) {
      setSelectedTickets(new Set());
    } else {
      setSelectedTickets(new Set(tickets.map((t) => t.id)));
    }
  };

  const bulkUpdateStatus = async (status: string) => {
    if (selectedTickets.size === 0) return;

    setIsProcessing(true);
    try {
      const { error } = await supabase
        .from('support_tickets')
        .update({ status, last_activity_at: new Date().toISOString() })
        .in('id', Array.from(selectedTickets));

      if (error) throw error;

      toast({
        title: 'Tickets Updated',
        description: `${selectedTickets.size} ticket(s) marked as ${status}`,
      });

      setSelectedTickets(new Set());
      refresh();
    } catch (error) {
      logger.error('Bulk update failed:', error);
      toast({
        title: 'Update Failed',
        description: 'Could not update tickets',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const bulkDelete = async () => {
    if (selectedTickets.size === 0) return;

    const count = selectedTickets.size;
    const ok = await confirm({
      title: count === 1 ? 'Delete 1 ticket?' : `Delete ${count} tickets?`,
      description: 'The selected tickets are deleted permanently. This cannot be undone.',
      confirmLabel: count === 1 ? 'Delete ticket' : `Delete ${count} tickets`,
      destructive: true,
    });
    if (!ok) return;

    setIsProcessing(true);
    try {
      const { error } = await supabase
        .from('support_tickets')
        .delete()
        .in('id', Array.from(selectedTickets));

      if (error) throw error;

      toast({
        title: 'Tickets Deleted',
        description: `${selectedTickets.size} ticket(s) permanently deleted`,
      });

      setSelectedTickets(new Set());
      refresh();
    } catch (error) {
      logger.error('Bulk delete failed:', error);
      toast({
        title: 'Delete Failed',
        description: 'Could not delete tickets',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const hasSelection = selectedTickets.size > 0;
  const isAllSelected = selectedTickets.size === tickets.length && tickets.length > 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Inbox className="h-5 w-5" />
              Support Tickets
              {hasSelection && (
                <Badge variant="secondary" className="ml-2">
                  {selectedTickets.size} selected
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              {showArchived
                ? 'Viewing all tickets including archived'
                : 'Manage active customer support requests'}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {stats.unresponded > 0 && (
              <Badge variant="destructive">{stats.unresponded} needs response</Badge>
            )}
            <div className="flex items-center gap-2 border rounded-md px-3 py-2">
              <Archive className="h-4 w-4 text-muted-foreground" />
              <Label htmlFor="show-archived" className="text-sm cursor-pointer">
                Show Archived
              </Label>
              <Switch id="show-archived" checked={showArchived} onCheckedChange={setShowArchived} />
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Bulk Actions Toolbar */}
        {hasSelection && (
          <div className="mb-4 p-3 bg-primary/5 border border-primary/20 rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCheck className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">{selectedTickets.size} ticket(s) selected</span>
            </div>
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" disabled={isProcessing}>
                    <Filter className="h-4 w-4 mr-2" />
                    Change Status
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => bulkUpdateStatus('in_progress')}>
                    <Clock className="h-4 w-4 mr-2" />
                    Mark as In Progress
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => bulkUpdateStatus('waiting_for_user')}>
                    <User className="h-4 w-4 mr-2" />
                    Waiting for User
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => bulkUpdateStatus('waiting_for_agent')}>
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Waiting for Agent
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => bulkUpdateStatus('resolved')}>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Mark as Done/Resolved
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => bulkUpdateStatus('closed')}>
                    <XCircle className="h-4 w-4 mr-2" />
                    Close Tickets
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => bulkUpdateStatus('disregard')}
                    className="text-gray-600"
                  >
                    <XIcon className="h-4 w-4 mr-2" />
                    Disregard
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => bulkUpdateStatus('spam')}
                    className="text-orange-600"
                  >
                    <AlertCircle className="h-4 w-4 mr-2" />
                    Mark as Spam
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button variant="destructive" size="sm" onClick={bulkDelete} disabled={isProcessing}>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setSelectedTickets(new Set())}>
                <XIcon className="h-4 w-4 mr-2" />
                Clear
              </Button>
            </div>
          </div>
        )}

        {/* Stats Bar */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-4">
          <button
            type="button"
            aria-label="Show open tickets"
            className="p-2 rounded border text-center hover:bg-muted/50 cursor-pointer transition-colors"
            onClick={() => setStatusFilter('open')}
          >
            <p className="text-xl font-bold text-blue-600">{stats.open}</p>
            <p className="text-xs text-muted-foreground">Open</p>
          </button>
          <button
            type="button"
            aria-label="Show tickets in progress"
            className="p-2 rounded border text-center hover:bg-muted/50 cursor-pointer transition-colors"
            onClick={() => setStatusFilter('in_progress')}
          >
            <p className="text-xl font-bold text-yellow-600">{stats.inProgress}</p>
            <p className="text-xs text-muted-foreground">In Progress</p>
          </button>
          <button
            type="button"
            aria-label="Show tickets waiting on the user"
            className="p-2 rounded border text-center hover:bg-muted/50 cursor-pointer transition-colors"
            onClick={() => setStatusFilter('waiting_for_user')}
          >
            <p className="text-xl font-bold text-purple-600">{stats.waitingForUser}</p>
            <p className="text-xs text-muted-foreground">Waiting</p>
          </button>
          <button
            type="button"
            aria-label="Show all active tickets"
            className="p-2 rounded border text-center hover:bg-muted/50 cursor-pointer transition-colors"
            onClick={() => setStatusFilter('active')}
          >
            <p className="text-xl font-bold text-green-600">
              {stats.open + stats.inProgress + stats.waitingForUser + stats.waitingForAgent}
            </p>
            <p className="text-xs text-muted-foreground">Active</p>
          </button>
          <button
            type="button"
            aria-label="Toggle archived tickets"
            className="p-2 rounded border text-center hover:bg-muted/50 cursor-pointer transition-colors"
            onClick={() => setShowArchived(!showArchived)}
          >
            <p className="text-xl font-bold text-gray-600">{stats.archived}</p>
            <p className="text-xs text-muted-foreground">Archived</p>
          </button>
        </div>

        {/* Filters */}
        <div className="space-y-3 mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search tickets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">🟢 Active Tickets</SelectItem>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="open">📬 Open</SelectItem>
                <SelectItem value="in_progress">⏳ In Progress</SelectItem>
                <SelectItem value="waiting_for_user">👤 Waiting for User</SelectItem>
                <SelectItem value="waiting_for_agent">🔔 Waiting for Agent</SelectItem>
                <SelectItem value="resolved">✅ Resolved</SelectItem>
                <SelectItem value="closed">🔒 Closed</SelectItem>
              </SelectContent>
            </Select>

            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="bug">Bug</SelectItem>
                <SelectItem value="feature_request">Feature</SelectItem>
                <SelectItem value="question">Question</SelectItem>
                <SelectItem value="billing">Billing</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>

            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priorities</SelectItem>
                <SelectItem value="4">Urgent</SelectItem>
                <SelectItem value="3">High</SelectItem>
                <SelectItem value="2">Normal</SelectItem>
                <SelectItem value="1">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Ticket List */}
        {loadError && !isLoading && (
          <div
            role="alert"
            className="mb-4 flex items-center justify-between gap-2 rounded-lg border border-destructive/40 p-3 text-sm"
          >
            <span>Tickets could not be loaded.</span>
            <Button variant="outline" size="sm" onClick={() => loadTickets(0)}>
              Retry
            </Button>
          </div>
        )}

        {isLoading ? (
          <LoadingSpinner className="py-8" />
        ) : tickets.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Inbox className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No tickets found</p>
            {!showArchived && (
              <p className="text-xs mt-2">Try enabling "Show Archived" to see all tickets</p>
            )}
          </div>
        ) : (
          <>
            {/* Select All */}
            {tickets.length > 0 && (
              <div className="flex items-center gap-2 p-2 mb-2 border-b">
                <Checkbox
                  id="select-all"
                  checked={isAllSelected}
                  onCheckedChange={toggleSelectAll}
                />
                <Label htmlFor="select-all" className="text-sm cursor-pointer">
                  Select all {tickets.length} loaded
                </Label>
                <span className="ml-auto text-xs text-muted-foreground" aria-live="polite">
                  {totalCount === 1
                    ? '1 ticket'
                    : `Showing ${tickets.length} of ${totalCount} tickets`}
                </span>
              </div>
            )}

            <ScrollArea className="h-[500px]">
              <div className="space-y-2">
                {tickets.map((ticket) => (
                  <div
                    key={ticket.id}
                    className={`p-3 rounded-lg border transition-colors ${
                      selectedTicketId === ticket.id
                        ? 'bg-muted border-primary'
                        : 'bg-card hover:bg-muted/50'
                    } ${selectedTickets.has(ticket.id) ? 'ring-2 ring-primary/50' : ''}`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Checkbox */}
                      <Checkbox
                        checked={selectedTickets.has(ticket.id)}
                        onCheckedChange={() => toggleTicketSelection(ticket.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="mt-1"
                      />

                      {/* Ticket Content */}
                      <button
                        type="button"
                        className="flex-1 cursor-pointer text-left"
                        onClick={() => onSelectTicket(ticket)}
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            {getStatusIcon(ticket.status)}
                            <span className="font-mono text-xs text-muted-foreground">
                              {ticket.ticket_number}
                            </span>
                            {getPriorityBadge(ticket.priority)}
                            {getSentimentIcon(ticket.ai_sentiment_score)}
                          </div>
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {formatDistanceToNow(new Date(ticket.last_activity_at), {
                              addSuffix: true,
                            })}
                          </span>
                        </div>

                        <h4 className="font-medium text-sm mb-1 truncate">{ticket.subject}</h4>

                        <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                          <span>{ticket.user_name || ticket.user_email}</span>
                          <span>•</span>
                          <span>{getCategoryLabel(ticket.category)}</span>
                          {!ticket.first_response_at &&
                            ticket.status !== 'closed' &&
                            ticket.status !== 'resolved' && (
                              <>
                                <span>•</span>
                                <Badge
                                  variant="outline"
                                  className="bg-red-500/10 text-red-500 border-red-500/20 text-xs"
                                >
                                  No response
                                </Badge>
                              </>
                            )}
                          {(ticket.status === 'resolved' || ticket.status === 'closed') && (
                            <>
                              <span>•</span>
                              <Badge
                                variant="outline"
                                className="bg-gray-500/10 text-gray-500 border-gray-500/20 text-xs"
                              >
                                <Archive className="h-3 w-3 mr-1" />
                                Archived
                              </Badge>
                            </>
                          )}
                        </div>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              {hasMore && (
                <div className="flex justify-center py-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => loadTickets(page + 1)}
                    disabled={isLoadingMore}
                  >
                    {isLoadingMore
                      ? 'Loading...'
                      : `Load ${Math.min(TICKET_PAGE_SIZE, totalCount - tickets.length)} more`}
                  </Button>
                </div>
              )}
            </ScrollArea>
          </>
        )}
      </CardContent>
    </Card>
  );
};
