"use client";

import { motion } from "framer-motion";

interface ShelfProps {
  children: React.ReactNode;
  shelfIndex: number;
}

export default function Shelf({ children, shelfIndex }: ShelfProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: shelfIndex * 0.15, duration: 0.4 }}
      className="relative"
    >
      {/* Books container */}
      <div className="relative flex items-end gap-[2px] px-6 pb-0 min-h-[220px] pt-4">
        {children}
      </div>

      {/* Shelf plank */}
      <div className="relative h-5 rounded-b-sm shelf-shadow"
        style={{
          background: `linear-gradient(180deg,
            #C4956A 0%,
            #A67B5B 40%,
            #8B6914 70%,
            #6B4F36 100%)`,
        }}
      >
        {/* Wood grain effect */}
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: `repeating-linear-gradient(
              90deg,
              transparent,
              transparent 20px,
              rgba(0,0,0,0.03) 20px,
              rgba(0,0,0,0.03) 21px
            )`,
          }}
        />
        {/* Front edge highlight */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-[#D4A574] rounded-t-sm" />
      </div>

      {/* Shelf bracket shadows */}
      <div className="absolute -bottom-2 left-8 w-4 h-6 bg-warm-700/20 rounded-b-sm" />
      <div className="absolute -bottom-2 right-8 w-4 h-6 bg-warm-700/20 rounded-b-sm" />
    </motion.div>
  );
}
