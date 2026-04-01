"use client";

interface ShelfProps {
  children: React.ReactNode;
}

export default function Shelf({ children }: ShelfProps) {
  return (
    <div className="relative">
      {/* Books container */}
      <div className="relative flex items-end gap-[2px] px-2 pb-0 h-[210px] pt-4">
        {children}
      </div>

      {/* Shelf plank */}
      <div
        className="relative h-[14px]"
        style={{
          background: `linear-gradient(180deg,
            #4A3A28 0%,
            #3E3020 40%,
            #322B22 100%)`,
          boxShadow: `
            0 3px 6px -1px rgba(30, 22, 15, 0.4),
            inset 0 1px 0 rgba(255, 255, 255, 0.08)`,
        }}
      >
        {/* Wood grain */}
        <div
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage: `repeating-linear-gradient(
              90deg,
              transparent,
              transparent 18px,
              rgba(255,255,255,0.03) 18px,
              rgba(255,255,255,0.03) 19px
            ), repeating-linear-gradient(
              90deg,
              transparent,
              transparent 47px,
              rgba(0,0,0,0.06) 47px,
              rgba(0,0,0,0.06) 48px
            )`,
          }}
        />
      </div>
    </div>
  );
}
