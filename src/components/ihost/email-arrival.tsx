import { motion } from "framer-motion";
import { Mail } from "lucide-react";
import type { InboundTuroEmail } from "@/types/ihost";

export function EmailArrival({ email }: { email: InboundTuroEmail }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3.5"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/10 text-sm font-medium text-accent">
        {email.guestName.charAt(0).toUpperCase()}
      </div>
      <div className="min-w-0">
        <p className="truncate text-[13.5px] font-medium">
          {email.guestName} <span className="text-muted-foreground">&middot;</span> {email.vehicle}
        </p>
        <p className="flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
          <Mail className="h-3 w-3" />
          New message received
        </p>
      </div>
    </motion.div>
  );
}
