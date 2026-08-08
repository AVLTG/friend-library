"use client";

import { Search, SlidersHorizontal, Users, BookOpen, BookMarked, Eye } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import type { PublicUserDto } from "@/lib/api-types";

interface FilterBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  sortBy: string;
  onSortChange: (value: string) => void;
  filterOwner: string;
  onFilterOwnerChange: (value: string) => void;
  filterCategory: string;
  onFilterCategoryChange: (value: string) => void;
  filterReadBy: string;
  onFilterReadByChange: (value: string) => void;
  filterCurrentlyReading: string;
  onFilterCurrentlyReadingChange: (value: string) => void;
  owners: PublicUserDto[];
  readers: PublicUserDto[];
  currentlyReadingUsers: PublicUserDto[];
  categories: string[];
}

export default function FilterBar({
  search,
  onSearchChange,
  sortBy,
  onSortChange,
  filterOwner,
  onFilterOwnerChange,
  filterCategory,
  onFilterCategoryChange,
  filterReadBy,
  onFilterReadByChange,
  filterCurrentlyReading,
  onFilterCurrentlyReadingChange,
  owners,
  readers,
  currentlyReadingUsers,
  categories,
}: FilterBarProps) {
  const [showFilters, setShowFilters] = useState(false);

  const activeFilterCount = [filterOwner, filterCategory, filterReadBy, filterCurrentlyReading].filter(Boolean).length;

  return (
    <div className="space-y-3">
      <div className="flex gap-3">
        <div className="flex-1 relative">
          <Search aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-warm-600" />
          <label htmlFor="library-search" className="sr-only">Search books</label>
          <input
            id="library-search"
            type="search"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search books by title or author..."
            className="w-full pl-10 pr-4 py-2.5 bg-warm-50 border border-warm-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-warm-700 focus:border-transparent text-warm-900 placeholder-warm-600 text-base sm:text-sm"
          />
        </div>
        <button
          type="button"
          onClick={() => setShowFilters(!showFilters)}
          aria-label={`Filters${activeFilterCount ? `, ${activeFilterCount} active` : ""}`}
          aria-expanded={showFilters}
          aria-controls="library-filters"
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
            showFilters || activeFilterCount > 0
              ? "bg-warm-700 text-cream border-warm-700"
              : "bg-warm-50 text-warm-700 border-warm-200 hover:bg-warm-100"
          }`}
        >
          <SlidersHorizontal aria-hidden="true" className="w-4 h-4" />
          <span className="hidden sm:inline">Filters</span>
          {activeFilterCount > 0 && (
            <span aria-hidden="true" className="w-5 h-5 rounded-full bg-cream text-warm-700 text-xs flex items-center justify-center font-bold">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            id="library-filters"
            className="overflow-hidden"
          >
            <div className="card-warm grid grid-cols-1 gap-4 p-4 sm:flex sm:flex-wrap">
              {/* Sort */}
              <div className="flex min-w-0 flex-col gap-1">
                <label htmlFor="library-sort" className="text-xs font-medium text-warm-700 flex items-center gap-1">
                  <BookOpen className="w-3 h-3" />
                  Sort
                </label>
                <select
                  id="library-sort"
                  value={sortBy}
                  onChange={(e) => onSortChange(e.target.value)}
                  className="w-full bg-cream border border-warm-500 rounded-lg px-3 py-2 text-base text-warm-700 focus:outline-none focus:ring-2 focus:ring-warm-700 sm:w-auto sm:text-sm"
                >
                  <option value="title">By Title</option>
                  <option value="author">By Author</option>
                  <option value="rating">By Rating</option>
                  <option value="recent">Recently Added</option>
                </select>
              </div>

              {/* Owner filter */}
              <div className="flex min-w-0 flex-col gap-1">
                <label htmlFor="library-owner" className="text-xs font-medium text-warm-700 flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  Owner
                </label>
                <select
                  id="library-owner"
                  value={filterOwner}
                  onChange={(e) => onFilterOwnerChange(e.target.value)}
                  className="w-full bg-cream border border-warm-500 rounded-lg px-3 py-2 text-base text-warm-700 focus:outline-none focus:ring-2 focus:ring-warm-700 sm:w-auto sm:text-sm"
                >
                  <option value="">Anyone</option>
                  <option value="__any">At least 1 person</option>
                  {owners.map((owner) => (
                    <option key={owner.id} value={owner.id}>
                      {owner.firstName}
                    </option>
                  ))}
                </select>
              </div>

              {/* Category filter */}
              {categories.length > 0 && (
                <div className="flex min-w-0 flex-col gap-1">
                  <label htmlFor="library-category" className="text-xs font-medium text-warm-700 flex items-center gap-1">
                    <BookOpen className="w-3 h-3" />
                    Category
                  </label>
                  <select
                    id="library-category"
                    value={filterCategory}
                    onChange={(e) => onFilterCategoryChange(e.target.value)}
                    className="w-full bg-cream border border-warm-500 rounded-lg px-3 py-2 text-base text-warm-700 focus:outline-none focus:ring-2 focus:ring-warm-700 sm:w-auto sm:max-w-52 sm:text-sm"
                  >
                    <option value="">All Categories</option>
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Read by filter */}
              <div className="flex min-w-0 flex-col gap-1">
                <label htmlFor="library-read-by" className="text-xs font-medium text-warm-700 flex items-center gap-1">
                  <Eye className="w-3 h-3" />
                  Read by
                </label>
                <select
                  id="library-read-by"
                  value={filterReadBy}
                  onChange={(e) => onFilterReadByChange(e.target.value)}
                  className="w-full bg-cream border border-warm-500 rounded-lg px-3 py-2 text-base text-warm-700 focus:outline-none focus:ring-2 focus:ring-warm-700 sm:w-auto sm:text-sm"
                >
                  <option value="">Anyone</option>
                  <option value="__any">At least 1 person</option>
                  {readers.map((reader) => (
                    <option key={reader.id} value={reader.id}>
                      {reader.firstName}
                    </option>
                  ))}
                </select>
              </div>

              {/* Currently reading filter */}
              <div className="flex min-w-0 flex-col gap-1">
                <label htmlFor="library-reading-now" className="text-xs font-medium text-warm-700 flex items-center gap-1">
                  <BookMarked className="w-3 h-3" />
                  Reading now
                </label>
                <select
                  id="library-reading-now"
                  value={filterCurrentlyReading}
                  onChange={(e) => onFilterCurrentlyReadingChange(e.target.value)}
                  className="w-full bg-cream border border-warm-500 rounded-lg px-3 py-2 text-base text-warm-700 focus:outline-none focus:ring-2 focus:ring-warm-700 sm:w-auto sm:text-sm"
                >
                  <option value="">Anyone</option>
                  <option value="__any">At least 1 person</option>
                  {currentlyReadingUsers.map((reader) => (
                    <option key={reader.id} value={reader.id}>
                      {reader.firstName}
                    </option>
                  ))}
                </select>
              </div>

              {/* Clear filters */}
              {activeFilterCount > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    onFilterOwnerChange("");
                    onFilterCategoryChange("");
                    onFilterReadByChange("");
                    onFilterCurrentlyReadingChange("");
                  }}
                  className="min-h-11 self-end text-xs text-warm-700 hover:text-warm-900 underline decoration-warm-500 py-1.5"
                >
                  Clear all
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
