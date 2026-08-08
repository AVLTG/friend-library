"use client";

import { useEffect } from "react";

export default function MainError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("BookShare route error:", error);
  }, [error]);

  return (
    <div className="max-w-xl mx-auto px-4 sm:px-6 py-16 text-center">
      <div className="card-warm p-7">
        <h1 className="font-serif text-xl font-bold text-warm-900 mb-2">
          This page could not be loaded
        </h1>
        <p className="text-warm-500 text-sm mb-5">
          Something unexpected happened. Your library data was not changed.
        </p>
        <button
          onClick={reset}
          className="bg-warm-700 text-cream px-4 py-2 rounded-lg font-medium hover:bg-warm-800 transition-colors text-sm"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}
