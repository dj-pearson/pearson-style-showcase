import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  MessageSquare,
  Send,
  User,
  Globe,
  X,
  Lightbulb
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface Ticket {
  id: string;
  ticket_number: string;
  subject: string;
  message: string;
  user_email: string;
  user_name: string;
  category: string;
  priority: number;
  status: string;
  user_agent: string | null;
  referrer_url: string | null;
  page_url: string | null;
  ai_suggested_responses: any;
  created_at: string;
}

interface Response {
  id: string;
  author_name: string;
  author_type: string;
  message: string;
  created_at: string;
  is_internal: boolean;
}

interface TicketDetailViewProps {
  ticket: Ticket;
  onClose: () => void;
  onUpdate: () => void;
}

export const TicketDetailView: React.FC<TicketDetailViewProps> = ({ ticket, onClose, onUpdate }) => {
  const [responses, setResponses] = useState<Response[]>([]);
  const [replyMessage, setReplyMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [newStatus, setNewStatus] = useState(ticket.status);
  const [newCategory, setNewCategory] = useState(ticket.category);
  const { toast } = useToast();

  useEffect(() => {
    loadResponses();

    const subscription = supabase
      .channel(`ticket-${ticket.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'ticket_responses',
        filter: `ticket_id=eq.${ticket.id}`
      }, handleNewResponse)
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [ticket.id]);

  const loadResponses = async () => {
    try {
      const { data, error } = await supabase
        .from('ticket_responses' as any)
        .select('*')
        .eq('ticket_id', ticket.id)
        .order('created_at', { ascending: true });

      if (error) throw error;

      setResponses((data || []) as Response[]);
    } catch (error) {
      logger.error('Failed to load responses:', error);
    }
  };

  const handleNewResponse = (payload: any) => {
    setResponses(prev => [...prev, payload.new]);
  };

  const sendReply = async () => {
    if (!replyMessage.trim()) return;

    setIsSending(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase
        .from('ticket_responses' as any)
        .insert({
          ticket_id: ticket.id,
          author_id: user?.id,
          author_email: user?.email || 'admin',
          author_name: 'Admin',
          author_type: 'admin',
          message: replyMessage
        });

      if (error) throw error;

      // Update ticket status if first response
      if (!responses.length) {
        await supabase
          .from('support_tickets' as any)
          .update({ first_response_at: new Date().toISOString() })
          .eq('id', ticket.id);
      }

      setReplyMessage('');
      toast({
        title: 'Reply Sent',
        description: 'Your response has been sent to the user.',
      });
      onUpdate();
    } catch (error) {
      logger.error('Failed to send reply:', error);
      toast({
        title: 'Failed to Send',
        description: 'Could not send the reply. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setIsSending(false);
    }
  };

  const updateTicket = async (updates: Partial<Ticket>) => {
    try {
      const { error } = await supabase
        .from('support_tickets' as any)
        .update(updates)
        .eq('id', ticket.id);

      if (error) throw error;

      toast({
        title: 'Ticket Updated',
        description: 'The ticket has been updated successfully.',
      });
      onUpdate();
    } catch (error) {
      logger.error('Failed to update ticket:', error);
      toast({
        title: 'Update Failed',
        description: 'Could not update the ticket.',
        variant: 'destructive'
      });
    }
  };

  const useSuggestedResponse = (response: string) => {
    setReplyMessage(response);
  };

  return (
    <div className="space-y-4">
      {/* Ticket Header */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                {ticket.ticket_number}
              </CardTitle>
              <CardDescription className="mt-1">{ticket.subject}</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="text-xs text-muted-foreground">Status</label>
              <Select value={newStatus} onValueChange={(v) => { setNewStatus(v); updateTicket({ status: v }); }}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="waiting_for_user">Waiting for User</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs text-muted-foreground">Category</label>
              <Select value={newCategory} onValueChange={(v) => { setNewCategory(v); updateTicket({ category: v }); }}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bug">Bug</SelectItem>
                  <SelectItem value="feature_request">Feature Request</SelectItem>
                  <SelectItem value="question">Question</SelectItem>
                  <SelectItem value="billing">Billing</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs text-muted-foreground">From</label>
              <p className="text-sm font-medium mt-1">{ticket.user_name || ticket.user_email}</p>
            </div>

            <div>
              <label className="text-xs text-muted-foreground">Created</label>
              <p className="text-sm font-medium mt-1">{format(new Date(ticket.created_at), 'MMM d, yyyy')}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="conversation" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="conversation">Conversation</TabsTrigger>
          <TabsTrigger value="context">User Context</TabsTrigger>
          <TabsTrigger value="ai-assist">AI Assist</TabsTrigger>
        </TabsList>

        <TabsContent value="conversation" className="space-y-4">
          {/* Original Message */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <User className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm">{ticket.user_name || 'User'}</span>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(ticket.created_at), 'MMM d, yyyy h:mm a')}
                    </span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{ticket.message}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Responses */}
          {responses.map((response) => (
            <Card key={response.id} className={response.is_internal ? 'border-yellow-500/50 bg-yellow-500/5' : ''}>
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                    response.author_type === 'admin' ? 'bg-blue-500/10' : 'bg-primary/10'
                  }`}>
                    {response.author_type === 'admin' ? (
                      <span className="text-xs font-bold text-blue-500">A</span>
                    ) : (
                      <User className="h-4 w-4" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm">{response.author_name}</span>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(response.created_at), 'MMM d, yyyy h:mm a')}
                      </span>
                      {response.is_internal && (
                        <Badge variant="outline" className="text-xs bg-yellow-500/10 text-yellow-500">
                          Internal Note
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{response.message}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Reply Box */}
          <Card>
            <CardContent className="pt-6">
              <Textarea
                placeholder="Type your response..."
                value={replyMessage}
                onChange={(e) => setReplyMessage(e.target.value)}
                rows={4}
                className="mb-3"
              />
              <div className="flex items-center justify-between">
                <div className="text-xs text-muted-foreground">
                  Tip: Use canned responses for quick replies
                </div>
                <Button onClick={sendReply} disabled={isSending || !replyMessage.trim()}>
                  <Send className="h-4 w-4 mr-2" />
                  Send Reply
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="context">
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-semibold mb-2">Browser Information</h4>
                  <p className="text-sm text-muted-foreground font-mono">
                    {ticket.user_agent || 'No user agent information'}
                  </p>
                </div>

                {ticket.page_url && (
                  <div>
                    <h4 className="text-sm font-semibold mb-2">Page URL</h4>
                    <div className="flex items-center gap-2">
                      <Globe className="h-4 w-4 text-muted-foreground" />
                      <a
                        href={ticket.page_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary hover:underline"
                      >
                        {ticket.page_url}
                      </a>
                    </div>
                  </div>
                )}

                {ticket.referrer_url && (
                  <div>
                    <h4 className="text-sm font-semibold mb-2">Referrer</h4>
                    <p className="text-sm text-muted-foreground">{ticket.referrer_url}</p>
                  </div>
                )}

                <div>
                  <h4 className="text-sm font-semibold mb-2">Contact Information</h4>
                  <div className="space-y-1">
                    <p className="text-sm">Email: {ticket.user_email}</p>
                    {ticket.user_name && <p className="text-sm">Name: {ticket.user_name}</p>}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ai-assist">
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                    <Lightbulb className="h-4 w-4" />
                    Suggested Responses
                  </h4>
                  {ticket.ai_suggested_responses && ticket.ai_suggested_responses.length > 0 ? (
                    <div className="space-y-2">
                      {ticket.ai_suggested_responses.map((suggestion: string, index: number) => (
                        <div
                          key={index}
                          className="p-3 rounded-lg border bg-muted/50 hover:bg-muted cursor-pointer transition-colors"
                          onClick={() => useSuggestedResponse(suggestion)}
                        >
                          <p className="text-sm">{suggestion}</p>
                          <Button size="sm" variant="ghost" className="mt-2 text-xs">
                            Use This Response
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No AI suggestions available for this ticket yet.
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
