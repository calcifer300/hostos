"use client";

import { motion } from "framer-motion";
import { googleSignIn } from "@/lib/actions/auth";

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.09, delayChildren: 0.1 },
  },
};

const item = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] as const },
  },
};

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.997 8.997 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.167 6.656 3.58 9 3.58z"
      />
    </svg>
  );
}

export function LoginScreen() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#FAFAF9] px-6">
      <div
        aria-hidden
        className="pointer-events-none absolute -left-40 -top-40 h-96 w-96 rounded-full bg-[#0071E3]/10 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-[#0071E3]/10 blur-3xl"
      />

      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="relative flex w-full max-w-sm flex-col items-center text-center"
      >
        <motion.div variants={item} className="mb-8 flex items-center gap-3">
          <span className="h-3.5 w-3.5 shrink-0 rounded-full bg-[#0071E3]" />
          <h1 className="text-[42px] font-semibold tracking-tight text-[#171716]">HostOS</h1>
        </motion.div>

        <motion.p variants={item} className="text-[16px] font-medium text-[#6B6A66]">
          AI Operating System for Turo Hosts
        </motion.p>

        <motion.div variants={item} className="mt-12 w-full">
          <form action={googleSignIn}>
            <button
              type="submit"
              className="flex w-full items-center justify-center gap-3 rounded-full border border-[#E5E4E0] bg-white px-6 py-3.5 text-[15px] font-medium text-[#171716] shadow-[0_1px_2px_rgba(23,23,22,0.04),0_8px_24px_-12px_rgba(23,23,22,0.12)] transition-transform hover:scale-[1.01] active:scale-[0.99]"
            >
              <GoogleIcon />
              Continue with Google
            </button>
          </form>
        </motion.div>

        <motion.p variants={item} className="mt-8 text-[12.5px] leading-relaxed text-[#9b9a96]">
          By continuing, you agree to let iHost act on your behalf per the permissions you grant.
        </motion.p>
      </motion.div>
    </div>
  );
}
