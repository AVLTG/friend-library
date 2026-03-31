"use client";

import { Star } from "lucide-react";
import { useState } from "react";

interface StarRatingProps {
  value: number | null;
  onChange?: (value: number) => void;
  readonly?: boolean;
  size?: "sm" | "md" | "lg";
}

export default function StarRating({
  value,
  onChange,
  readonly = false,
  size = "md",
}: StarRatingProps) {
  const [hoverValue, setHoverValue] = useState<number | null>(null);

  const sizeClass = {
    sm: "w-3.5 h-3.5",
    md: "w-5 h-5",
    lg: "w-7 h-7",
  }[size];

  const displayValue = hoverValue ?? value ?? 0;

  return (
    <div
      className="flex items-center gap-0.5"
      onMouseLeave={() => !readonly && setHoverValue(null)}
    >
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = displayValue >= star;
        const halfFilled = displayValue >= star - 0.5 && displayValue < star;

        return (
          <button
            key={star}
            type="button"
            disabled={readonly}
            className={`relative ${readonly ? "cursor-default" : "cursor-pointer"}`}
            onMouseEnter={() => !readonly && setHoverValue(star)}
            onClick={(e) => {
              if (readonly || !onChange) return;
              // Click on left half = half star, right half = full star
              const rect = e.currentTarget.getBoundingClientRect();
              const x = e.clientX - rect.left;
              const isLeftHalf = x < rect.width / 2;
              onChange(isLeftHalf ? star - 0.5 : star);
            }}
          >
            <Star
              className={`${sizeClass} transition-colors ${
                filled
                  ? "fill-amber-400 text-amber-400"
                  : halfFilled
                  ? "text-amber-400"
                  : "text-warm-300"
              }`}
            />
            {halfFilled && (
              <Star
                className={`${sizeClass} absolute inset-0 fill-amber-400 text-amber-400`}
                style={{ clipPath: "inset(0 50% 0 0)" }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
