import { motion } from "framer-motion";
import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { IHostAnalysis } from "@/types/ihost";

const reveal = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] as const },
};

export function AnalysisPanel({ analysis }: { analysis: IHostAnalysis }) {
  return (
    <div className="space-y-6">
      <motion.div {...reveal}>
        <p className="mb-2 text-[11.5px] font-semibold uppercase tracking-wide text-muted-foreground">
          Summary
        </p>
        <p className="text-[15px] leading-relaxed">{analysis.summary}</p>
      </motion.div>

      <motion.div {...reveal} transition={{ ...reveal.transition, delay: 0.1 }}>
        <div className="mb-2 flex items-center gap-2">
          <p className="text-[11.5px] font-semibold uppercase tracking-wide text-muted-foreground">
            Does this need you?
          </p>
          <Badge variant={analysis.actionRequired ? "accent" : "success"}>
            {analysis.actionRequired ? "Action needed" : "No action needed"}
          </Badge>
        </div>
        <p className="border-l-2 border-border pl-3.5 text-[13.5px] leading-relaxed text-muted-foreground">
          {analysis.actionReason}
        </p>
      </motion.div>

      {analysis.escalate && (
        <motion.div
          {...reveal}
          transition={{ ...reveal.transition, delay: 0.15 }}
          className="flex gap-2.5 rounded-md border border-danger/30 bg-danger-bg px-3.5 py-3"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
          <div>
            <p className="text-[13px] font-medium text-danger">Flagged for your review before sending</p>
            <p className="mt-0.5 text-[13px] leading-relaxed text-danger/90">
              {analysis.escalateReason}
            </p>
          </div>
        </motion.div>
      )}
    </div>
  );
}
