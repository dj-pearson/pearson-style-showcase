import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Plus, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { logger } from '@/lib/logger';

interface Contact {
  id: string;
  contact_type: string;
  company_name: string | null;
  contact_name: string;
  email: string | null;
  phone: string | null;
  is_active: boolean;
}

export const ContactsManager = () => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>('all');
  const { toast } = useToast();

  useEffect(() => {
    loadContacts();
  }, [filterType]);

  const loadContacts = async () => {
    try {
      setIsLoading(true);
      let query = supabase
        .from('contacts')
        .select('*')
        .order('contact_name', { ascending: true });

      if (filterType !== 'all') {
        query = query.eq('contact_type', filterType);
      }

      const { data, error } = await query;

      if (error) throw error;
      setContacts(data || []);
    } catch (error) {
      logger.error('Error loading contacts:', error);
      toast({
        title: 'Error',
        description: 'Failed to load contacts',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Contacts</CardTitle>
              <CardDescription>
                Manage customers and vendors
              </CardDescription>
            </div>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Contact
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-4">
            <Button
              variant={filterType === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterType('all')}
            >
              All
            </Button>
            <Button
              variant={filterType === 'customer' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterType('customer')}
            >
              Customers
            </Button>
            <Button
              variant={filterType === 'vendor' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterType('vendor')}
            >
              Vendors
            </Button>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : contacts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No contacts found</p>
              <p className="text-sm">Add your first customer or vendor</p>
            </div>
          ) : (
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contacts.map((contact) => (
                    <TableRow key={contact.id}>
                      <TableCell className="font-medium">
                        {contact.contact_name}
                      </TableCell>
                      <TableCell>{contact.company_name || '-'}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {contact.contact_type}
                        </Badge>
                      </TableCell>
                      <TableCell>{contact.email || '-'}</TableCell>
                      <TableCell>{contact.phone || '-'}</TableCell>
                      <TableCell>
                        <Badge variant={contact.is_active ? 'default' : 'outline'}>
                          {contact.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
