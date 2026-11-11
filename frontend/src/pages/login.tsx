import { useState, type FormEvent } from "react";
import axios from "axios";

import {
  ShieldCheck,
  Eye,
  EyeOff,
  ArrowRight,
} from "lucide-react";

import api from "../services/api";
import type { AuthUser } from "../types/auth";

interface LoginProps {
  onLogin: (user: AuthUser) => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [email, setEmail] = useState("officer@collectiq.demo");
  const [password, setPassword] = useState("Officer@123");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    setError("");
    setLoading(true);

    try {
      const response = await api.post("/api/v1/auth/login", {
        email,
        password,
      });

      localStorage.setItem(
        "collectiq_token",
        response.data.access_token
      );

      const profile = await api.get<AuthUser>("/api/v1/auth/me");

      onLogin(profile.data);
    } catch (err: unknown) {
      localStorage.removeItem("collectiq_token");

      if (axios.isAxiosError<{ detail?: string }>(err)) {
        setError(
          err.response?.data?.detail ||
          "Unable to connect to server."
        );
      } else {
        setError("An unexpected error occurred.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-5xl bg-white rounded-3xl shadow-xl overflow-hidden grid md:grid-cols-2">

        <div className="hidden md:flex bg-slate-950 text-white p-12 flex-col justify-between">
          <div>
            <div className="flex items-center gap-3">
              <ShieldCheck size={30} className="text-blue-400" />
              <h1 className="text-2xl font-bold">CollectIQ</h1>
            </div>

            <div className="mt-20">
              <p className="text-blue-400 text-sm font-semibold">
                INTELLIGENT COLLECTIONS
              </p>

              <h2 className="text-4xl font-bold mt-4 leading-tight">
                Smarter collections.
                <br />
                Better outcomes.
              </h2>

              <p className="text-slate-400 mt-6 leading-relaxed">
                Manage overdue loans, track payment promises and
                prioritize collection activities with AI-powered insights.
              </p>
            </div>
          </div>

          <p className="text-slate-500 text-sm">
            CollectIQ - MSME Collections Management
          </p>
        </div>

        <div className="p-8 md:p-12 flex flex-col justify-center">
          <h2 className="text-3xl font-bold text-slate-900">
            Sign in to CollectIQ
          </h2>

          <p className="text-slate-500 mt-2 mb-8">
            Enter your credentials to access your workspace.
          </p>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold mb-2">
                Email address
              </label>

              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full border rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-2">
                Password
              </label>

              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full border rounded-xl px-4 py-3 pr-12 outline-none focus:ring-2 focus:ring-blue-500"
                />

                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2"
                >
                  {showPassword ? (
                    <EyeOff size={20} />
                  ) : (
                    <Eye size={20} />
                  )}
                </button>
              </div>
            </div>

            {error && (
              <p className="bg-red-50 text-red-700 p-3 rounded-lg text-sm">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl py-3 flex justify-center items-center gap-2 disabled:opacity-60"
            >
              {loading ? "Signing in..." : "Sign in"}

              {!loading && <ArrowRight size={18} />}
            </button>
          </form>

          <div className="mt-8 bg-slate-50 border rounded-xl p-4">
            <p className="font-semibold text-sm mb-3">
              Demo accounts
            </p>

            <button
              type="button"
              onClick={() => {
                setEmail("officer@collectiq.demo");
                setPassword("Officer@123");
              }}
              className="block text-sm text-blue-600 mb-2"
            >
              Field Officer - Rahul Chouhan
            </button>

            <button
              type="button"
              onClick={() => {
                setEmail("manager@collectiq.demo");
                setPassword("Manager@123");
              }}
              className="block text-sm text-blue-600"
            >
              Branch Manager
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}