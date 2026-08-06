"use client";

import { motion } from "framer-motion";
import { LogOut, LogIn } from "lucide-react";
import { GreetingHeader } from "@/components/dashboard/greeting-header";
import { GuestMessagesCard } from "@/components/dashboard/guest-messages-card";
import { AiBriefingCard } from "@/components/dashboard/ai-briefing-card";
import { FleetHealthCard } from "@/components/dashboard/fleet-health-card";
import { ScheduleCard } from "@/components/dashboard/schedule-card";
import { MessagesCard } from "@/components/dashboard/messages-card";
import { CalendarTimelineCard } from "@/components/dashboard/calendar-timeline-card";
import { ActivityCard } from "@/components/dashboard/activity-card";
import { SuggestionsCard } from "@/components/dashboard/suggestions-card";
import { FleetStatusGrid } from "@/components/dashboard/fleet-status-grid";
import { VehicleOperationsTimeline } from "@/components/dashboard/vehicle-operations-timeline";
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

      {/* Guest messages come first, full width — the thing that actually
          needs a human's attention, ahead of anything AI-generated. */}
      <motion.div variants={item}>
        <GuestMessagesCard initialMessages={initialGuestMessages} />
      </motion.div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <motion.div variants={item} className="lg:col-span-2">
          <AiBriefingCard initialEmail={initialEmail} />
        </motion.div>
        <motion.div variants={item}>
          <FleetHealthCard health={data.fleetHealth} />
        </motion.div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
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
        <motion.div variants={item}>
          <MessagesCard messages={data.messages} />
        </motion.div>
      </div>

      <motion.div variants={item}>
        <CalendarTimelineCard timeline={data.timeline} />
      </motion.div>

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
