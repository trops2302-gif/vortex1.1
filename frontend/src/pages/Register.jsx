import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Zap, Mail, Lock, User, Loader2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

export default function Register() {
  const { register, formatApiError } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await register(name, email, password);
      navigate("/app");
    } catch (err) {
      setError(formatApiError(err.response?.data?.detail) || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0E1012] px-4 py-8">
      <div className="pointer-events-none absolute inset-0 vx-grid-bg opacity-50" />
      <div className="pointer-events-none absolute left-1/2 top-0 h-80 w-[600px] -translate-x-1/2 rounded-full bg-violet-600/10 blur-[120px]" />
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 w-full max-w-md rounded-md border border-white/10 bg-[#16181B] p-8"
      >
        <Link to="/" className="mb-6 flex items-center justify-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-500/15 vx-glow-border">
            <Zap className="h-5 w-5 text-cyan-400" strokeWidth={2.5} />
          </div>
          <span className="font-display text-3xl font-black">Vortex</span>
        </Link>
        <h1 className="text-center font-display text-2xl font-bold tracking-wide">Criar conta</h1>
        <p className="mb-6 text-center text-sm text-slate-400">Grátis para começar a jogar</p>

        {error && (
          <div data-testid="register-error" className="mb-4 rounded-lg border border-red-500/30 bg-red-950/30 px-4 py-2.5 text-sm text-red-300">
            {error}
          </div>
        )}

        <form onSubmit={submit} className="space-y-4">
          <div className="relative">
            <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              data-testid="register-name-input"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Seu nome"
              className="w-full rounded-xl border border-white/10 bg-black/30 py-3 pl-10 pr-4 text-sm text-white outline-none transition-colors placeholder:text-slate-500 focus:border-cyan-400"
            />
          </div>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              data-testid="register-email-input"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              className="w-full rounded-xl border border-white/10 bg-black/30 py-3 pl-10 pr-4 text-sm text-white outline-none transition-colors placeholder:text-slate-500 focus:border-cyan-400"
            />
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              data-testid="register-password-input"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Senha (mín. 6 caracteres)"
              className="w-full rounded-xl border border-white/10 bg-black/30 py-3 pl-10 pr-4 text-sm text-white outline-none transition-colors placeholder:text-slate-500 focus:border-cyan-400"
            />
          </div>
          <button
            data-testid="register-submit-button"
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-600 py-3 font-display text-lg font-bold tracking-wide text-white transition-all hover:bg-cyan-500 disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Criar conta"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-400">
          Já tem conta?{" "}
          <Link to="/login" data-testid="go-login-link" className="font-semibold text-cyan-400 hover:underline">
            Entrar
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
