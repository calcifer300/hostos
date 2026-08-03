import { Badge } from "@/components/ui/badge";
import type { TuroEventType } from "@/types/ihost";

const LABELS: Record<TuroEventType, string> = {
  guest_message: "Guest message",
  id_verification: "ID verification",
  reservation_time_change: "Time change",
  new_booking: "New booking",
  cancellation: "Cancellation",
  other: "Notification",
};

export function EventBadge({ type }: { type: TuroEventType }) {
  return <Badge variant="accent">{LABELS[type]}</Badge>;
}
