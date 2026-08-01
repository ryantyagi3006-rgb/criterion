"use client";
import { useState } from "react";
import ThemeToggle from "@/components/ThemeToggle";

const LINKS = ["Subjects", "Criteria", "Marking", "Analytics"];

export default function HeroNav({ onSignIn }: { onSignIn: () => void }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <>
      {/* z-20 keeps the logo and the close button above the menu overlay. */}
      <header className="fixed top-0 inset-x-0 z-20 px-5 sm:px-8 py-4 sm:py-5 flex flex-row justify-between items-center bg-transparent">
        {/* Logo */}
        <div className="flex flex-row gap-3 items-center">
          <span className="font-display text-[21px] sm:text-[26px] tracking-tight text-ink font-semibold select-none">
            Criterion<span className="text-teal">.</span>
          </span>
        </div>

        {/* Desktop links */}
        <nav className="hidden md:flex flex-row text-[23px] text-ink">
          {LINKS.map((link, i) => (
            <span key={link} className="flex flex-row">
              <a href="#" className="hover:opacity-60 transition-opacity">
                {link}
              </a>
              {i < LINKS.length - 1 && <span className="opacity-40">,&nbsp;</span>}
            </span>
          ))}
        </nav>

        <div className="flex items-center gap-4">
          <ThemeToggle />
          {/* Desktop CTA */}
          <button
            onClick={onSignIn}
            className="hidden md:inline text-[23px] text-ink underline underline-offset-2 hover:opacity-60 transition-opacity"
          >
            Sign in
          </button>

          {/* Hamburger */}
          <button
            type="button"
            aria-label="Toggle menu"
            aria-expanded={isMobileMenuOpen}
            onClick={() => setIsMobileMenuOpen((open) => !open)}
            className="md:hidden flex flex-col gap-[5px] p-1"
          >
            <span
              className={`w-6 h-[2px] bg-ink transition-all duration-300 ${
                isMobileMenuOpen ? "rotate-45 translate-y-[7px]" : ""
              }`}
            />
            <span
              className={`w-6 h-[2px] bg-ink transition-all duration-300 ${
                isMobileMenuOpen ? "opacity-0" : ""
              }`}
            />
            <span
              className={`w-6 h-[2px] bg-ink transition-all duration-300 ${
                isMobileMenuOpen ? "-rotate-45 -translate-y-[7px]" : ""
              }`}
            />
          </button>
        </div>
      </header>

      {/* Mobile overlay. Must outrank the z-10 content layer or the links sit
          underneath the hero copy and cannot be tapped. */}
      <div
        className={`md:hidden fixed inset-0 z-[15] bg-paper/95 backdrop-blur-sm transition-opacity duration-300 flex flex-col justify-center items-center gap-6 ${
          isMobileMenuOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
      >
        {LINKS.map((link) => (
          <a
            key={link}
            href="#"
            onClick={() => setIsMobileMenuOpen(false)}
            className="text-3xl text-ink hover:opacity-60 transition-opacity"
          >
            {link}
          </a>
        ))}
        <button
          onClick={() => {
            setIsMobileMenuOpen(false);
            onSignIn();
          }}
          className="text-3xl text-ink underline underline-offset-2 hover:opacity-60 transition-opacity"
        >
          Sign in
        </button>
      </div>
    </>
  );
}
