import { redirect } from "next/navigation";

/** Automation rules moved into Butler (Project Aurora) — this route stays live so old links don't 404. */
export default function AutomationsPage() {
  redirect("/butler");
}
