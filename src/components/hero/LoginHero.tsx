"use client";
import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Check, X } from "lucide-react";
import AuthCard from "@/components/AuthCard";
// The scrubbing video is still in ./BackgroundVideo if you want it back;
// swapping these two lines is the whole change.
import HaloBackground from "./HaloBackground";
import HeroNav from "./HeroNav";
import { useTypewriter } from "./useTypewriter";

const SUBJECT_GROUPS = [
  "Mathematics",
  "Sciences",
  "Language & Literature",
  "Individuals & Societies",
  "Design",
  "Arts",
];

export default function LoginHero() {
  const [subjects, setSubjects] = useState<string[]>([]);
  const [showAuth, setShowAuth] = useState(false);
  const { displayed, done } = useTypewriter("task sheets,\ndigitised.");

  function toggleSubject(subject: string) {
    setSubjects((current) =>
      current.includes(subject)
        ? current.filter((s) => s !== subject)
        : [...current, subject]
    );
  }

  return (
    <div className="relative bg-paper text-ink font-sans selection:bg-tealwash selection:text-tealdeep antialiased overflow-x-hidden flex flex-col lg:block lg:min-h-screen">
      <HeroNav onSignIn={() => setShowAuth(true)} />

      <HaloBackground />

      <div className="relative z-10 flex flex-col order-first lg:order-none w-full bg-paper lg:bg-transparent pb-8 lg:pb-0 lg:min-h-screen">
        <main
          id="spade-hero"
          className="w-full max-w-7xl mx-auto px-6 py-12 flex-1 flex flex-col justify-center"
        >
          {/* Headline */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h1 className="font-display text-5xl md:text-6xl lg:text-[76px] font-semibold tracking-tight text-ink leading-[1.08] mb-8 select-none w-full whitespace-pre-wrap">
              {displayed}
              {!done && (
                <span className="inline-block w-[2px] h-[1.1em] bg-ink align-middle ml-[2px] animate-blink" />
              )}
            </h1>
          </motion.div>

          {/* Description */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            <p className="text-lg md:text-xl text-soft leading-relaxed font-normal mb-14 max-w-2xl">
              Upload an MYP task sheet and every question comes back mapped <br />
              to its criteria and strands, with the right tools beside it.
            </p>
          </motion.div>

          {/* Subject group picker */}
          <div className="max-w-2xl">
            <h2 className="text-2xl font-medium tracking-tight mb-2 text-ink">
              Which subject groups do you teach?
            </h2>
            <p className="opacity-85 text-soft mb-8">Select all that apply</p>

            <div className="flex flex-wrap gap-3 mb-6">
              {SUBJECT_GROUPS.map((subject) => {
                const active = subjects.includes(subject);
                return (
                  <motion.button
                    key={subject}
                    type="button"
                    onClick={() => toggleSubject(subject)}
                    aria-pressed={active}
                    whileTap={{ scale: 0.97 }}
                    className={`flex items-center gap-2 rounded-full px-6 py-3 text-base font-medium transition-colors ${
                      active
                        ? "bg-teal text-paper shadow-md shadow-teal/10 transform"
                        : "bg-surface text-ink border border-line hover:bg-tealwash"
                    }`}
                  >
                    <AnimatePresence initial={false}>
                      {active && (
                        <motion.span
                          initial={{ scale: 0, opacity: 0, width: 0 }}
                          animate={{ scale: 1, opacity: 1, width: "auto" }}
                          exit={{ scale: 0, opacity: 0, width: 0 }}
                          transition={{ type: "spring", stiffness: 300, damping: 20 }}
                          className="inline-flex items-center overflow-hidden"
                        >
                          <Check className="w-4 h-4" strokeWidth={2.5} />
                        </motion.span>
                      )}
                    </AnimatePresence>
                    {subject}
                  </motion.button>
                );
              })}
            </div>

            {/* Status banner */}
            <AnimatePresence mode="wait">
              {subjects.length === 0 ? (
                <motion.p
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 0.5 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="italic text-xs text-soft"
                >
                  Please click to select subject groups above.
                </motion.p>
              ) : (
                <motion.div
                  key="active"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 200, damping: 26 }}
                  className="overflow-hidden"
                >
                  <div className="bg-surface border border-line rounded-2xl px-5 py-4 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm text-ink">
                      Ready to digitise task sheets for:{" "}
                      <span className="font-medium">{subjects.join(", ")}</span>
                    </p>
                    <button
                      type="button"
                      onClick={() => setShowAuth(true)}
                      className="group inline-flex items-center gap-2 text-teal uppercase text-xs font-semibold tracking-wide hover:opacity-70 transition-opacity"
                    >
                      Let&apos;s Go
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </main>
      </div>

      {/* Sign-in panel */}
      <AnimatePresence>
        {showAuth && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 grid place-items-center bg-neutral-900/50 backdrop-blur-sm p-4"
            onClick={() => setShowAuth(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.98 }}
              transition={{ type: "spring", stiffness: 300, damping: 26 }}
              className="relative w-full max-w-md"
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                aria-label="Close sign in"
                onClick={() => setShowAuth(false)}
                className="absolute -top-10 right-0 text-white/80 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
              <AuthCard />
              <p className="mt-4 text-center text-xs text-white/70">
                Demo accounts: teacher@demo.com and student@demo.com, password password123
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
