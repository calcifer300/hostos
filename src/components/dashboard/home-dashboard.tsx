"use client";

import { motion } from "framer-motion";
import { LogOut, LogIn } from "lucide-react";
import { GreetingHeader } from "@/components/dashboard/greeting-header";
import { AiBriefingCard } from "@/components/dashboard/ai-briefing-card";
import { FleetHealthCard } from "@/components/dashboard/fleet-health-card";
import { ScheduleCard } from "@/components/dashboard/schedule-card";
import { MessagesCard } from "@/components/dashboard/messages-card";
import { CalendarTimelineCard } from "@/components/dashboard/calendar-timeline-card";
import { ActivityCard } from "@/components/dashboard/activity-card";
import { SuggestionsCard } from "@/components/dashboard/suggestions-card";
import { FleetStatusGrid } from "@/components/dashboard/fleet-status-grid";
import { todaysPickups, todaysReturns } from "@/lib/mock/dashboard";
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
}: {
  userFirstName?: string | null;
  initialEmail?: InboundTuroEmail | null;
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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <motion.div variants={item} className="lg:col-span-2">
          <AiBriefingCard initialEmail={initialEmail} />
        </motion.div>
        <motion.div variants={item}>
          <FleetHealthCard />
        </motion.div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <motion.div variants={item}>
          <ScheduleCard
            icon={LogOut}
            title="Today's pickups"
            entries={todaysPickups}
            notReadyLabel="Needs prep"
          />
        </motion.div>
        <motion.div variants={item}>
          <ScheduleCard
            icon={LogIn}
            title="Today's returns"
            entries={todaysReturns}
            notReadyLabel="Inspect first"
          />
        </motion.div>
        <motion.div variants={item}>
          <MessagesCard />
        </motion.div>
      </div>

      <motion.div variants={item}>
        <CalendarTimelineCard />
      </motion.div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <motion.div variants={item} className="lg:col-span-2">
          <ActivityCard />
        </motion.div>
        <motion.div variants={item}>
          <SuggestionsCard />
        </motion.div>
      </div>

      <motion.div variants={item} className="pb-4">
        <FleetStatusGrid />
      </motion.div>
    </motion.div>
  );
}
