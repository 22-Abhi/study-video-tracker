import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import Dashboard from "@/components/Dashboard";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/");
  
  const isUploaderEligible = Boolean(
    session.user.isUploaderEligible || 
    session.user.email?.toLowerCase() === "abhi.ukande22@gmail.com"
  );

  return (
    <Dashboard
      initialRole={isUploaderEligible ? "uploader" : "viewer"}
      isUploaderEligible={isUploaderEligible}
      name={session.user.name}
      email={session.user.email}
      userId={session.user.id || session.user.email || "user"}
    />
  );
}