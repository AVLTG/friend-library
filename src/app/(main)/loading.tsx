import { BookOpen } from "lucide-react";

export default function MainLoading() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
      <div className="flex items-center justify-center gap-3 h-[300px] text-warm-500">
        <BookOpen className="w-7 h-7 animate-pulse" />
        <span className="text-sm">Loading your library...</span>
      </div>
    </div>
  );
}
