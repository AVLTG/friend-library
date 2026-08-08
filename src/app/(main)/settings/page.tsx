"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { apiErrorMessage, apiFetch } from "@/lib/api-client";
import type { PublicUserDto } from "@/lib/api-types";
import {
  Copy,
  Check,
  Plus,
  Key,
  Clock,
  User,
  BookOpen,
  Eye,
  EyeOff,
  Lock,
  Save,
} from "lucide-react";

interface InviteToken {
  id: string;
  token: string;
  usedBy: string | null;
  usedAt: string | null;
  expiresAt: string;
  createdAt: string;
}

export default function SettingsPage() {
  const [tokens, setTokens] = useState<InviteToken[]>([]);
  const [tokensLoading, setTokensLoading] = useState(true);
  const [tokensError, setTokensError] = useState<string | null>(null);
  const [inviteActionError, setInviteActionError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const tokensRequestRef = useRef<AbortController | null>(null);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Account state
  const [profile, setProfile] = useState<PublicUserDto | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [usernamePassword, setUsernamePassword] = useState("");
  const [showUsernamePassword, setShowUsernamePassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [profileMessage, setProfileMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [passwordMessage, setPasswordMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const profileRequestRef = useRef<AbortController | null>(null);
  const profileEditVersionRef = useRef(0);

  useEffect(() => {
    void fetchTokens();
    void fetchProfile();

    return () => {
      tokensRequestRef.current?.abort();
      tokensRequestRef.current = null;
      profileRequestRef.current?.abort();
      profileRequestRef.current = null;
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, []);

  async function fetchTokens() {
    tokensRequestRef.current?.abort();
    const controller = new AbortController();
    tokensRequestRef.current = controller;
    setTokensLoading(true);
    setTokensError(null);

    try {
      const data = await apiFetch<InviteToken[]>("/api/invite", {
        signal: controller.signal,
      });
      if (tokensRequestRef.current === controller) setTokens(data);
    } catch (error) {
      if (
        tokensRequestRef.current === controller &&
        !(error instanceof DOMException && error.name === "AbortError")
      ) {
        setTokensError(apiErrorMessage(error, "Unable to load invite tokens"));
      }
    } finally {
      if (tokensRequestRef.current === controller) {
        tokensRequestRef.current = null;
        setTokensLoading(false);
      }
    }
  }

  async function generateToken() {
    if (generating) return;
    setGenerating(true);
    setInviteActionError(null);
    try {
      await apiFetch<InviteToken>("/api/invite", { method: "POST" });
      await fetchTokens();
    } catch (error) {
      setInviteActionError(
        apiErrorMessage(error, "Unable to generate an invite token"),
      );
    } finally {
      setGenerating(false);
    }
  }

  async function copyText(text: string, copiedKey: string) {
    setInviteActionError(null);
    try {
      await navigator.clipboard.writeText(text);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      setCopiedToken(copiedKey);
      copyTimerRef.current = setTimeout(() => {
        setCopiedToken(null);
        copyTimerRef.current = null;
      }, 2000);
    } catch {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = null;
      setCopiedToken(null);
      setInviteActionError("Unable to copy to the clipboard");
    }
  }

  async function copyInviteLink(token: string) {
    const url = `${window.location.origin}/register?token=${token}`;
    await copyText(url, token + "-link");
  }

  async function fetchProfile(
    preserveEditsSince = profileEditVersionRef.current,
  ) {
    profileRequestRef.current?.abort();
    const controller = new AbortController();
    profileRequestRef.current = controller;
    setProfileLoading(true);
    setProfileError(null);

    try {
      const data = await apiFetch<PublicUserDto>("/api/auth/account", {
        signal: controller.signal,
      });
      if (profileRequestRef.current === controller) {
        setProfile(data);
        if (profileEditVersionRef.current === preserveEditsSince) {
          setFirstName(data.firstName);
          setLastName(data.lastName);
          setUsername(data.username);
        }
      }
    } catch (error) {
      if (
        profileRequestRef.current === controller &&
        !(error instanceof DOMException && error.name === "AbortError")
      ) {
        setProfileError(apiErrorMessage(error, "Unable to load your account"));
      }
    } finally {
      if (profileRequestRef.current === controller) {
        profileRequestRef.current = null;
        setProfileLoading(false);
      }
    }
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (profileSaving || passwordSaving) return;
    setProfileSaving(true);
    setProfileMessage(null);
    const submittedEditVersion = profileEditVersionRef.current;

    try {
      await apiFetch<{ success: true }>("/api/auth/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName,
          lastName,
          username,
          ...(username !== profile?.username
            ? { currentPassword: usernamePassword }
            : {}),
        }),
      });

      setProfileMessage({ type: "success", text: "Profile updated" });
      setUsernamePassword("");
      await fetchProfile(submittedEditVersion);
    } catch (error) {
      setProfileMessage({
        type: "error",
        text: apiErrorMessage(error, "Unable to update your profile"),
      });
    } finally {
      setProfileSaving(false);
    }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (profileSaving || passwordSaving) return;
    setPasswordSaving(true);
    setPasswordMessage(null);

    if (newPassword !== confirmPassword) {
      setPasswordMessage({ type: "error", text: "New passwords don't match" });
      setPasswordSaving(false);
      return;
    }

    try {
      await apiFetch<{ success: true }>("/api/auth/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      setPasswordMessage({ type: "success", text: "Password changed" });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      setPasswordMessage({
        type: "error",
        text: apiErrorMessage(error, "Unable to change your password"),
      });
    } finally {
      setPasswordSaving(false);
    }
  }

  const profileChanged =
    profile &&
    (firstName !== profile.firstName ||
      lastName !== profile.lastName ||
      username !== profile.username);
  const usernameChanged = profile && username !== profile.username;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="font-serif text-3xl font-bold text-warm-900 mb-2">
        Settings
      </h1>
      <p className="text-warm-600 text-sm mb-8">
        Manage your account and invites
      </p>

      {/* Account Settings */}
      {profileLoading && !profile && (
        <div role="status" className="card-warm p-6 mb-8 flex items-center justify-center gap-3 py-12 text-warm-700">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          >
            <User className="w-6 h-6 text-warm-400" />
          </motion.div>
          <span className="text-sm">Loading your account...</span>
        </div>
      )}

      {profileError && !profile && (
        <div className="card-warm p-4 sm:p-6 mb-8">
          <div role="alert" className="p-3 rounded-lg text-sm bg-red-50 border border-red-200 text-red-700">
            <p>{profileError}</p>
            <button
              type="button"
              onClick={() => void fetchProfile()}
              className="mt-2 font-medium underline underline-offset-2"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {profile && (
        <div className="card-warm p-4 sm:p-6 mb-8">
          <div className="flex items-center gap-3 mb-6">
            <div
              aria-hidden="true"
              className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-sm font-bold"
              style={{ backgroundColor: profile.avatarColor }}
            >
              {profile.firstName[0]}{profile.lastName[0]}
            </div>
            <div>
              <h2 className="font-serif text-lg font-bold text-warm-900">
                Account
              </h2>
              <p className="text-warm-600 text-xs">
                Update your display name and username
              </p>
            </div>
          </div>

          {profileError && (
            <div role="alert" className="p-3 rounded-lg text-sm bg-red-50 border border-red-200 text-red-700 mb-4">
              <p>{profileError}</p>
              <button
                type="button"
                onClick={() => void fetchProfile()}
                className="mt-2 font-medium underline underline-offset-2"
              >
                Retry
              </button>
            </div>
          )}

          <form onSubmit={saveProfile} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="settings-first-name" className="block text-sm font-medium text-warm-700 mb-1.5">
                  First Name
                </label>
                <input
                  type="text"
                  id="settings-first-name"
                  autoComplete="given-name"
                  value={firstName}
                  onChange={(e) => {
                    profileEditVersionRef.current += 1;
                    setFirstName(e.target.value);
                  }}
                  className="w-full px-4 py-2.5 bg-cream border border-warm-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-warm-700 focus:border-transparent text-warm-900 text-base sm:text-sm"
                  required
                />
              </div>
              <div>
                <label htmlFor="settings-last-name" className="block text-sm font-medium text-warm-700 mb-1.5">
                  Last Name
                </label>
                <input
                  type="text"
                  id="settings-last-name"
                  autoComplete="family-name"
                  value={lastName}
                  onChange={(e) => {
                    profileEditVersionRef.current += 1;
                    setLastName(e.target.value);
                  }}
                  className="w-full px-4 py-2.5 bg-cream border border-warm-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-warm-700 focus:border-transparent text-warm-900 text-base sm:text-sm"
                  required
                />
              </div>
            </div>

            <div>
              <label htmlFor="settings-username" className="block text-sm font-medium text-warm-700 mb-1.5">
                Username
              </label>
              <input
                type="text"
                id="settings-username"
                autoComplete="username"
                value={username}
                onChange={(e) => {
                  profileEditVersionRef.current += 1;
                  setUsername(e.target.value);
                }}
                className="w-full px-4 py-2.5 bg-cream border border-warm-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-warm-700 focus:border-transparent text-warm-900 text-base sm:text-sm"
                required
              />
            </div>

            {usernameChanged && (
              <div>
                <label htmlFor="settings-username-password" className="block text-sm font-medium text-warm-700 mb-1.5">
                  Current Password
                </label>
                <div className="relative">
                  <input
                    type={showUsernamePassword ? "text" : "password"}
                    id="settings-username-password"
                    autoComplete="current-password"
                    aria-describedby="settings-username-password-help"
                    value={usernamePassword}
                    onChange={(e) => setUsernamePassword(e.target.value)}
                    className="w-full px-4 py-2.5 pr-12 bg-cream border border-warm-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-warm-700 focus:border-transparent text-warm-900 text-base sm:text-sm"
                    required
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setShowUsernamePassword(!showUsernamePassword)
                    }
                    aria-label={showUsernamePassword ? "Hide current password" : "Show current password"}
                    className="absolute right-1 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg text-warm-600 hover:bg-warm-100 hover:text-warm-800"
                  >
                    {showUsernamePassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
                <p id="settings-username-password-help" className="text-warm-600 text-xs mt-1">
                  Required because your username is used to sign in.
                </p>
              </div>
            )}

            {profileMessage && (
              <motion.div
                role={profileMessage.type === "error" ? "alert" : "status"}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`p-3 rounded-lg text-sm ${
                  profileMessage.type === "success"
                    ? "bg-green-50 border border-green-200 text-green-700"
                    : "bg-red-50 border border-red-200 text-red-700"
                }`}
              >
                {profileMessage.text}
              </motion.div>
            )}

            <button
              type="submit"
              disabled={profileSaving || passwordSaving || !profileChanged}
              className="flex items-center gap-2 bg-warm-700 text-cream px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-warm-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-4 h-4" />
              {profileSaving ? "Saving..." : "Save Changes"}
            </button>
          </form>
        </div>
      )}

      {/* Change Password */}
      <div className="card-warm p-4 sm:p-6 mb-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-warm-200 rounded-lg flex items-center justify-center">
            <Lock className="w-5 h-5 text-warm-600" />
          </div>
          <div>
            <h2 className="font-serif text-lg font-bold text-warm-900">
              Change Password
            </h2>
            <p className="text-warm-600 text-xs">
              Enter your current password to set a new one
            </p>
          </div>
        </div>

        <form onSubmit={changePassword} className="space-y-4">
          <div>
            <label htmlFor="settings-current-password" className="block text-sm font-medium text-warm-700 mb-1.5">
              Current Password
            </label>
            <div className="relative">
              <input
                type={showCurrentPassword ? "text" : "password"}
                id="settings-current-password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full px-4 py-2.5 bg-cream border border-warm-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-warm-700 focus:border-transparent text-warm-900 text-base sm:text-sm pr-12"
                required
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                aria-label={showCurrentPassword ? "Hide current password" : "Show current password"}
                className="absolute right-1 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg text-warm-600 hover:bg-warm-100 hover:text-warm-800"
              >
                {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="settings-new-password" className="block text-sm font-medium text-warm-700 mb-1.5">
              New Password
            </label>
            <div className="relative">
              <input
                type={showNewPassword ? "text" : "password"}
                id="settings-new-password"
                autoComplete="new-password"
                aria-describedby="settings-new-password-help"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Min 10 chars, mixed case, number, symbol"
                className="w-full px-4 py-2.5 bg-cream border border-warm-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-warm-700 focus:border-transparent text-warm-900 placeholder-warm-600 text-base sm:text-sm pr-12"
                required
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                aria-label={showNewPassword ? "Hide new password" : "Show new password"}
                className="absolute right-1 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg text-warm-600 hover:bg-warm-100 hover:text-warm-800"
              >
                {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p id="settings-new-password-help" className="mt-1.5 text-xs text-warm-600">
              Use at least 10 characters with uppercase, lowercase, a number, and a symbol.
            </p>
          </div>

          <div>
            <label htmlFor="settings-confirm-password" className="block text-sm font-medium text-warm-700 mb-1.5">
              Confirm New Password
            </label>
            <input
              type="password"
              id="settings-confirm-password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-2.5 bg-cream border border-warm-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-warm-700 focus:border-transparent text-warm-900 text-base sm:text-sm"
              required
            />
          </div>

          {passwordMessage && (
            <motion.div
              role={passwordMessage.type === "error" ? "alert" : "status"}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`p-3 rounded-lg text-sm ${
                passwordMessage.type === "success"
                  ? "bg-green-50 border border-green-200 text-green-700"
                  : "bg-red-50 border border-red-200 text-red-700"
              }`}
            >
              {passwordMessage.text}
            </motion.div>
          )}

          <button
            type="submit"
            disabled={profileSaving || passwordSaving || !currentPassword || !newPassword || !confirmPassword}
            className="flex items-center gap-2 bg-warm-700 text-cream px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-warm-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Lock className="w-4 h-4" />
            {passwordSaving ? "Changing..." : "Change Password"}
          </button>
        </form>
      </div>

      {/* Invite Tokens */}
      <div className="card-warm p-4 sm:p-6 mb-8">
        <div className="mb-6 flex flex-col items-stretch gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-warm-200 rounded-lg flex items-center justify-center">
              <Key className="w-5 h-5 text-warm-600" />
            </div>
            <div>
              <h2 className="font-serif text-lg font-bold text-warm-900">
                Invite Tokens
              </h2>
              <p className="text-warm-600 text-xs">
                Share tokens to invite friends
              </p>
            </div>
          </div>
          <button
            onClick={generateToken}
            disabled={generating}
            className="flex min-h-11 items-center justify-center gap-2 bg-warm-700 text-cream px-4 py-2 rounded-lg text-sm font-medium hover:bg-warm-800 transition-colors disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            {generating ? "..." : "Generate"}
          </button>
        </div>

        {tokensError && (
          <div role="alert" className="p-3 rounded-lg text-sm bg-red-50 border border-red-200 text-red-700 mb-4">
            <p>{tokensError}</p>
            <button
              type="button"
              onClick={() => void fetchTokens()}
              className="mt-2 font-medium underline underline-offset-2"
            >
              Retry
            </button>
          </div>
        )}

        {inviteActionError && (
          <div role="alert" className="p-3 rounded-lg text-sm bg-red-50 border border-red-200 text-red-700 mb-4">
            {inviteActionError}
          </div>
        )}

        {tokensLoading ? (
          <div role="status" className="flex items-center justify-center gap-3 py-8 text-warm-700">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            >
              <BookOpen className="w-6 h-6 text-warm-400" />
            </motion.div>
            <span className="text-sm">Loading invite tokens...</span>
          </div>
        ) : tokensError && tokens.length === 0 ? null : tokens.length === 0 ? (
          <p className="text-warm-600 text-sm text-center py-8 italic">
            No invite tokens yet. Generate one to invite friends!
          </p>
        ) : (
          <div className="space-y-3">
            {tokens.map((token, i) => {
              const isExpired = new Date(token.expiresAt) < new Date();
              const isUsed = !!token.usedBy;

              return (
                <motion.div
                  key={token.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                   className={`flex flex-col items-stretch gap-3 p-4 rounded-lg border sm:flex-row sm:items-center sm:gap-4 ${
                    isUsed
                      ? "bg-green-50/50 border-green-200"
                      : isExpired
                      ? "bg-warm-100/50 border-warm-200 opacity-60"
                      : "bg-cream border-warm-200"
                  }`}
                >
                  <code className="font-mono text-lg font-bold tracking-widest text-warm-800">
                    {token.token}
                  </code>

                  <div className="flex-1 min-w-0">
                    {isUsed ? (
                      <div className="flex items-center gap-1.5 text-green-800 text-xs">
                        <User className="w-3.5 h-3.5" />
                        Used
                      </div>
                    ) : isExpired ? (
                      <div className="flex items-center gap-1.5 text-warm-700 text-xs">
                        <Clock className="w-3.5 h-3.5" />
                        Expired
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-warm-700 text-xs">
                        <Clock className="w-3.5 h-3.5" />
                        Expires{" "}
                        {new Date(token.expiresAt).toLocaleDateString()}
                      </div>
                    )}
                  </div>

                  {!isUsed && !isExpired && (
                    <div className="flex w-full gap-2 sm:w-auto">
                      <button
                        onClick={() => void copyText(token.token, token.token)}
                        aria-label={copiedToken === token.token ? `Copied token ${token.token}` : `Copy token ${token.token}`}
                        className="flex h-11 w-11 items-center justify-center rounded-lg text-warm-700 hover:bg-warm-100 transition-colors"
                      >
                        {copiedToken === token.token ? (
                          <Check className="w-4 h-4 text-green-600" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        onClick={() => void copyInviteLink(token.token)}
                        className="min-h-11 flex-1 px-3 py-1.5 rounded-lg text-xs font-medium text-warm-700 hover:bg-warm-100 transition-colors border border-warm-500 sm:flex-none"
                      >
                        {copiedToken === token.token + "-link"
                          ? "Copied!"
                          : "Copy Link"}
                      </button>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}
        <p className="sr-only" role="status" aria-live="polite">
          {copiedToken ? "Copied to clipboard" : ""}
        </p>
      </div>
    </div>
  );
}
