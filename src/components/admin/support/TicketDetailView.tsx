import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
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
  Lightbulb,
  Mail,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { invokeEdgeFunction } from '@/lib/edge-functions';

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
  assigned_to: string | null;
  user_agent: string | null;
  referrer_url: string | null;
  page_url: string | null;
  ai_suggested_responses: any;
  created_at: string;
  mailbox_id: string | null;
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
  const [emailSubject, setEmailSubject] = useState(`Re: ${ticket.subject}`);
  const [sendAsEmail, setSendAsEmail] = useState(true);
  const [isInternal, setIsInternal] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [newStatus, setNewStatus] = useState(ticket.status);
  const [newCategory, setNewCategory] = useState(ticket.category);
  const [mailboxes, setMailboxes] = useState<any[]>([]);
  const [selectedMailbox, setSelectedMailbox] = useState<string>('');
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [aiGeneratedResponse, setAiGeneratedResponse] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    // Sync local status with ticket prop when ticket changes
    setNewStatus(ticket.status);
    setNewCategory(ticket.category);
    
    loadResponses();
    loadMailboxes();
    loadLatestEmailSubject();

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
  }, [ticket.id, ticket.status, ticket.category]);

  const loadMailboxes = async () => {
    try {
      const { data, error } = await supabase
        .from('email_mailboxes' as any)
        .select('*')
        .eq('is_active', true)
        .order('is_default', { ascending: false });

      if (error) throw error;

      setMailboxes(data || []);

      // Auto-select mailbox based on ticket's mailbox_id or first available
      if (data && data.length > 0) {
        if (ticket.mailbox_id) {
          const ticketMailbox = data.find(m => m.id === ticket.mailbox_id);
          if (ticketMailbox) {
            setSelectedMailbox(ticketMailbox.id);
          } else {
            setSelectedMailbox(data[0].id);
          }
        } else {
          setSelectedMailbox(data[0].id);
        }
      }
    } catch (error) {
      logger.error('Failed to load mailboxes:', error);
    }
  };

  const loadLatestEmailSubject = async () => {
    try {
      // Get the most recent email thread for this ticket
      const { data, error } = await supabase
        .from('email_threads' as any)
        .select('subject')
        .eq('ticket_id', ticket.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        throw error;
      }

      // Use the most recent email subject if available, otherwise use ticket subject
      if (data?.subject) {
        // If subject already starts with "Re:", don't add another one
        const subject = data.subject.startsWith('Re:') ? data.subject : `Re: ${data.subject}`;
        setEmailSubject(subject);
      } else {
        setEmailSubject(`Re: ${ticket.subject}`);
      }
    } catch (error) {
      logger.error('Failed to load email subject:', error);
      // Fallback to ticket subject
      setEmailSubject(`Re: ${ticket.subject}`);
    }
  };

  const getSmtpWarning = (): string | null => {
    if (!selectedMailbox) return null;
    const mailbox = mailboxes.find(m => m.id === selectedMailbox);
    if (!mailbox) return null;

    const hasMailboxConfig = mailbox.smtp_host && mailbox.smtp_username && mailbox.smtp_password;
    const hasEnvVars = true; // Assume env vars are set (we can't check from client)

    if (!hasMailboxConfig && !hasEnvVars) {
      return `⚠️ SMTP not configured for ${mailbox.email_address}. Configure in Mailboxes tab.`;
    }

    if (!hasMailboxConfig) {
      return `ℹ️ Using default SMTP settings. Configure ${mailbox.email_address} in Mailboxes tab for custom settings.`;
    }

    return null;
  };

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

    if (sendAsEmail && !selectedMailbox) {
      toast({
        title: 'No Mailbox Selected',
        description: 'Please select a mailbox to send email from.',
        variant: 'destructive'
      });
      return;
    }

    setIsSending(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (sendAsEmail && !isInternal) {
        // Send via email using Edge Function
        const { error } = await invokeEdgeFunction('send-ticket-email', {
          body: {
            ticket_id: ticket.id,
            from_mailbox_id: selectedMailbox,
            to_email: ticket.user_email,
            subject: emailSubject,
            message: replyMessage,
            is_internal: false,
          }
        });

        if (error) {
          logger.error('Email send error:', error);
          throw new Error(error.message || 'Failed to send email');
        }

        toast({
          title: 'Email Sent',
          description: `Email sent successfully to ${ticket.user_email}`,
        });
      } else {
        // Save as internal note or response without email
        const { error } = await supabase
          .from('ticket_responses' as any)
          .insert({
            ticket_id: ticket.id,
            author_id: user?.id,
            author_email: user?.email || 'admin',
            author_name: user?.email?.split('@')[0] || 'Admin',
            author_type: 'agent',
            message: replyMessage,
            is_internal: isInternal,
          });

        if (error) throw error;

        // Update ticket status if first response
        if (!responses.length && !isInternal) {
          await supabase
            .from('support_tickets' as any)
            .update({ first_response_at: new Date().toISOString() })
            .eq('id', ticket.id);
        }

        toast({
          title: isInternal ? 'Internal Note Added' : 'Reply Saved',
          description: isInternal ? 'Note visible to agents only' : 'Response saved successfully',
        });
      }

      setReplyMessage('');
      onUpdate();
    } catch (error: any) {
      logger.error('Failed to send reply:', error);
      toast({
        title: 'Failed to Send',
        description: error.message || 'Could not send the reply. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setIsSending(false);
    }
  };

  const generateAIResponse = async () => {
    setIsGeneratingAI(true);
    setAiGeneratedResponse(null);
    
    try {
      const { data, error } = await invokeEdgeFunction('generate-ticket-response', {
        body: { ticket_id: ticket.id }
      });

      if (error) throw error;

      if (data?.response) {
        setAiGeneratedResponse(data.response);
        setReplyMessage(data.response);
        toast({
          title: 'AI Response Generated',
          description: `Using ${data.model_used}. Review and edit before sending.`,
        });
      }
    } catch (error: any) {
      logger.error('Failed to generate AI response:', error);
      toast({
        title: 'Generation Failed',
        description: error.message || 'Could not generate AI response. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setIsGeneratingAI(false);
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
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div>
              <label className="text-xs text-muted-foreground">Status</label>
              <Select value={newStatus} onValueChange={(v) => { setNewStatus(v); updateTicket({ status: v }); }}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">📬 Open</SelectItem>
                  <SelectItem value="in_progress">⏳ In Progress</SelectItem>
                  <SelectItem value="waiting_for_user">👤 Waiting for User</SelectItem>
                  <SelectItem value="waiting_for_agent">🔔 Waiting for Agent</SelectItem>
                  <SelectItem value="resolved">✅ Done/Resolved</SelectItem>
                  <SelectItem value="closed">🔒 Closed</SelectItem>
                  <SelectItem value="disregard">🚫 Disregard</SelectItem>
                  <SelectItem value="spam">⚠️ Spam</SelectItem>
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
                  <SelectItem value="bug">🐛 Bug</SelectItem>
                  <SelectItem value="feature_request">✨ Feature Request</SelectItem>
                  <SelectItem value="question">❓ Question</SelectItem>
                  <SelectItem value="billing">💳 Billing</SelectItem>
                  <SelectItem value="other">📋 Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs text-muted-foreground">Assign To</label>
              <Select
                value={ticket.assigned_to || 'unassigned'}
                onValueChange={(v) => updateTicket({ assigned_to: v === 'unassigned' ? null : v })}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  <SelectItem value="self">Assign to Me</SelectItem>
                  {/* Future: Load team members from database */}
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
            <Card 
              key={response.id} 
              className={
                response.is_internal 
                  ? 'border-yellow-500/50 bg-yellow-500/5' 
                  : response.author_type === 'agent' || response.author_type === 'admin'
                  ? 'border-l-4 border-l-blue-500 bg-blue-500/5'
                  : 'border-l-4 border-l-primary'
              }
            >
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                    response.author_type === 'agent' || response.author_type === 'admin' 
                      ? 'bg-blue-500/10' 
                      : 'bg-primary/10'
                  }`}>
                    {response.author_type === 'agent' || response.author_type === 'admin' ? (
                      <span className="text-xs font-bold text-blue-500">A</span>
                    ) : (
                      <User className="h-4 w-4" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-medium text-sm">{response.author_name}</span>
                      <Badge variant="secondary" className="text-xs">
                        {response.author_type === 'agent' || response.author_type === 'admin' ? 'Agent' : 'Customer'}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(response.created_at), 'MMM d, yyyy h:mm a')}
                      </span>
                      {response.is_internal && (
                        <Badge variant="outline" className="text-xs bg-yellow-500/10 text-yellow-500 border-yellow-500">
                          Internal Note
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm whitespace-pre-wrap mt-2">{response.message}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Reply Box */}
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-3">
                {/* Email Options */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-4 p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <Switch
                          id="send-email"
                          checked={sendAsEmail}
                          onCheckedChange={setSendAsEmail}
                        />
                        <Label htmlFor="send-email" className="text-sm font-medium cursor-pointer flex items-center gap-2">
                          <Mail className="h-4 w-4" />
                          Send as Email
                        </Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          id="internal-note"
                          checked={isInternal}
                          onCheckedChange={setIsInternal}
                          disabled={sendAsEmail}
                        />
                        <Label htmlFor="internal-note" className="text-sm font-medium cursor-pointer flex items-center gap-2">
                          <AlertCircle className="h-4 w-4" />
                          Internal Note
                        </Label>
                      </div>
                    </div>
                    {sendAsEmail && mailboxes.length > 0 && (
                      <Select value={selectedMailbox} onValueChange={setSelectedMailbox}>
                        <SelectTrigger className="w-[200px]">
                          <SelectValue placeholder="Select mailbox" />
                        </SelectTrigger>
                        <SelectContent>
                          {mailboxes.map((mailbox) => (
                            <SelectItem key={mailbox.id} value={mailbox.id}>
                              {mailbox.email_address}
                              {!mailbox.smtp_host && ' ⚙️'}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>

                  {/* SMTP Configuration Warning */}
                  {sendAsEmail && getSmtpWarning() && (
                    <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                      <p className="text-xs text-yellow-800 dark:text-yellow-200">
                        {getSmtpWarning()}
                      </p>
                    </div>
                  )}

                  {/* No Mailbox Warning */}
                  {sendAsEmail && mailboxes.length === 0 && (
                    <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                      <p className="text-xs text-red-800 dark:text-red-200">
                        ⚠️ No mailboxes configured. Please add a mailbox in the Mailboxes tab to send emails.
                      </p>
                    </div>
                  )}
                </div>

                {/* Email Subject (only show when sending as email) */}
                {sendAsEmail && !isInternal && (
                  <div>
                    <Label htmlFor="email-subject" className="text-sm">Subject</Label>
                    <Input
                      id="email-subject"
                      value={emailSubject}
                      onChange={(e) => setEmailSubject(e.target.value)}
                      placeholder="Email subject"
                      className="mt-1"
                    />
                  </div>
                )}

                {/* Message */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Message</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={generateAIResponse}
                      disabled={isGeneratingAI}
                    >
                      {isGeneratingAI ? (
                        <>
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Lightbulb className="h-3 w-3 mr-1" />
                          Generate AI Response
                        </>
                      )}
                    </Button>
                  </div>
                  {aiGeneratedResponse && (
                    <div className="text-xs text-muted-foreground p-2 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-800">
                      ✨ AI-generated response loaded. Review carefully before sending.
                    </div>
                  )}
                  <Textarea
                    placeholder={
                      isInternal
                        ? "Add an internal note (not sent to customer)..."
                        : sendAsEmail
                          ? "Compose your email reply..."
                          : "Type your response..."
                    }
                    value={replyMessage}
                    onChange={(e) => setReplyMessage(e.target.value)}
                    rows={6}
                  />
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between">
                  <div className="text-xs text-muted-foreground">
                    {sendAsEmail && !isInternal ? (
                      <span className="flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        Will send email to: <strong>{ticket.user_email}</strong>
                      </span>
                    ) : isInternal ? (
                      <span className="flex items-center gap-1 text-yellow-600">
                        <AlertCircle className="h-3 w-3" />
                        Internal note - visible to agents only
                      </span>
                    ) : (
                      "Tip: Toggle 'Send as Email' to notify the customer"
                    )}
                  </div>
                  <Button onClick={sendReply} disabled={isSending || !replyMessage.trim()}>
                    {isSending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        {sendAsEmail && !isInternal ? (
                          <><Mail className="h-4 w-4 mr-2" />Send Email</>
                        ) : (
                          <><Send className="h-4 w-4 mr-2" />Save {isInternal ? 'Note' : 'Reply'}</>
                        )}
                      </>
                    )}
                  </Button>
                </div>
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
