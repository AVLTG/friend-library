"use client";

interface ShelfProps {
  children: React.ReactNode;
  shelfIndex: number;
  isEmpty?: boolean;
}

export default function Shelf({ children, isEmpty }: ShelfProps) {
  return (
    <div className="relative">
      {/* Books container */}
      <div className="relative flex items-end gap-[2px] px-4 pb-0 h-[220px] pt-4">
        {children}
        {isEmpty && (
          <div className="flex items-center justify-center w-full h-full text-warm-400/50 text-sm italic font-serif select-none">
            &nbsp;
          </div>
        )}
      </div>

      {/* Shelf plank */}
      <div
        className="relative h-4"
        style={{
          background: `linear-gradient(180deg,
            #B8885A 0%,
            #A67B5B 30%,
            #8B6543 70%,
            #6B4F36 100%)`,
          boxShadow: `
            0 4px 8px -2px rgba(74, 55, 40, 0.3),
            inset 0 1px 0 rgba(255, 255, 255, 0.15)`,
        }}
      >
        {/* Wood grain */}
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage: `repeating-linear-gradient(
              90deg,
              transparent,
              transparent 30px,
              rgba(0,0,0,0.04) 30px,
              rgba(0,0,0,0.04) 31px
            ), repeating-linear-gradient(
              90deg,
              transparent,
              transparent 73px,
              rgba(0,0,0,0.02) 73px,
              rgba(0,0,0,0.02) 75px
            )`,
          }}
        />
      </div>
    </div>
  );
}
