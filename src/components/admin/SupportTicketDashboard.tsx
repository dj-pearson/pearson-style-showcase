import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SupportTicketInbox } from './support/SupportTicketInbox';
import { TicketDetailView } from './support/TicketDetailView';
import { CannedResponseManager } from './support/CannedResponseManager';
import { KnowledgeBaseManager } from './support/KnowledgeBaseManager';
import { EmailWebhookSettings } from './EmailWebhookSettings';
import { EmailMailboxManager } from './EmailMailboxManager';

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

export const SupportTicketDashboard: React.FC = () => {
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleSelectTicket = (ticket: Ticket) => {
    setSelectedTicket(ticket);
  };

  const handleCloseTicket = () => {
    setSelectedTicket(null);
  };

  const handleUpdateTicket = () => {
    // Trigger a refresh of the inbox
    setRefreshKey(prev => prev + 1);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Support & Help Center</h1>
        <p className="text-muted-foreground mt-1">
          Manage customer support, quick responses, and help articles
        </p>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="tickets" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="tickets">Tickets</TabsTrigger>
          <TabsTrigger value="canned">Canned Responses</TabsTrigger>
          <TabsTrigger value="knowledge">Knowledge Base</TabsTrigger>
          <TabsTrigger value="mailboxes">Mailboxes</TabsTrigger>
          <TabsTrigger value="webhook">Webhook</TabsTrigger>
        </TabsList>

        {/* Tickets Tab */}
        <TabsContent value="tickets" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Inbox */}
          <div className={selectedTicket ? 'lg:col-span-1' : 'lg:col-span-3'}>
            <SupportTicketInbox
              key={refreshKey}
              onSelectTicket={(ticket) => handleSelectTicket(ticket as any)}
              selectedTicketId={selectedTicket?.id}
            />
          </div>

            {/* Ticket Detail */}
            {selectedTicket && (
              <div className="lg:col-span-2">
                <TicketDetailView
                  ticket={selectedTicket}
                  onClose={handleCloseTicket}
                  onUpdate={handleUpdateTicket}
                />
              </div>
            )}
          </div>

          {/* Help Text */}
          {!selectedTicket && (
            <div className="text-center text-muted-foreground p-8 border rounded-lg bg-muted/20">
              <p className="text-lg mb-2">Select a ticket to view details and respond</p>
              <p className="text-sm">
                Tickets are automatically created from contact form submissions. Use filters to find specific tickets.
              </p>
            </div>
          )}
        </TabsContent>

        {/* Canned Responses Tab */}
        <TabsContent value="canned">
          <CannedResponseManager />
        </TabsContent>

        {/* Knowledge Base Tab */}
        <TabsContent value="knowledge">
          <KnowledgeBaseManager />
        </TabsContent>

        {/* Mailboxes Tab */}
        <TabsContent value="mailboxes">
          <EmailMailboxManager />
        </TabsContent>

        {/* Webhook Tab */}
        <TabsContent value="webhook">
          <EmailWebhookSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
};
