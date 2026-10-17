import React from "react";
import { Play } from "lucide-react";
import { useLaunch } from "@/context/LaunchContext";

export default function GameCard({ game, onInfo }) {
  const { openLaunch } = useLaunch();
  return (
    <div className="group w-full" data-testid={`game-card-${game.id}`}>
      <button
        onClick={() => (onInfo ? onInfo(game) : openLaunch(game))}
        data-testid={onInfo ? `game-info-button-${game.id}` : `launch-game-button-${game.id}`}
        className="vx-tile block aspect-[2/3] w-full"
      >
        <img src={game.cover} alt={game.title} loading="lazy" className="h-full w-full object-cover" />
        <span className="absolute inset-x-0 bottom-0 translate-y-full bg-gradient-to-t from-black/90 to-transparent p-3 pt-8 text-left text-sm font-semibold transition-transform duration-200 group-hover:translate-y-0">
          {game.title}
        </span>
      </button>
      {onInfo && (
        <button data-testid={`launch-game-button-${game.id}`} onClick={() => openLaunch(game)} className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white">
          <Play className="h-3 w-3" /> Jogar
        </button>
      )}
      {!onInfo && <p className="mt-2 truncate text-sm text-slate-300">{game.title}</p>}
    </div>
  );
}
