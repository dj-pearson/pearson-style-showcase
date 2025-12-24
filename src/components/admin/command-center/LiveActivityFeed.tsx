import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Activity,
  MousePointerClick,
  Mail,
  MessageSquare,
  Wrench,
  Settings,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { formatDistanceToNow } from 'date-fns';

interface ActivityEvent {
  id: string;
  type: 'article_view' | 'affiliate_click' | 'newsletter_signup' | 'contact_form' | 'tool_submission' | 'admin_action';
  title: string;
  description: string;
  timestamp: Date;
  metadata?: Record<string, any>;
  icon: React.ReactNode;
  color: string;
}

export const LiveActivityFeed: React.FC = () => {
  const [activities, setActivities] = useState<ActivityEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadRecentActivities();

    // Set up real-time subscription for new activities
    const subscription = supabase
      .channel('activity-feed')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'amazon_affiliate_clicks'
      }, handleNewAffiliateClick)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'newsletter_subscribers'
      }, handleNewSubscriber)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'contact_submissions'
      }, handleNewContact)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'ai_tool_submissions'
      }, handleNewToolSubmission)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'admin_activity_log'
      }, handleNewAdminAction)
      .subscribe();

    // Refresh every 30 seconds to catch article views
    const interval = setInterval(loadRecentActivities, 30000);

    return () => {
      subscription.unsubscribe();
      clearInterval(interval);
    };
  }, []);

  const loadRecentActivities = async () => {
    try {
      const thirtyMinutesAgo = new Date();
      thirtyMinutesAgo.setMinutes(thirtyMinutesAgo.getMinutes() - 30);

      // Fetch recent affiliate clicks
      const { data: clicks } = await supabase
        .from('amazon_affiliate_clicks')
        .select('*, articles(title)')
        .gte('clicked_at', thirtyMinutesAgo.toISOString())
        .order('clicked_at', { ascending: false })
        .limit(10);

      // Fetch recent newsletter signups
      const { data: subscribers } = await supabase
        .from('newsletter_subscribers')
        .select('*')
        .gte('subscribed_at', thirtyMinutesAgo.toISOString())
        .order('subscribed_at', { ascending: false })
        .limit(10);

      // Fetch recent contact form submissions
      const { data: contacts } = await supabase
        .from('contact_submissions')
        .select('*')
        .gte('submitted_at', thirtyMinutesAgo.toISOString())
        .order('submitted_at', { ascending: false })
        .limit(10);

      // Fetch recent AI tool submissions
      const { data: toolSubmissions } = await supabase
        .from('ai_tool_submissions')
        .select('*')
        .gte('submitted_at', thirtyMinutesAgo.toISOString())
        .order('submitted_at', { ascending: false })
        .limit(10);

      // Fetch recent admin actions
      const { data: adminActions } = await supabase
        .from('admin_activity_log')
        .select('*')
        .gte('timestamp', thirtyMinutesAgo.toISOString())
        .order('timestamp', { ascending: false })
        .limit(10);

      // Combine and sort all activities
      const allActivities: ActivityEvent[] = [];

      clicks?.forEach(click => {
        allActivities.push({
          id: `click-${click.id}`,
          type: 'affiliate_click',
          title: 'Affiliate Link Clicked',
          description: click.articles?.title || 'Unknown article',
          timestamp: new Date(click.clicked_at),
          metadata: { asin: click.asin },
          icon: <MousePointerClick className="h-4 w-4" />,
          color: 'text-blue-500'
        });
      });

      subscribers?.forEach(sub => {
        allActivities.push({
          id: `sub-${sub.id}`,
          type: 'newsletter_signup',
          title: 'Newsletter Signup',
          description: sub.email,
          timestamp: new Date(sub.subscribed_at),
          icon: <Mail className="h-4 w-4" />,
          color: 'text-green-500'
        });
      });

      contacts?.forEach((contact: any) => {
        allActivities.push({
          id: `contact-${contact.id}`,
          type: 'contact_form',
          title: 'Contact Form Submitted',
          description: contact.subject || contact.name || 'New contact',
          timestamp: new Date(contact.submitted_at || contact.created_at),
          icon: <MessageSquare className="h-4 w-4" />,
          color: 'text-purple-500'
        });
      });

      toolSubmissions?.forEach((tool: any) => {
        allActivities.push({
          id: `tool-${tool.id}`,
          type: 'tool_submission',
          title: 'AI Tool Submitted',
          description: tool.tool_name || 'New tool',
          timestamp: new Date(tool.submitted_at || tool.created_at),
          icon: <Wrench className="h-4 w-4" />,
          color: 'text-orange-500'
        });
      });

      adminActions?.forEach((action: any) => {
        allActivities.push({
          id: `admin-${action.id}`,
          type: 'admin_action',
          title: formatActionName(action.action || 'action'),
          description: action.resource_title || action.action_category || action.details || '',
          timestamp: new Date(action.timestamp || action.created_at),
          metadata: { admin: action.admin_email || 'admin' },
          icon: <Settings className="h-4 w-4" />,
          color: 'text-gray-500'
        });
      });

      // Sort by timestamp descending and take top 50
      allActivities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      setActivities(allActivities.slice(0, 50));

      setIsLoading(false);
    } catch (error) {
      logger.error('Failed to load recent activities:', error);
      setIsLoading(false);
    }
  };

  const handleNewAffiliateClick = (payload: any) => {
    const newActivity: ActivityEvent = {
      id: `click-${payload.new.id}`,
      type: 'affiliate_click',
      title: 'Affiliate Link Clicked',
      description: 'New affiliate click',
      timestamp: new Date(payload.new.clicked_at),
      metadata: { asin: payload.new.asin },
      icon: <MousePointerClick className="h-4 w-4" />,
      color: 'text-blue-500'
    };
    setActivities(prev => [newActivity, ...prev].slice(0, 50));
  };

  const handleNewSubscriber = (payload: any) => {
    const newActivity: ActivityEvent = {
      id: `sub-${payload.new.id}`,
      type: 'newsletter_signup',
      title: 'Newsletter Signup',
      description: payload.new.email,
      timestamp: new Date(payload.new.subscribed_at),
      icon: <Mail className="h-4 w-4" />,
      color: 'text-green-500'
    };
    setActivities(prev => [newActivity, ...prev].slice(0, 50));
  };

  const handleNewContact = (payload: any) => {
    const newActivity: ActivityEvent = {
      id: `contact-${payload.new.id}`,
      type: 'contact_form',
      title: 'Contact Form Submitted',
      description: payload.new.subject || payload.new.name,
      timestamp: new Date(payload.new.submitted_at),
      icon: <MessageSquare className="h-4 w-4" />,
      color: 'text-purple-500'
    };
    setActivities(prev => [newActivity, ...prev].slice(0, 50));
  };

  const handleNewToolSubmission = (payload: any) => {
    const newActivity: ActivityEvent = {
      id: `tool-${payload.new.id}`,
      type: 'tool_submission',
      title: 'AI Tool Submitted',
      description: payload.new.tool_name,
      timestamp: new Date(payload.new.submitted_at),
      icon: <Wrench className="h-4 w-4" />,
      color: 'text-orange-500'
    };
    setActivities(prev => [newActivity, ...prev].slice(0, 50));
  };

  const handleNewAdminAction = (payload: any) => {
    const newActivity: ActivityEvent = {
      id: `admin-${payload.new.id}`,
      type: 'admin_action',
      title: formatActionName(payload.new.action),
      description: payload.new.resource_title || payload.new.action_category || '',
      timestamp: new Date(payload.new.timestamp),
      metadata: { admin: payload.new.admin_email },
      icon: <Settings className="h-4 w-4" />,
      color: 'text-gray-500'
    };
    setActivities(prev => [newActivity, ...prev].slice(0, 50));
  };

  const formatActionName = (action: string): string => {
    return action
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Live Activity Feed
            </CardTitle>
            <CardDescription>Real-time user actions and events</CardDescription>
          </div>
          <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">
            <span className="relative flex h-2 w-2 mr-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
            Live
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : activities.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Activity className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No recent activity in the last 30 minutes</p>
          </div>
        ) : (
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-3">
              {activities.map((activity, index) => (
                <div
                  key={activity.id}
                  className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                  style={{
                    animation: index < 3 ? 'fadeIn 0.3s ease-in' : 'none'
                  }}
                >
                  <div className={`p-2 rounded-full bg-muted ${activity.color}`}>
                    {activity.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium truncate">{activity.title}</p>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatDistanceToNow(activity.timestamp, { addSuffix: true })}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">{activity.description}</p>
                    {activity.metadata && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {Object.entries(activity.metadata).map(([key, value]) => (
                          <Badge key={key} variant="secondary" className="text-xs">
                            {key}: {String(value)}
                          </Badge>
                        ))}
                      </div>
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
