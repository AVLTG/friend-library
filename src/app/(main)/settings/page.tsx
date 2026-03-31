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
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  useEffect(() => {
    fetchTokens();
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

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="font-serif text-3xl font-bold text-warm-900 mb-2">
        Settings
      </h1>
      <p className="text-warm-500 text-sm mb-8">
        Manage invites and account settings
      </p>

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
