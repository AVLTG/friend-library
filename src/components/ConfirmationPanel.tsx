"use client";

import type { ReactNode, Ref } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

type ConfirmationPanelProps = {
  id: string;
  titleId: string;
  descriptionId: string;
  title: ReactNode;
  description: ReactNode;
  variant: "warm" | "danger";
  confirmLabel: string;
  pendingLabel: string;
  pending: boolean;
  confirmIcon: ReactNode;
  confirmDisabled: boolean;
  cancelDisabled: boolean;
  cancelRef?: Ref<HTMLButtonElement>;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function ConfirmationPanel({
  id,
  titleId,
  descriptionId,
  title,
  description,
  variant,
  confirmLabel,
  pendingLabel,
  pending,
  confirmIcon,
  confirmDisabled,
  cancelDisabled,
  cancelRef,
  onConfirm,
  onCancel,
}: ConfirmationPanelProps) {
  const danger = variant === "danger";

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      className="overflow-hidden mt-4"
    >
      <div
        id={id}
        role="region"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        onKeyDown={(event) => {
          if (event.key === "Escape" && !cancelDisabled) onCancel();
        }}
        className={cn(
          "p-4 border rounded-lg",
          danger
            ? "bg-red-50 border-red-200"
            : "bg-warm-50 border-warm-500",
        )}
      >
        <p
          id={titleId}
          className={cn(
            "break-words text-sm font-medium mb-1",
            danger ? "text-red-800" : "text-warm-800",
          )}
        >
          {title}
        </p>
        <p
          id={descriptionId}
          className={cn(
            "text-xs mb-3",
            danger ? "text-red-700" : "text-warm-700",
          )}
        >
          {description}
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={onConfirm}
            disabled={confirmDisabled}
            className={cn(
              "flex min-h-11 w-full items-center justify-center gap-2 px-4 py-2 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 sm:w-auto",
              danger
                ? "bg-red-700 hover:bg-red-800"
                : "bg-warm-700 hover:bg-warm-800",
            )}
          >
            {confirmIcon}
            {pending ? pendingLabel : confirmLabel}
          </button>
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            disabled={cancelDisabled}
            className="min-h-11 w-full px-4 py-2 text-warm-700 hover:bg-warm-100 rounded-lg text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          >
            Cancel
          </button>
        </div>
      </div>
    </motion.div>
  );
}
