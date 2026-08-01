import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import LoginHero from "@/components/hero/LoginHero";

export default async function Home() {
  const session = await getSession();
  if (session) redirect("/dashboard");

  return <LoginHero />;
}
