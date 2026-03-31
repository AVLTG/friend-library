"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { BookOpen } from "lucide-react";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // Middleware handles redirect for unauthenticated users
    // If we reach here, we're logged in
    router.replace("/library");
  }, [router]);

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
      >
        <BookOpen className="w-8 h-8 text-warm-500" />
      </motion.div>
    </div>
  );
}
