import { redirect } from "next/navigation";

/** Tasks is the default view of Plan. */
export default function PlanPage() {
  redirect("/plan/tasks");
}
