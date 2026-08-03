import { CalendarClock } from "lucide-react";
import { SectionPlaceholder } from "@/components/shell/section-placeholder";

export default function ReservationsPage() {
  return (
    <SectionPlaceholder
      icon={CalendarClock}
      title="Reservations"
      description="The normalized timeline for every active and upcoming trip. Not built yet — it's scoped to arrive once a real Turo Connector is in place."
    />
  );
}
