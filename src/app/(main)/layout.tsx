"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ApiError, apiErrorMessage, apiFetch } from "@/lib/api-client";
import { successResponseSchema } from "@/lib/api-types";
import {
  BookOpen,
  Library,
  Plus,
  Settings,
  LogOut,
  User,
  Menu,
  X,
  BookMarked,
} from "lucide-react";

const navItems = [
  { href: "/library", label: "Shared Library", icon: Library },
  { href: "/reading", label: "Reading Now", icon: BookMarked },
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
  const [logoutPending, setLogoutPending] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const logoutRequestRef = useRef(false);
  const mobileMenuButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!mobileMenuOpen) return;

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setMobileMenuOpen(false);
      mobileMenuButtonRef.current?.focus();
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [mobileMenuOpen]);

  function isActive(href: string) {
    return pathname === href || (href !== "/library" && pathname.startsWith(href));
  }

  async function handleLogout() {
    if (logoutRequestRef.current) return;
    logoutRequestRef.current = true;
    setLogoutPending(true);
    setLogoutError(null);

    try {
      await apiFetch(
        "/api/auth/logout",
        successResponseSchema,
        { method: "POST" },
        { redirectOnUnauthorized: false },
      );
      router.push("/login");
      router.refresh();
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        router.push("/login");
        router.refresh();
        return;
      }
      setLogoutError(apiErrorMessage(error, "Unable to sign out"));
    } finally {
      logoutRequestRef.current = false;
      setLogoutPending(false);
    }
  }

  return (
    <div className="min-h-screen bg-cream">
      <a
        href="#main-content"
        className="fixed left-4 top-3 z-[100] -translate-y-20 rounded-lg bg-cream px-4 py-2 font-medium text-warm-900 shadow-lg transition-transform focus:translate-y-0"
      >
        Skip to main content
      </a>
      {/* Header */}
      <header className="sticky top-0 z-50 bg-warm-800 text-cream shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link
              href="/library"
              aria-label="BookShare shared library"
              className="flex items-center gap-2.5"
            >
              <div className="w-9 h-9 bg-warm-600 rounded-lg flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-cream" />
              </div>
              <span className="font-serif text-xl font-bold hidden sm:block">
                BookShare
              </span>
            </Link>

            {/* Desktop Nav */}
            <nav aria-label="Primary" className="hidden lg:flex items-center gap-1">
              {navItems.map((item) => {
                const itemIsActive = isActive(item.href);
                const isLibrary =
                  item.href === "/library" &&
                  (pathname === "/library" ||
                    pathname.startsWith("/library/"));

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={itemIsActive || isLibrary ? "page" : undefined}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      itemIsActive || isLibrary
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
            <div className="hidden lg:flex items-center gap-2">
              <Link
                href="/profile"
                aria-current={pathname.startsWith("/profile") ? "page" : undefined}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-warm-300 hover:text-cream hover:bg-warm-700/50 transition-colors text-sm"
              >
                <User className="w-4 h-4" />
                My Library
              </Link>
              <button
                onClick={handleLogout}
                disabled={logoutPending}
                aria-label={logoutPending ? "Signing out" : "Sign out"}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-warm-300 hover:text-cream hover:bg-warm-700/50 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>

            {/* Mobile Menu Button */}
            <button
              ref={mobileMenuButtonRef}
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-navigation"
              className="flex h-11 w-11 items-center justify-center rounded-lg text-warm-300 hover:bg-warm-700/50 hover:text-cream lg:hidden"
            >
              {mobileMenuOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>

        {logoutError && (
          <div
            role="alert"
            className="max-w-7xl mx-auto px-4 sm:px-6 pb-3 text-xs text-red-100"
          >
            {logoutError}. Please try again.
          </div>
        )}

        {/* Mobile Menu */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              id="mobile-navigation"
              className="overflow-hidden border-t border-warm-700 lg:hidden"
            >
              <nav aria-label="Mobile" className="space-y-1 px-4 py-3">
                {navItems.map((item) => {
                  const itemIsActive = isActive(item.href);
                  return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    aria-current={itemIsActive ? "page" : undefined}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                      itemIsActive
                        ? "bg-warm-700 text-cream"
                        : "text-warm-300 hover:text-cream hover:bg-warm-700/50"
                    }`}
                  >
                    <item.icon className="w-5 h-5" />
                    {item.label}
                  </Link>
                  );
                })}
                <Link
                  href="/profile"
                  onClick={() => setMobileMenuOpen(false)}
                  aria-current={pathname.startsWith("/profile") ? "page" : undefined}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                    pathname.startsWith("/profile")
                      ? "bg-warm-700 text-cream"
                      : "text-warm-300 hover:text-cream hover:bg-warm-700/50"
                  }`}
                >
                  <User className="w-5 h-5" />
                  My Library
                </Link>
                <button
                  onClick={handleLogout}
                  disabled={logoutPending}
                  className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-warm-300 hover:text-cream hover:bg-warm-700/50 transition-colors w-full disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <LogOut className="w-5 h-5" />
                  {logoutPending ? "Signing Out..." : "Sign Out"}
                </button>
              </nav>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* Content */}
      <main id="main-content" tabIndex={-1}>{children}</main>
    </div>
  );
}
