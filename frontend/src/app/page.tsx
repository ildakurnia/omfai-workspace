import { redirect } from "next/navigation";

export default function RootPage() {
  // Melakukan server-side redirect langsung ke dashboard
  redirect("/dashboard");
}
