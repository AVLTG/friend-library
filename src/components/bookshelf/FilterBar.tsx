"use client";

import { Search, SlidersHorizontal, Users, BookOpen, Star } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";

interface FilterBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  sortBy: string;
  onSortChange: (value: string) => void;
  filterOwner: string;
  onFilterOwnerChange: (value: string) => void;
  owners: Array<{ id: string; firstName: string; username: string; avatarColor: string }>;
}

export default function FilterBar({
  search,
  onSearchChange,
  sortBy,
  onSortChange,
  filterOwner,
  onFilterOwnerChange,
  owners,
}: FilterBarProps) {
  const [showFilters, setShowFilters] = useState(false);

  return (
    <div className="space-y-3">
      {/* Search + Filter toggle */}
      <div className="flex gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-warm-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search books by title or author..."
            className="w-full pl-10 pr-4 py-2.5 bg-warm-50 border border-warm-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-warm-400 focus:border-transparent text-warm-900 placeholder-warm-400 text-sm"
          />
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
            showFilters
              ? "bg-warm-700 text-cream border-warm-700"
              : "bg-warm-50 text-warm-700 border-warm-200 hover:bg-warm-100"
          }`}
        >
          <SlidersHorizontal className="w-4 h-4" />
          <span className="hidden sm:inline">Filters</span>
        </button>
      </div>

      {/* Expanded filters */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="card-warm p-4 flex flex-wrap gap-4">
              {/* Sort */}
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-warm-500" />
                <select
                  value={sortBy}
                  onChange={(e) => onSortChange(e.target.value)}
                  className="bg-cream border border-warm-200 rounded-lg px-3 py-1.5 text-sm text-warm-700 focus:outline-none focus:ring-2 focus:ring-warm-400"
                >
                  <option value="title">Sort by Title</option>
                  <option value="author">Sort by Author</option>
                  <option value="rating">Sort by Rating</option>
                  <option value="recent">Recently Added</option>
                </select>
              </div>

              {/* Filter by owner */}
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-warm-500" />
                <select
                  value={filterOwner}
                  onChange={(e) => onFilterOwnerChange(e.target.value)}
                  className="bg-cream border border-warm-200 rounded-lg px-3 py-1.5 text-sm text-warm-700 focus:outline-none focus:ring-2 focus:ring-warm-400"
                >
                  <option value="">All Members</option>
                  {owners.map((owner) => (
                    <option key={owner.id} value={owner.id}>
                      {owner.firstName}&apos;s Books
                    </option>
                  ))}
                </select>
              </div>

              {/* Quick filters */}
              <div className="flex items-center gap-2">
                <Star className="w-4 h-4 text-warm-500" />
                <button
                  onClick={() => onSortChange("rating")}
                  className="text-sm text-warm-600 hover:text-warm-800 underline decoration-warm-300"
                >
                  Top Rated
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
