"use client";

import { useEffect, useState } from "react";
import { User } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { DashboardNav } from "@/components/dashboard/dashboard-nav";
import { getSupabaseBrowser } from "@/lib/supabase-browser-client";
import {
  Key,
  Plus,
  Copy,
  Trash2,
  CheckCircle,
  ArrowLeft,
} from "lucide-react";

interface ApiKey {
  id: string;
  name: string;
  last_used_at: string | null;
  created_at: string;
  revoked_at: string | null;
}

export default function ApiKeysPage() {
  const [user, setUser] = useState<User | null>(null);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [createLoading, setCreateLoading] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [createKeyError, setCreateKeyError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const supabase = getSupabaseBrowser();
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        router.push("/");
        return;
      }

      setUser(user);
      await fetchApiKeys(user);
      setLoading(false);
    };

    getUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === "SIGNED_OUT" || !session) {
          router.push("/");
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [router]);

  const fetchApiKeys = async (currentUser: User) => {
    const supabase = getSupabaseBrowser();
    const { data: session } = await supabase.auth.getSession();
    if (!session.session?.access_token) return;

    try {
      const response = await fetch("/api/dashboard/keys", {
        headers: {
          "Authorization": `Bearer ${session.session.access_token}`,
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        const result = await response.json();
        setApiKeys(result.data.keys || []);
      }
    } catch (error) {
      console.error("Error fetching API keys:", error);
    }
  };

  const createApiKey = async () => {
    if (!user || createLoading) return;

    setCreateKeyError(null);
    setCreateLoading(true);
    const supabase = getSupabaseBrowser();
    const { data: session } = await supabase.auth.getSession();
    
    if (!session.session?.access_token) {
      setCreateLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/dashboard/keys", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${session.session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: newKeyName.trim() || `Pi CLI Key - ${new Date().toLocaleDateString()}`,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        setNewlyCreatedKey(result.data.key);
        setNewKeyName("");
        setShowCreateForm(false);
        await fetchApiKeys(user);
      } else {
        let detail = `Couldn’t create API key (${response.status}).`;
        try {
          const errBody = (await response.json()) as {
            error?: { message?: string; code?: string };
          };
          if (typeof errBody?.error?.message === "string") {
            detail = errBody.error.message;
          }
        } catch {
          /* ignore JSON parse */
        }
        setCreateKeyError(detail);
        console.warn("Create API key failed:", detail);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Network error.";
      setCreateKeyError(msg);
      console.error("Error creating API key:", error);
    } finally {
      setCreateLoading(false);
    }
  };

  const copyToClipboard = async (text: string, keyId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(keyId);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur">
        <div className="mx-auto max-w-7xl px-6 py-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-4 md:gap-6">
              <button
                type="button"
                onClick={() => router.push("/dashboard")}
                className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="h-4 w-4" />
                Dashboard
              </button>
              <span className="hidden h-4 w-px bg-border md:block" />
              <Link href="/" className="flex items-center gap-2 text-foreground">
                <span className="text-xl" style={{ fontFamily: "serif" }}>
                  π
                </span>
                <span className="text-sm font-medium uppercase tracking-wide">Pi CLI</span>
              </Link>
              <DashboardNav />
            </div>
          </div>
          <div className="mt-4">
            <h1 className="text-xl font-semibold">API Keys</h1>
            <p className="text-sm text-muted-foreground">Manage your Pi CLI authentication keys</p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-4xl px-6 py-8">
        {/* New Key Success Message */}
        {newlyCreatedKey && (
          <div className="mb-8 rounded-xl border border-green-200 bg-green-50 p-6 dark:border-green-800 dark:bg-green-900/20">
            <div className="flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-green-800 dark:text-green-200">
                  API Key Created Successfully!
                </h3>
                <p className="text-sm text-green-700 dark:text-green-300 mt-1 mb-3">
                  Save this key now - it won&apos;t be shown again for security reasons.
                </p>
                <div className="flex items-center gap-2 bg-white dark:bg-gray-800 rounded-lg p-3 border">
                  <code className="font-mono text-sm flex-1">{newlyCreatedKey}</code>
                  <button
                    onClick={() => copyToClipboard(newlyCreatedKey, "new-key")}
                    className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {copiedKey === "new-key" ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
              <button
                onClick={() => setNewlyCreatedKey(null)}
                className="p-1 text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* Create New Key */}
        <div className="mb-8 rounded-xl border border-border/50 bg-card p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold">Create New API Key</h2>
              <p className="text-sm text-muted-foreground">
                Generate a new key to authenticate your Pi CLI requests
              </p>
            </div>
            {!showCreateForm && (
              <button
                type="button"
                onClick={() => {
                  setCreateKeyError(null);
                  setShowCreateForm(true);
                }}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                <Plus className="h-4 w-4" />
                New Key
              </button>
            )}
          </div>

          {createKeyError ? (
            <div
              className="mb-4 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive"
              role="alert"
            >
              {createKeyError}
            </div>
          ) : null}

          {showCreateForm && (
            <div className="space-y-4">
              <div>
                <label htmlFor="keyName" className="block text-sm font-medium mb-2">
                  Key Name (optional)
                </label>
                <input
                  id="keyName"
                  type="text"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  placeholder="e.g., My Development Key"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={createApiKey}
                  disabled={createLoading}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {createLoading ? (
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  Create Key
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateForm(false);
                    setNewKeyName("");
                    setCreateKeyError(null);
                  }}
                  className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* API Keys List */}
        <div className="rounded-xl border border-border/50 bg-card">
          <div className="p-6 border-b border-border/50">
            <div className="flex items-center gap-3">
              <Key className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold">Your API Keys</h2>
              <span className="text-sm text-muted-foreground">
                ({apiKeys.length} key{apiKeys.length !== 1 ? "s" : ""})
              </span>
            </div>
          </div>

          {apiKeys.length === 0 ? (
            <div className="p-8 text-center">
              <Key className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No API keys yet</h3>
              <p className="text-muted-foreground mb-4">
                Create your first API key to start using Pi CLI
              </p>
              <button
                onClick={() => setShowCreateForm(true)}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                <Plus className="h-4 w-4" />
                Create First Key
              </button>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {apiKeys.map((key) => (
                <div key={key.id} className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="font-medium">{key.name}</h3>
                      <div className="mt-1 flex items-center gap-4 text-sm text-muted-foreground">
                        <span>Created {formatDate(key.created_at)}</span>
                        {key.last_used_at && (
                          <span>Last used {formatDate(key.last_used_at)}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                        pi_••••••••••••••••••••
                      </span>
                      <button
                        className="p-2 text-muted-foreground hover:text-foreground transition-colors"
                        title="Revoke key"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Usage Instructions */}
        <div id="cli-setup" className="mt-8 scroll-mt-24 rounded-xl border border-border/50 bg-card p-6">
          <h3 className="font-semibold mb-4">Using Your API Key</h3>
          <div className="space-y-4 text-sm">
            <div>
              <h4 className="font-medium mb-2">1. Install Pi CLI</h4>
              <code className="block bg-muted p-2 rounded text-xs">
                npm install -g @pi-api/cli
              </code>
            </div>
            <div>
              <h4 className="font-medium mb-2">2. Authenticate</h4>
              <code className="block bg-muted p-2 rounded text-xs">
                pi auth login --key YOUR_API_KEY
              </code>
            </div>
            <div>
              <h4 className="font-medium mb-2">3. Start Building</h4>
              <code className="block bg-muted p-2 rounded text-xs">
                {`pi "Create a Next.js app with authentication"`}
              </code>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}