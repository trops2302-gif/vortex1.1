import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { LogOut, User } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

const NAV = [
  { to: "/app", label: "Início", end: true, id: "dashboard" },
  { to: "/app/mygames", label: "Meus Jogos", id: "mygames" },
  { to: "/app/host", label: "Host do PC", id: "host", admin: true },
  { to: "/app/history", label: "Histórico", id: "history" },
  { to: "/app/servers", label: "Servidores", id: "servers" },
];

function Logo() {
  return (
    <div className="flex items-center gap-2" data-testid="brand-logo">
      <svg viewBox="0 0 32 32" className="h-7 w-7"><circle cx="16" cy="16" r="15" fill="#107C10" /><path d="M9 10l7 13 7-13" stroke="#fff" strokeWidth="3.2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
      <span className="font-display text-lg font-extrabold tracking-tight">Vortex</span>
    </div>
  );
}

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const items = NAV.filter((n) => !n.admin || user?.role === "admin");

  const doLogout = async () => {
    await logout();
    navigate("/login");
  };

  const link = ({ isActive }) =>
    `relative whitespace-nowrap px-3 py-2 text-sm font-semibold transition-colors ${isActive ? "text-white after:absolute after:inset-x-3 after:-bottom-[13px] after:h-[3px] after:bg-cyan-500" : "text-slate-400 hover:text-white"}`;

  return (
    <div className="min-h-screen bg-[#0E1012] text-slate-100">
      <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-[#0E1012]/95 backdrop-blur-lg">
        <div className="mx-auto flex max-w-[1600px] items-center gap-6 px-4 py-3 sm:px-8">
          <Logo />
          <nav className="hidden flex-1 items-center gap-1 lg:flex">
            {items.map((n) => (
              <NavLink key={n.id} to={n.to} end={n.end} data-testid={`nav-${n.id}-link`} className={link}>{n.label}</NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <NavLink to="/app/profile" data-testid="nav-profile-link" className="flex items-center gap-2 rounded-full bg-white/[0.06] py-1 pl-1 pr-3 text-sm hover:bg-white/10">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-cyan-600 text-xs font-bold">{(user?.name || "U")[0].toUpperCase()}</span>
              <span className="hidden max-w-[120px] truncate sm:block">{user?.name}</span>
              <User className="h-3.5 w-3.5 text-slate-500 sm:hidden" />
            </NavLink>
            <button data-testid="logout-button" onClick={doLogout} title="Sair" className="rounded-full p-2 text-slate-400 hover:bg-white/10 hover:text-white">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
        <nav className="vx-row gap-0 border-t border-white/[0.04] px-2 lg:hidden" data-testid="mobile-nav">
          {items.map((n) => (
            <NavLink key={n.id} to={n.to} end={n.end} data-testid={`mnav-${n.id}-link`} className={({ isActive }) => `whitespace-nowrap px-3 py-2.5 text-sm font-semibold ${isActive ? "text-white shadow-[inset_0_-3px_0_#107C10]" : "text-slate-400"}`}>{n.label}</NavLink>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-[1600px] px-4 py-6 sm:px-8 sm:py-8">{children}</main>
    </div>
  );
}
