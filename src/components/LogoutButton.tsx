"use client";
import { useRouter } from "next/navigation";

export default function LogoutButton() {
  const router = useRouter();
  return (
    <button
      onClick={async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        router.push("/");
        router.refresh();
      }}
      className="text-sm font-medium text-soft hover:text-ink px-2 py-1 rounded-lg transition-colors"
    >
      Sign out
    </button>
  );
}
