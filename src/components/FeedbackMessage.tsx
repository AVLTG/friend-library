"use client";

import { forwardRef, type ReactNode } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

type FeedbackMessageProps = {
  type: "error" | "success" | "status";
  children: ReactNode;
  animated?: boolean;
  className?: string;
  id?: string;
  tabIndex?: number;
};

const FeedbackMessage = forwardRef<HTMLDivElement, FeedbackMessageProps>(
  function FeedbackMessage(
    { type, children, animated = false, className, id, tabIndex },
    ref,
  ) {
    const role = type === "error" ? "alert" : "status";
    const classes = cn(
      "rounded-lg border text-sm",
      type === "error"
        ? "border-red-200 bg-red-50 text-red-700"
        : type === "success"
          ? "border-green-200 bg-green-50 text-green-700"
          : "border-warm-200 bg-warm-50 text-warm-700",
      className,
    );

    if (animated) {
      return (
        <motion.div
          ref={ref}
          role={role}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={classes}
          id={id}
          tabIndex={tabIndex}
        >
          {children}
        </motion.div>
      );
    }

    return (
      <div ref={ref} role={role} className={classes} id={id} tabIndex={tabIndex}>
        {children}
      </div>
    );
  },
);

export default FeedbackMessage;
