"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { BookOpen, Eye, EyeOff } from "lucide-react";
import { ApiError, apiErrorMessage, apiFetch } from "@/lib/api-client";

type SetupStatusDto = { needsSetup: boolean };
type AuthSuccessDto = { success: true };
type SetupSuccessDto = AuthSuccessDto & { inviteToken: string };

type SetupRequest =
  | { status: "loading" }
  | { status: "success"; needsSetup: boolean }
  | { status: "error"; message: string };

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [setupRequest, setSetupRequest] = useState<SetupRequest>({
    status: "loading",
  });
  const setupRequestController = useRef<AbortController | null>(null);

  // First-time setup fields
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [setupInviteToken, setSetupInviteToken] = useState("");

  const checkSetup = useCallback(async () => {
    setupRequestController.current?.abort();
    const controller = new AbortController();
    setupRequestController.current = controller;
    setSetupRequest({ status: "loading" });

    try {
      const data = await apiFetch<SetupStatusDto>(
        "/api/auth/check-setup",
        { signal: controller.signal },
        { redirectOnUnauthorized: false },
      );
      if (!controller.signal.aborted) {
        setSetupRequest({ status: "success", needsSetup: data.needsSetup });
      }
    } catch (error) {
      if (
        controller.signal.aborted ||
        (error instanceof DOMException && error.name === "AbortError")
      ) {
        return;
      }
      setSetupRequest({
        status: "error",
        message: apiErrorMessage(
          error,
          "Unable to check whether BookShare is set up",
        ),
      });
    } finally {
      if (setupRequestController.current === controller) {
        setupRequestController.current = null;
      }
    }
  }, []);

  useEffect(() => {
    void checkSetup();
    return () => setupRequestController.current?.abort();
  }, [checkSetup]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await apiFetch<AuthSuccessDto>(
        "/api/auth/login",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password }),
        },
        { redirectOnUnauthorized: false },
      );

      router.push("/library");
      router.refresh();
    } catch (error) {
      setError(apiErrorMessage(error, "Unable to sign in"));
    } finally {
      setLoading(false);
    }
  }

  async function handleSetup(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const data = await apiFetch<SetupSuccessDto>(
        "/api/auth/setup",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, firstName, lastName, password }),
        },
        { redirectOnUnauthorized: false },
      );

      setSetupInviteToken(data.inviteToken);
    } catch (error) {
      if (error instanceof ApiError && error.code === "SETUP_COMPLETED") {
        await checkSetup();
        setError("Setup was completed in another tab. Sign in to continue.");
      } else {
        setError(apiErrorMessage(error, "Unable to create the library"));
      }
    } finally {
      setLoading(false);
    }
  }

  if (setupRequest.status === "loading") {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        >
          <BookOpen className="w-8 h-8 text-warm-500" />
        </motion.div>
      </div>
    );
  }

  if (setupRequest.status === "error") {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center p-4">
        <div className="card-warm p-8 max-w-md w-full text-center">
          <BookOpen className="w-8 h-8 text-warm-500 mx-auto mb-4" />
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {setupRequest.message}
          </div>
          <button
            type="button"
            onClick={() => void checkSetup()}
            className="w-full bg-warm-700 text-cream py-3 rounded-lg font-medium hover:bg-warm-800 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const isSetup = !setupRequest.needsSetup;

  if (setupInviteToken) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="card-warm p-8 max-w-md w-full text-center"
        >
          <div className="w-16 h-16 bg-warm-200 rounded-full flex items-center justify-center mx-auto mb-4">
            <BookOpen className="w-8 h-8 text-warm-700" />
          </div>
          <h2 className="font-serif text-2xl font-bold text-warm-900 mb-2">
            Welcome to BookShare!
          </h2>
          <p className="text-warm-600 mb-6">
            Your library is ready. Share this invite token with your friends:
          </p>
          <div className="bg-warm-100 border-2 border-dashed border-warm-400 rounded-lg p-4 mb-4">
            <code className="text-2xl font-mono font-bold text-warm-800 tracking-widest">
              {setupInviteToken}
            </code>
          </div>
          <p className="text-sm text-warm-500 mb-6">
            This token expires in 7 days. You can generate more from settings.
          </p>
          <button
            onClick={() => {
              router.push("/library");
              router.refresh();
            }}
            className="w-full bg-warm-700 text-cream py-3 rounded-lg font-medium hover:bg-warm-800 transition-colors"
          >
            Enter Your Library
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        {/* Logo */}
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
            BookShare
          </h1>
          <p className="text-warm-500 mt-1">
            {isSetup ? "Welcome back to your library" : "Set up your library"}
          </p>
        </div>

        {/* Form Card */}
        <div className="card-warm p-8">
          <form onSubmit={isSetup ? handleLogin : handleSetup}>
            {!isSetup && (
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="block text-sm font-medium text-warm-700 mb-1.5">
                    First Name
                  </label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full px-4 py-2.5 bg-cream border border-warm-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-warm-400 focus:border-transparent text-warm-900 placeholder-warm-300"
                    placeholder="Jane"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-warm-700 mb-1.5">
                    Last Name
                  </label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="w-full px-4 py-2.5 bg-cream border border-warm-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-warm-400 focus:border-transparent text-warm-900 placeholder-warm-300"
                    placeholder="Doe"
                    required
                  />
                </div>
              </div>
            )}

            <div className="mb-4">
              <label className="block text-sm font-medium text-warm-700 mb-1.5">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-2.5 bg-cream border border-warm-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-warm-400 focus:border-transparent text-warm-900 placeholder-warm-300"
                placeholder="janedoe"
                required
              />
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-warm-700 mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-2.5 bg-cream border border-warm-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-warm-400 focus:border-transparent text-warm-900 placeholder-warm-300 pr-12"
                  placeholder="Min 10 chars, mixed case, number, symbol"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-warm-400 hover:text-warm-600"
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            {error && (
              <motion.div
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
              {loading
                ? "..."
                : isSetup
                ? "Sign In"
                : "Create Library"}
            </button>
          </form>

          {isSetup && (
            <p className="text-center mt-4 text-sm text-warm-500">
              Have an invite?{" "}
              <Link
                href="/register"
                className="text-warm-700 font-medium hover:underline"
              >
                Create an account
              </Link>
            </p>
          )}
        </div>
      </motion.div>
    </div>
  );
}
