import React from "react";
import RealSessions from "@/components/RealSessions";

export default function History() {
  return (
    <div className="space-y-6" data-testid="history-page">
      <h1 className="font-display text-3xl font-extrabold sm:text-4xl">Histórico</h1>
      <RealSessions />
    </div>
  );
}
