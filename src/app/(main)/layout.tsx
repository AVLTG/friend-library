"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  BookOpen,
  Library,
  Plus,
  Settings,
  LogOut,
  User,
  Menu,
  X,
} from "lucide-react";

const navItems = [
  { href: "/library", label: "Shared Library", icon: Library },
  { href: "/add", label: "Add Book", icon: Plus },
  { href: "/settings", label: "Settings", icon: Settings },
];

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-cream">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-warm-800 text-cream shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link href="/library" className="flex items-center gap-2.5">
              <div className="w-9 h-9 bg-warm-600 rounded-lg flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-cream" />
              </div>
              <span className="font-serif text-xl font-bold hidden sm:block">
                BookShare
              </span>
            </Link>

            {/* Desktop Nav */}
            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== "/library" &&
                    pathname.startsWith(item.href));
                const isLibrary =
                  item.href === "/library" &&
                  (pathname === "/library" ||
                    pathname.startsWith("/library/"));

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActive || isLibrary
                        ? "bg-warm-700 text-cream"
                        : "text-warm-300 hover:text-cream hover:bg-warm-700/50"
                    }`}
                  >
                    <item.icon className="w-4 h-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            {/* Desktop Actions */}
            <div className="hidden md:flex items-center gap-2">
              <Link
                href="/profile"
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-warm-300 hover:text-cream hover:bg-warm-700/50 transition-colors text-sm"
              >
                <User className="w-4 h-4" />
                My Library
              </Link>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-warm-300 hover:text-cream hover:bg-warm-700/50 transition-colors text-sm"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg text-warm-300 hover:text-cream hover:bg-warm-700/50"
            >
              {mobileMenuOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="md:hidden overflow-hidden border-t border-warm-700"
            >
              <div className="px-4 py-3 space-y-1">
                {navItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                      pathname === item.href
                        ? "bg-warm-700 text-cream"
                        : "text-warm-300 hover:text-cream hover:bg-warm-700/50"
                    }`}
                  >
                    <item.icon className="w-5 h-5" />
                    {item.label}
                  </Link>
                ))}
                <Link
                  href="/profile"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-warm-300 hover:text-cream hover:bg-warm-700/50 transition-colors"
                >
                  <User className="w-5 h-5" />
                  My Library
                </Link>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-warm-300 hover:text-cream hover:bg-warm-700/50 transition-colors w-full"
                >
                  <LogOut className="w-5 h-5" />
                  Sign Out
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* Content */}
      <main>{children}</main>
    </div>
  );
}
