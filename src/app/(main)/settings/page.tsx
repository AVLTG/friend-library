"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
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

interface UserProfile {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  avatarColor: string;
}

export default function SettingsPage() {
  const [tokens, setTokens] = useState<InviteToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  // Account state
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [profileMessage, setProfileMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [passwordMessage, setPasswordMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    fetchTokens();
    fetchProfile();
  }, []);

  async function fetchTokens() {
    try {
      const res = await fetch("/api/invite");
      if (res.ok) {
        const data = await res.json();
        setTokens(data);
      }
    } catch (error) {
      console.error("Failed to fetch tokens:", error);
    } finally {
      setLoading(false);
    }
  }

  async function generateToken() {
    setGenerating(true);
    try {
      const res = await fetch("/api/invite", { method: "POST" });
      if (res.ok) {
        fetchTokens();
      }
    } catch (error) {
      console.error("Failed to generate token:", error);
    } finally {
      setGenerating(false);
    }
  }

  function copyToken(token: string) {
    navigator.clipboard.writeText(token);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  }

  function copyInviteLink(token: string) {
    const url = `${window.location.origin}/register?token=${token}`;
    navigator.clipboard.writeText(url);
    setCopiedToken(token + "-link");
    setTimeout(() => setCopiedToken(null), 2000);
  }

  async function fetchProfile() {
    try {
      const res = await fetch("/api/auth/account");
      if (res.ok) {
        const data = await res.json();
        setProfile(data);
        setFirstName(data.firstName);
        setLastName(data.lastName);
        setUsername(data.username);
      }
    } catch (error) {
      console.error("Failed to fetch profile:", error);
    }
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setProfileSaving(true);
    setProfileMessage(null);

    try {
      const res = await fetch("/api/auth/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName, lastName, username }),
      });

      const data = await res.json();
      if (!res.ok) {
        setProfileMessage({ type: "error", text: data.error });
        return;
      }

      setProfileMessage({ type: "success", text: "Profile updated" });
      fetchProfile();
    } catch {
      setProfileMessage({ type: "error", text: "Something went wrong" });
    } finally {
      setProfileSaving(false);
    }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setPasswordSaving(true);
    setPasswordMessage(null);

    if (newPassword !== confirmPassword) {
      setPasswordMessage({ type: "error", text: "New passwords don't match" });
      setPasswordSaving(false);
      return;
    }

    try {
      const res = await fetch("/api/auth/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await res.json();
      if (!res.ok) {
        setPasswordMessage({ type: "error", text: data.error });
        return;
      }

      setPasswordMessage({ type: "success", text: "Password changed" });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      setPasswordMessage({ type: "error", text: "Something went wrong" });
    } finally {
      setPasswordSaving(false);
    }
  }

  const profileChanged =
    profile &&
    (firstName !== profile.firstName ||
      lastName !== profile.lastName ||
      username !== profile.username);

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="font-serif text-3xl font-bold text-warm-900 mb-2">
        Settings
      </h1>
      <p className="text-warm-500 text-sm mb-8">
        Manage your account and invites
      </p>

      {/* Account Settings */}
      {profile && (
        <div className="card-warm p-6 mb-8">
          <div className="flex items-center gap-3 mb-6">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-sm font-bold"
              style={{ backgroundColor: profile.avatarColor }}
            >
              {profile.firstName[0]}{profile.lastName[0]}
            </div>
            <div>
              <h2 className="font-serif text-lg font-bold text-warm-900">
                Account
              </h2>
              <p className="text-warm-500 text-xs">
                Update your display name and username
              </p>
            </div>
          </div>

          <form onSubmit={saveProfile} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-warm-700 mb-1.5">
                  First Name
                </label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-cream border border-warm-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-warm-400 focus:border-transparent text-warm-900 text-sm"
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
                  className="w-full px-4 py-2.5 bg-cream border border-warm-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-warm-400 focus:border-transparent text-warm-900 text-sm"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-warm-700 mb-1.5">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-2.5 bg-cream border border-warm-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-warm-400 focus:border-transparent text-warm-900 text-sm"
                required
              />
            </div>

            {profileMessage && (
              <motion.div
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
              disabled={profileSaving || !profileChanged}
              className="flex items-center gap-2 bg-warm-700 text-cream px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-warm-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-4 h-4" />
              {profileSaving ? "Saving..." : "Save Changes"}
            </button>
          </form>
        </div>
      )}

      {/* Change Password */}
      <div className="card-warm p-6 mb-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-warm-200 rounded-lg flex items-center justify-center">
            <Lock className="w-5 h-5 text-warm-600" />
          </div>
          <div>
            <h2 className="font-serif text-lg font-bold text-warm-900">
              Change Password
            </h2>
            <p className="text-warm-500 text-xs">
              Enter your current password to set a new one
            </p>
          </div>
        </div>

        <form onSubmit={changePassword} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-warm-700 mb-1.5">
              Current Password
            </label>
            <div className="relative">
              <input
                type={showCurrentPassword ? "text" : "password"}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full px-4 py-2.5 bg-cream border border-warm-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-warm-400 focus:border-transparent text-warm-900 text-sm pr-12"
                required
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-warm-400 hover:text-warm-600"
              >
                {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-warm-700 mb-1.5">
              New Password
            </label>
            <div className="relative">
              <input
                type={showNewPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Min 10 chars, mixed case, number, symbol"
                className="w-full px-4 py-2.5 bg-cream border border-warm-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-warm-400 focus:border-transparent text-warm-900 placeholder-warm-300 text-sm pr-12"
                required
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-warm-400 hover:text-warm-600"
              >
                {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-warm-700 mb-1.5">
              Confirm New Password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-2.5 bg-cream border border-warm-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-warm-400 focus:border-transparent text-warm-900 text-sm"
              required
            />
          </div>

          {passwordMessage && (
            <motion.div
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
            disabled={passwordSaving || !currentPassword || !newPassword || !confirmPassword}
            className="flex items-center gap-2 bg-warm-700 text-cream px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-warm-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Lock className="w-4 h-4" />
            {passwordSaving ? "Changing..." : "Change Password"}
          </button>
        </form>
      </div>

      {/* Invite Tokens */}
      <div className="card-warm p-6 mb-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-warm-200 rounded-lg flex items-center justify-center">
              <Key className="w-5 h-5 text-warm-600" />
            </div>
            <div>
              <h2 className="font-serif text-lg font-bold text-warm-900">
                Invite Tokens
              </h2>
              <p className="text-warm-500 text-xs">
                Share tokens to invite friends
              </p>
            </div>
          </div>
          <button
            onClick={generateToken}
            disabled={generating}
            className="flex items-center gap-2 bg-warm-700 text-cream px-4 py-2 rounded-lg text-sm font-medium hover:bg-warm-800 transition-colors disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            {generating ? "..." : "Generate"}
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            >
              <BookOpen className="w-6 h-6 text-warm-400" />
            </motion.div>
          </div>
        ) : tokens.length === 0 ? (
          <p className="text-warm-400 text-sm text-center py-8 italic">
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
                  className={`flex items-center gap-4 p-4 rounded-lg border ${
                    isUsed
                      ? "bg-green-50/50 border-green-200"
                      : isExpired
                      ? "bg-warm-100/50 border-warm-200 opacity-60"
                      : "bg-cream border-warm-200"
                  }`}
                >
                  <code className="font-mono text-lg font-bold tracking-widest text-warm-800 flex-shrink-0">
                    {token.token}
                  </code>

                  <div className="flex-1 min-w-0">
                    {isUsed ? (
                      <div className="flex items-center gap-1.5 text-green-600 text-xs">
                        <User className="w-3.5 h-3.5" />
                        Used
                      </div>
                    ) : isExpired ? (
                      <div className="flex items-center gap-1.5 text-warm-400 text-xs">
                        <Clock className="w-3.5 h-3.5" />
                        Expired
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-warm-500 text-xs">
                        <Clock className="w-3.5 h-3.5" />
                        Expires{" "}
                        {new Date(token.expiresAt).toLocaleDateString()}
                      </div>
                    )}
                  </div>

                  {!isUsed && !isExpired && (
                    <div className="flex gap-1">
                      <button
                        onClick={() => copyToken(token.token)}
                        className="p-2 rounded-lg text-warm-500 hover:bg-warm-100 transition-colors"
                        title="Copy token"
                      >
                        {copiedToken === token.token ? (
                          <Check className="w-4 h-4 text-green-600" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        onClick={() => copyInviteLink(token.token)}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium text-warm-600 hover:bg-warm-100 transition-colors border border-warm-200"
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
      </div>
    </div>
  );
}
