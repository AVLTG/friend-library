"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { BookOpen, Eye, EyeOff } from "lucide-react";
import { apiErrorMessage, apiFetch } from "@/lib/api-client";

type RegisterSuccessDto = { success: true };

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-cream flex items-center justify-center">
          <div role="status" className="flex items-center gap-3 text-warm-700">
            <BookOpen className="w-8 h-8 animate-spin" />
            <span className="text-sm">Loading registration...</span>
          </div>
        </main>
      }
    >
      <RegisterForm />
    </Suspense>
  );
}

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [username, setUsername] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [inviteToken, setInviteToken] = useState(
    searchParams.get("token") || ""
  );
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await apiFetch<RegisterSuccessDto>(
        "/api/auth/register",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username,
            firstName,
            lastName,
            password,
            inviteToken,
          }),
        },
        { redirectOnUnauthorized: false },
      );

      router.push("/library");
      router.refresh();
    } catch (error) {
      setError(apiErrorMessage(error, "Unable to create your account"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-cream flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", bounce: 0.5, delay: 0.1 }}
            className="w-20 h-20 bg-warm-700 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg"
          >
            <BookOpen className="w-10 h-10 text-cream" />
          </motion.div>
          <h1 className="font-serif text-3xl font-bold text-warm-900">
            Join BookShare
          </h1>
          <p className="text-warm-600 mt-1">Enter your invite to get started</p>
        </div>

        <div className="card-warm p-5 sm:p-8">
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label htmlFor="register-token" className="block text-sm font-medium text-warm-700 mb-1.5">
                Invite Token
              </label>
              <input
                type="text"
                id="register-token"
                value={inviteToken}
                onChange={(e) => setInviteToken(e.target.value.toUpperCase())}
                className="w-full px-4 py-2.5 bg-cream border border-warm-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-warm-700 focus:border-transparent text-warm-900 placeholder-warm-600 font-mono tracking-widest text-center text-lg"
                placeholder="ABCD1234"
                maxLength={8}
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              <div>
                <label htmlFor="register-first-name" className="block text-sm font-medium text-warm-700 mb-1.5">
                  First Name
                </label>
                <input
                  type="text"
                  id="register-first-name"
                  autoComplete="given-name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-cream border border-warm-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-warm-700 focus:border-transparent text-warm-900 placeholder-warm-600"
                  placeholder="Jane"
                  required
                />
              </div>
              <div>
                <label htmlFor="register-last-name" className="block text-sm font-medium text-warm-700 mb-1.5">
                  Last Name
                </label>
                <input
                  type="text"
                  id="register-last-name"
                  autoComplete="family-name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-cream border border-warm-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-warm-700 focus:border-transparent text-warm-900 placeholder-warm-600"
                  placeholder="Doe"
                  required
                />
              </div>
            </div>

            <div className="mb-4">
              <label htmlFor="register-username" className="block text-sm font-medium text-warm-700 mb-1.5">
                Username
              </label>
              <input
                type="text"
                id="register-username"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-2.5 bg-cream border border-warm-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-warm-700 focus:border-transparent text-warm-900 placeholder-warm-600"
                placeholder="janedoe"
                required
              />
            </div>

            <div className="mb-6">
              <label htmlFor="register-password" className="block text-sm font-medium text-warm-700 mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  id="register-password"
                  autoComplete="new-password"
                  aria-describedby="register-password-help"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-2.5 bg-cream border border-warm-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-warm-700 focus:border-transparent text-warm-900 placeholder-warm-600 pr-12"
                  placeholder="Min 10 chars, mixed case, number, symbol"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-1 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg text-warm-600 hover:bg-warm-100 hover:text-warm-800"
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
              <p id="register-password-help" className="text-xs text-warm-600 mt-1.5">
                Use at least 10 characters with uppercase, lowercase, a number, and a symbol.
              </p>
            </div>

            {error && (
              <motion.div
                role="alert"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm"
              >
                {error}
              </motion.div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-warm-700 text-cream py-3 rounded-lg font-medium hover:bg-warm-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Creating account..." : "Join the Library"}
            </button>
          </form>

          <p className="text-center mt-4 text-sm text-warm-600">
            Already have an account?{" "}
            <Link
              href="/login"
              className="text-warm-700 font-medium hover:underline"
            >
              Sign in
            </Link>
          </p>
        </div>
      </motion.div>
    </main>
  );
}
