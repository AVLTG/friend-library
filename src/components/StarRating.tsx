"use client";

import { Star } from "lucide-react";

interface StarRatingProps {
  value: number | null;
  onChange?: (value: number | null) => void;
  readonly?: boolean;
  size?: "sm" | "md" | "lg";
  label?: string;
}

export default function StarRating({
  value,
  onChange,
  readonly = false,
  size = "md",
  label = "Rating",
}: StarRatingProps) {
  const sizeClass = {
    sm: "w-3.5 h-3.5",
    md: "w-5 h-5",
    lg: "w-7 h-7",
  }[size];
  const displayValue = value ?? 0;

  const stars = (
    <div className="flex items-center gap-0.5" aria-hidden="true">
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = displayValue >= star;
        const halfFilled = displayValue >= star - 0.5 && displayValue < star;

        return (
          <span key={star} className="relative">
            <Star
              className={`${sizeClass} transition-colors ${
                filled
                  ? "fill-amber-700 text-amber-700"
                  : halfFilled
                    ? "text-amber-700"
                    : "text-warm-500"
              }`}
            />
            {halfFilled && (
              <Star
                className={`${sizeClass} absolute inset-0 fill-amber-700 text-amber-700`}
                style={{ clipPath: "inset(0 50% 0 0)" }}
              />
            )}
          </span>
        );
      })}
    </div>
  );

  if (readonly || !onChange) {
    return (
      <div
        role="img"
        aria-label={
          value === null ? `${label}: Not rated` : `${label}: ${value} out of 5 stars`
        }
      >
        {stars}
      </div>
    );
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    let nextValue: number | null = null;
    const currentValue = value ?? 0;

    if (event.key === "ArrowRight" || event.key === "ArrowUp") {
      nextValue = Math.min(5, currentValue + 0.5);
    } else if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
      nextValue = Math.max(0, currentValue - 0.5);
    } else if (event.key === "Home") {
      nextValue = 0;
    } else if (event.key === "End") {
      nextValue = 5;
    }

    if (nextValue !== null) {
      event.preventDefault();
      onChange?.(nextValue === 0 ? null : nextValue);
    }
  }

  return (
    <div className="relative flex h-11 w-fit items-center rounded-lg focus-within:ring-2 focus-within:ring-warm-700 focus-within:ring-offset-2 focus-within:ring-offset-warm-50">
      {stars}
      <input
        type="range"
        min="0"
        max="5"
        step="0.5"
        value={value ?? 0}
        onChange={(event) => {
          const nextValue = Number(event.currentTarget.value);
          onChange(nextValue === 0 ? null : nextValue);
        }}
        onKeyDown={handleKeyDown}
        aria-label={label}
        aria-valuenow={value ?? 0}
        aria-valuetext={value === null ? "Not rated" : `${value} out of 5 stars`}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      />
    </div>
  );
}
