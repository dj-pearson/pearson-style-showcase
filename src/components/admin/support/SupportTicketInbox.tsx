import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
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
  User
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
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
  const [statusFilter, setStatusFilter] = useState<string>('open');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');

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
  }, [tickets, searchQuery, statusFilter, categoryFilter, priorityFilter]);

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

    // Status filter
    if (statusFilter !== 'all') {
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

    // Search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(t =>
        t.ticket_number.toLowerCase().includes(query) ||
        t.subject.toLowerCase().includes(query) ||
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

  const stats = {
    total: tickets.length,
    open: tickets.filter(t => t.status === 'open').length,
    inProgress: tickets.filter(t => t.status === 'in_progress').length,
    waitingForUser: tickets.filter(t => t.status === 'waiting_for_user').length,
    unresponded: tickets.filter(t => !t.first_response_at && t.status !== 'closed').length
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Inbox className="h-5 w-5" />
              Support Tickets
            </CardTitle>
            <CardDescription>Manage customer support requests</CardDescription>
          </div>
          {stats.unresponded > 0 && (
            <Badge variant="destructive">
              {stats.unresponded} needs response
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {/* Stats Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
          <div className="p-2 rounded border text-center">
            <p className="text-xl font-bold">{stats.open}</p>
            <p className="text-xs text-muted-foreground">Open</p>
          </div>
          <div className="p-2 rounded border text-center">
            <p className="text-xl font-bold">{stats.inProgress}</p>
            <p className="text-xs text-muted-foreground">In Progress</p>
          </div>
          <div className="p-2 rounded border text-center">
            <p className="text-xl font-bold">{stats.waitingForUser}</p>
            <p className="text-xs text-muted-foreground">Waiting</p>
          </div>
          <div className="p-2 rounded border text-center">
            <p className="text-xl font-bold">{stats.total}</p>
            <p className="text-xs text-muted-foreground">Total</p>
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
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="waiting_for_user">Waiting</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
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
          </div>
        ) : (
          <ScrollArea className="h-[500px]">
            <div className="space-y-2">
              {filteredTickets.map((ticket) => (
                <div
                  key={ticket.id}
                  onClick={() => onSelectTicket(ticket)}
                  className={`p-3 rounded-lg border cursor-pointer transition-colors hover:bg-muted/50 ${
                    selectedTicketId === ticket.id ? 'bg-muted border-primary' : 'bg-card'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
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

                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{ticket.user_name || ticket.user_email}</span>
                    <span>•</span>
                    <span>{getCategoryLabel(ticket.category)}</span>
                    {!ticket.first_response_at && (
                      <>
                        <span>•</span>
                        <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20 text-xs">
                          No response
                        </Badge>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
};
