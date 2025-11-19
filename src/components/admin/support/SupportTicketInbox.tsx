import React, { useEffect, useState } from 'react';
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
  Filter
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';

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
  selectedTicketId
}) => {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [filteredTickets, setFilteredTickets] = useState<SupportTicket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('active');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [showArchived, setShowArchived] = useState(false);
  const [selectedTickets, setSelectedTickets] = useState<Set<string>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadTickets();

    // Subscribe to new tickets
    const subscription = supabase
      .channel('support-tickets')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'support_tickets'
      }, handleNewTicket)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'support_tickets'
      }, handleTicketUpdate)
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    filterTickets();
  }, [tickets, searchQuery, statusFilter, categoryFilter, priorityFilter, showArchived]);

  const loadTickets = async () => {
    try {
      const { data, error } = await supabase
        .from('support_tickets' as any)
        .select('*')
        .order('last_activity_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      setTickets((data || []) as SupportTicket[]);
      setIsLoading(false);
    } catch (error) {
      logger.error('Failed to load tickets:', error);
      setIsLoading(false);
    }
  };

  const handleNewTicket = (payload: any) => {
    setTickets(prev => [payload.new, ...prev]);
  };

  const handleTicketUpdate = (payload: any) => {
    setTickets(prev => prev.map(t => t.id === payload.new.id ? payload.new : t));
  };

  const filterTickets = () => {
    let filtered = [...tickets];

    // Archive filter - hide closed/resolved tickets by default
    if (!showArchived) {
      filtered = filtered.filter(t => t.status !== 'closed' && t.status !== 'resolved');
    }

    // Status filter with "active" preset
    if (statusFilter === 'active') {
      filtered = filtered.filter(t =>
        t.status === 'open' || t.status === 'in_progress' || t.status === 'waiting_for_user'
      );
    } else if (statusFilter !== 'all') {
      filtered = filtered.filter(t => t.status === statusFilter);
    }

    // Category filter
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(t => t.category === categoryFilter);
    }

    // Priority filter
    if (priorityFilter !== 'all') {
      filtered = filtered.filter(t => t.priority === parseInt(priorityFilter));
    }

    // Enhanced search query - search across ticket number, subject, message, email, and name
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(t =>
        t.ticket_number.toLowerCase().includes(query) ||
        t.subject.toLowerCase().includes(query) ||
        t.message.toLowerCase().includes(query) ||
        t.user_email.toLowerCase().includes(query) ||
        t.user_name.toLowerCase().includes(query)
      );
    }

    setFilteredTickets(filtered);
  };

  const getPriorityBadge = (priority: number) => {
    const config = {
      4: { label: 'Urgent', color: 'bg-red-500/10 text-red-500 border-red-500/20' },
      3: { label: 'High', color: 'bg-orange-500/10 text-orange-500 border-orange-500/20' },
      2: { label: 'Normal', color: 'bg-blue-500/10 text-blue-500 border-blue-500/20' },
      1: { label: 'Low', color: 'bg-gray-500/10 text-gray-500 border-gray-500/20' }
    };
    const { label, color } = config[priority as keyof typeof config] || config[2];
    return <Badge variant="outline" className={`text-xs ${color}`}>{label}</Badge>;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'open':
        return <Inbox className="h-4 w-4 text-blue-500" />;
      case 'in_progress':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'waiting_for_user':
        return <User className="h-4 w-4 text-purple-500" />;
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
      other: 'Other'
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
    if (selectedTickets.size === filteredTickets.length) {
      setSelectedTickets(new Set());
    } else {
      setSelectedTickets(new Set(filteredTickets.map(t => t.id)));
    }
  };

  const bulkUpdateStatus = async (status: string) => {
    if (selectedTickets.size === 0) return;

    setIsProcessing(true);
    try {
      const { error } = await supabase
        .from('support_tickets' as any)
        .update({ status, last_activity_at: new Date().toISOString() })
        .in('id', Array.from(selectedTickets));

      if (error) throw error;

      toast({
        title: 'Tickets Updated',
        description: `${selectedTickets.size} ticket(s) marked as ${status}`,
      });

      setSelectedTickets(new Set());
      await loadTickets();
    } catch (error) {
      logger.error('Bulk update failed:', error);
      toast({
        title: 'Update Failed',
        description: 'Could not update tickets',
        variant: 'destructive'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const bulkDelete = async () => {
    if (selectedTickets.size === 0) return;

    if (!confirm(`Are you sure you want to delete ${selectedTickets.size} ticket(s)? This action cannot be undone.`)) {
      return;
    }

    setIsProcessing(true);
    try {
      const { error } = await supabase
        .from('support_tickets' as any)
        .delete()
        .in('id', Array.from(selectedTickets));

      if (error) throw error;

      toast({
        title: 'Tickets Deleted',
        description: `${selectedTickets.size} ticket(s) permanently deleted`,
      });

      setSelectedTickets(new Set());
      await loadTickets();
    } catch (error) {
      logger.error('Bulk delete failed:', error);
      toast({
        title: 'Delete Failed',
        description: 'Could not delete tickets',
        variant: 'destructive'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const stats = {
    total: tickets.length,
    open: tickets.filter(t => t.status === 'open').length,
    inProgress: tickets.filter(t => t.status === 'in_progress').length,
    waitingForUser: tickets.filter(t => t.status === 'waiting_for_user').length,
    unresponded: tickets.filter(t => !t.first_response_at && t.status !== 'closed').length,
    archived: tickets.filter(t => t.status === 'closed' || t.status === 'resolved').length
  };

  const hasSelection = selectedTickets.size > 0;
  const isAllSelected = selectedTickets.size === filteredTickets.length && filteredTickets.length > 0;

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
              {showArchived ? 'Viewing all tickets including archived' : 'Manage active customer support requests'}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {stats.unresponded > 0 && (
              <Badge variant="destructive">
                {stats.unresponded} needs response
              </Badge>
            )}
            <div className="flex items-center gap-2 border rounded-md px-3 py-2">
              <Archive className="h-4 w-4 text-muted-foreground" />
              <Label htmlFor="show-archived" className="text-sm cursor-pointer">
                Show Archived
              </Label>
              <Switch
                id="show-archived"
                checked={showArchived}
                onCheckedChange={setShowArchived}
              />
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
                  <DropdownMenuItem onClick={() => bulkUpdateStatus('disregard')} className="text-gray-600">
                    <XIcon className="h-4 w-4 mr-2" />
                    Disregard
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => bulkUpdateStatus('spam')} className="text-orange-600">
                    <AlertCircle className="h-4 w-4 mr-2" />
                    Mark as Spam
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                variant="destructive"
                size="sm"
                onClick={bulkDelete}
                disabled={isProcessing}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedTickets(new Set())}
              >
                <XIcon className="h-4 w-4 mr-2" />
                Clear
              </Button>
            </div>
          </div>
        )}

        {/* Stats Bar */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-4">
          <div className="p-2 rounded border text-center hover:bg-muted/50 cursor-pointer transition-colors" onClick={() => setStatusFilter('open')}>
            <p className="text-xl font-bold text-blue-600">{stats.open}</p>
            <p className="text-xs text-muted-foreground">Open</p>
          </div>
          <div className="p-2 rounded border text-center hover:bg-muted/50 cursor-pointer transition-colors" onClick={() => setStatusFilter('in_progress')}>
            <p className="text-xl font-bold text-yellow-600">{stats.inProgress}</p>
            <p className="text-xs text-muted-foreground">In Progress</p>
          </div>
          <div className="p-2 rounded border text-center hover:bg-muted/50 cursor-pointer transition-colors" onClick={() => setStatusFilter('waiting_for_user')}>
            <p className="text-xl font-bold text-purple-600">{stats.waitingForUser}</p>
            <p className="text-xs text-muted-foreground">Waiting</p>
          </div>
          <div className="p-2 rounded border text-center hover:bg-muted/50 cursor-pointer transition-colors" onClick={() => setStatusFilter('active')}>
            <p className="text-xl font-bold text-green-600">{stats.open + stats.inProgress + stats.waitingForUser}</p>
            <p className="text-xs text-muted-foreground">Active</p>
          </div>
          <div className="p-2 rounded border text-center hover:bg-muted/50 cursor-pointer transition-colors" onClick={() => setShowArchived(!showArchived)}>
            <p className="text-xl font-bold text-gray-600">{stats.archived}</p>
            <p className="text-xs text-muted-foreground">Archived</p>
          </div>
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
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : filteredTickets.length === 0 ? (
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
            {filteredTickets.length > 0 && (
              <div className="flex items-center gap-2 p-2 mb-2 border-b">
                <Checkbox
                  id="select-all"
                  checked={isAllSelected}
                  onCheckedChange={toggleSelectAll}
                />
                <Label htmlFor="select-all" className="text-sm cursor-pointer">
                  Select all {filteredTickets.length} ticket(s)
                </Label>
              </div>
            )}

            <ScrollArea className="h-[500px]">
              <div className="space-y-2">
                {filteredTickets.map((ticket) => (
                  <div
                    key={ticket.id}
                    className={`p-3 rounded-lg border transition-colors ${
                      selectedTicketId === ticket.id ? 'bg-muted border-primary' : 'bg-card hover:bg-muted/50'
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
                      <div
                        className="flex-1 cursor-pointer"
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
                            {formatDistanceToNow(new Date(ticket.last_activity_at), { addSuffix: true })}
                          </span>
                        </div>

                        <h4 className="font-medium text-sm mb-1 truncate">{ticket.subject}</h4>

                        <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                          <span>{ticket.user_name || ticket.user_email}</span>
                          <span>•</span>
                          <span>{getCategoryLabel(ticket.category)}</span>
                          {!ticket.first_response_at && ticket.status !== 'closed' && ticket.status !== 'resolved' && (
                            <>
                              <span>•</span>
                              <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20 text-xs">
                                No response
                              </Badge>
                            </>
                          )}
                          {(ticket.status === 'resolved' || ticket.status === 'closed') && (
                            <>
                              <span>•</span>
                              <Badge variant="outline" className="bg-gray-500/10 text-gray-500 border-gray-500/20 text-xs">
                                <Archive className="h-3 w-3 mr-1" />
                                Archived
                              </Badge>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </>
        )}
      </CardContent>
    </Card>
  );
};
