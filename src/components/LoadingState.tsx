"use client";

import { motion } from "framer-motion";
import { BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";

type LoadingStateProps = {
  message: string;
  className?: string;
  iconClassName?: string;
};

export default function LoadingState({
  message,
  className,
  iconClassName = "w-8 h-8 text-warm-500",
}: LoadingStateProps) {
  return (
    <div
      role="status"
      className={cn(
        "flex items-center justify-center gap-3 text-warm-700",
        className,
      )}
    >
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
      >
        <BookOpen aria-hidden="true" className={iconClassName} />
      </motion.div>
      <span className="text-sm">{message}</span>
    </div>
  );
}
