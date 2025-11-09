import React from 'react';
import { SystemHealthCard } from './command-center/SystemHealthCard';
import { RevenueChart } from './command-center/RevenueChart';
import { LiveActivityFeed } from './command-center/LiveActivityFeed';
import { QuickActionsPanel } from './command-center/QuickActionsPanel';
import { SmartAlerts } from './command-center/SmartAlerts';

export const CommandCenterDashboard: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Command Center</h1>
        <p className="text-muted-foreground mt-1">
          Unified monitoring, analytics, and operations dashboard
        </p>
      </div>

      {/* Top Row: System Health + Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SystemHealthCard />
        <SmartAlerts />
      </div>

      {/* Quick Actions Panel */}
      <QuickActionsPanel />

      {/* Revenue Chart */}
      <RevenueChart />

      {/* Live Activity Feed */}
      <LiveActivityFeed />

      {/* Footer Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-lg border bg-card">
          <p className="text-sm text-muted-foreground mb-1">Admin Session</p>
          <p className="text-lg font-semibold">Active</p>
          <p className="text-xs text-muted-foreground mt-1">
            Last activity: {new Date().toLocaleTimeString()}
          </p>
        </div>

        <div className="p-4 rounded-lg border bg-card">
          <p className="text-sm text-muted-foreground mb-1">System Uptime</p>
          <p className="text-lg font-semibold">99.9%</p>
          <p className="text-xs text-muted-foreground mt-1">Last 30 days</p>
        </div>

        <div className="p-4 rounded-lg border bg-card">
          <p className="text-sm text-muted-foreground mb-1">Database</p>
          <p className="text-lg font-semibold">Connected</p>
          <p className="text-xs text-muted-foreground mt-1">
            Supabase PostgreSQL
          </p>
        </div>
      </div>
    </div>
  );
};
