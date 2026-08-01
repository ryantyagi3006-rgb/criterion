import Link from "next/link";
import ThemeToggle from "./ThemeToggle";
import LogoutButton from "./LogoutButton";

export default function Shell({
  name,
  role,
  children,
}: {
  name: string;
  role: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-paper">
      <header className="sticky top-0 z-40 border-b border-line bg-surface/90 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link href="/dashboard" className="font-display text-xl font-semibold text-ink">
            Criterion<span className="text-teal">.</span>
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden sm:block text-sm text-soft">
              {name} <span className="text-line">|</span>{" "}
              <span className="capitalize">{role.toLowerCase()}</span>
            </span>
            <ThemeToggle />
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">{children}</main>
    </div>
  );
}
