"use client";

import { motion } from "framer-motion";
import { LogOut, LogIn, Calendar, Car, MessageCircle, AlertTriangle } from "lucide-react";
import { GreetingHeader } from "@/components/dashboard/greeting-header";
import { GuestMessagesCard } from "@/components/dashboard/guest-messages-card";
import { AiBriefingCard } from "@/components/dashboard/ai-briefing-card";
import { ScheduleCard } from "@/components/dashboard/schedule-card";
import { ActivityCard } from "@/components/dashboard/activity-card";
import { SuggestionsCard } from "@/components/dashboard/suggestions-card";
import { FleetStatusGrid } from "@/components/dashboard/fleet-status-grid";
import { VehicleOperationsTimeline } from "@/components/dashboard/vehicle-operations-timeline";
import { StatCard } from "@/components/dashboard/stat-card";
import { FleetOverviewCard } from "@/components/dashboard/fleet-overview-card";
import { OccupancyRateCard } from "@/components/dashboard/occupancy-rate-card";
import { TaskPriorityCard } from "@/components/dashboard/task-priority-card";
import type { DashboardData } from "@/lib/dashboard/queries";
import type { GuestConversation } from "@/lib/messages/queries";
import type { InboundTuroEmail } from "@/types/ihost";

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.07, delayChildren: 0.05 },
  },
};

const item = {
  hidden: { opacity: 0, y: 14 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] as const },
  },
};

/**
 * FleetHealthCard, MessagesCard, and CalendarTimelineCard used to render
 * here too. Once StatCard/FleetOverviewCard/TaskPriorityCard/ScheduleCard/
 * VehicleOperationsTimeline landed, they were showing the same numbers a
 * second time (FleetHealthCard's breakdown = the new stat row, MessagesCard
 * = GuestMessagesCard, CalendarTimelineCard = ScheduleCard + the operations
 * timeline) — removed rather than left as clutter. Their components are
 * still in the tree in case another page wants them; only this page's
 * usage changed.
 */
export function HomeDashboard({
  userFirstName,
  initialEmail,
  initialGuestMessages,
  data,
}: {
  userFirstName?: string | null;
  initialEmail?: InboundTuroEmail | null;
  initialGuestMessages: GuestConversation[];
  data: DashboardData;
}) {
  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="mx-auto w-full max-w-[1400px] space-y-6"
    >
      <motion.div variants={item}>
        <GreetingHeader firstName={userFirstName} />
      </motion.div>

      {/* Every number here links to the page that explains it — see each
          StatCard's href — rather than sitting as inert display. */}
      <motion.div variants={item} className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          icon={Calendar}
          label="Today's trips"
          value={data.pickups.length + data.returns.length}
          breakdown={`${data.pickups.length} pickups · ${data.returns.length} returns`}
          href="/operations"
          tone="accent"
        />
        <StatCard
          icon={Car}
          label="Active vehicles"
          value={`${data.vehicles.filter((v) => v.status === "on_trip").length}/${data.vehicles.length}`}
          breakdown={`${data.vehicles.filter((v) => v.status === "available").length} available now`}
          href="/fleet"
          tone="success"
        />
        <StatCard
          icon={MessageCircle}
          label="Guest messages"
          value={data.messages.length}
          breakdown={data.messages.length > 0 ? "Waiting on a reply" : "You're caught up"}
          href="/messages"
          tone={data.messages.length > 0 ? "danger" : "success"}
        />
        <StatCard
          icon={AlertTriangle}
          label="Needs attention"
          value={data.suggestions.length + data.overdueReturns.length}
          breakdown={`${data.overdueReturns.length} overdue · ${data.suggestions.length} suggested`}
          href="/butler"
          tone={data.overdueReturns.length > 0 ? "danger" : "warning"}
        />
      </motion.div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <motion.div variants={item}>
          <FleetOverviewCard vehicles={data.vehicles} />
        </motion.div>
        <motion.div variants={item}>
          <OccupancyRateCard trend={data.occupancyTrend} />
        </motion.div>
        <motion.div variants={item}>
          <TaskPriorityCard suggestions={data.suggestions} />
        </motion.div>
      </div>

      {/* Guest messages come first, full width — the thing that actually
          needs a human's attention, ahead of anything AI-generated. */}
      <motion.div variants={item}>
        <GuestMessagesCard initialMessages={initialGuestMessages} />
      </motion.div>

      <motion.div variants={item}>
        <AiBriefingCard initialEmail={initialEmail} />
      </motion.div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <motion.div variants={item}>
          <ScheduleCard
            icon={LogOut}
            title="Today's pickups"
            entries={data.pickups}
            notReadyLabel="Needs prep"
            emptyMessage="No pickups dated today in your synced mail."
          />
        </motion.div>
        <motion.div variants={item}>
          <ScheduleCard
            icon={LogIn}
            title="Today's returns"
            entries={data.returns}
            notReadyLabel="Inspect first"
            emptyMessage="No returns dated today in your synced mail."
          />
        </motion.div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <motion.div variants={item} className="lg:col-span-2">
          <ActivityCard activity={data.activity} />
        </motion.div>
        <motion.div variants={item}>
          <SuggestionsCard suggestions={data.suggestions} />
        </motion.div>
      </div>

      <motion.div variants={item}>
        <VehicleOperationsTimeline days={data.operationsTimeline} />
      </motion.div>

      <motion.div variants={item} className="pb-4">
        <FleetStatusGrid
          vehicles={data.unscheduledVehicles}
          title="Unscheduled vehicles"
          emptyMessage="Every vehicle has a pickup or return on the books — nothing sitting idle."
        />
      </motion.div>
    </motion.div>
  );
}
