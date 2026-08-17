import { redirect } from "next/navigation";
import { getUser } from "@/lib/dal";

export default async function Home() {
  const user = await getUser();
  redirect(user ? "/home" : "/login");
}
