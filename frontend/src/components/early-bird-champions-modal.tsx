"use client";

import React, { useEffect, useRef } from "react";
import { Trophy, Crown, Sparkles, X, User as UserIcon, Medal } from "lucide-react";

export interface Champion {
  rank: number;
  employee_id: number;
  user_id: number | null;
  name: string;
  email: string;
  avatar: string | null;
  role: string;
  trophies: number;
  avg_check_in: string;
}

export interface EarlyBirdChampionsData {
  month: number;
  year: number;
  month_name: string;
  month_name_en: string;
  champions: Champion[];
  total_champions: number;
}

interface EarlyBirdChampionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: EarlyBirdChampionsData | null;
}

// Lightweight self-contained confetti particle canvas
function ConfettiCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    const particles: Array<{
      x: number;
      y: number;
      size: number;
      color: string;
      speedX: number;
      speedY: number;
      rotation: number;
      rotationSpeed: number;
      opacity: number;
    }> = [];

    const colors = ["#FF8200", "#FFD700", "#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FFEEAD", "#FFA07A"];

    // Initialize 65 confetti particles
    const width = (canvas.width = canvas.parentElement?.clientWidth || window.innerWidth);
    const height = (canvas.height = canvas.parentElement?.clientHeight || window.innerHeight);

    for (let i = 0; i < 70; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * (height * 0.4) - 20,
        size: Math.random() * 8 + 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        speedX: (Math.random() - 0.5) * 4,
        speedY: Math.random() * 3 + 2,
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 10,
        opacity: Math.random() * 0.7 + 0.3,
      });
    }

    let frameCount = 0;
    const render = () => {
      ctx.clearRect(0, 0, width, height);
      frameCount++;

      particles.forEach((p) => {
        p.x += p.speedX;
        p.y += p.speedY;
        p.rotation += p.rotationSpeed;

        if (p.y > height) {
          p.y = -10;
          p.x = Math.random() * width;
        }

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.globalAlpha = p.opacity;
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        ctx.restore();
      });

      if (frameCount < 350) {
        animationFrameId = requestAnimationFrame(render);
      }
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none z-20 w-full h-full"
    />
  );
}

export default function EarlyBirdChampionsModal({
  isOpen,
  onClose,
  data,
}: EarlyBirdChampionsModalProps) {
  if (!isOpen || !data || !data.champions || data.champions.length === 0) {
    return null;
  }

  const champions = data.champions;
  const firstPlace = champions.find((c) => c.rank === 1) || champions[0];
  const secondPlace = champions.find((c) => c.rank === 2);
  const thirdPlace = champions.find((c) => c.rank === 3);

  const monthYearLabel = data.month_name_en || `${data.month}/${data.year}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-md animate-in fade-in duration-300">
      <div className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-zinc-100 overflow-hidden text-zinc-900 flex flex-col max-h-[92vh]">
        {/* Confetti Animation */}
        <ConfettiCanvas />

        {/* Top Header Background Flare */}
        <div className="absolute top-0 inset-x-0 h-44 bg-linear-to-b from-amber-500/20 via-orange-500/10 to-transparent pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-30 p-2 rounded-full bg-zinc-100/80 hover:bg-zinc-200 text-zinc-500 hover:text-zinc-800 transition-colors cursor-pointer"
          aria-label="Close modal"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Content */}
        <div className="relative z-10 px-6 pt-7 pb-6 flex flex-col items-center text-center overflow-y-auto">
          {/* Trophy Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-50 border border-amber-200/80 shadow-2xs mb-2.5">
            <Trophy className="w-4 h-4 text-amber-600 animate-bounce" />
            <span className="text-[11px] font-black tracking-wider uppercase text-amber-800">
              Monthly Award
            </span>
          </div>

          {/* Titles */}
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-zinc-900 leading-tight">
            🏆 Top 3 Morning Champions
          </h2>
          <p className="text-xs sm:text-sm font-semibold text-zinc-500 mt-1 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-[#FF8200]" />
            Top Morning Achievers — <span className="text-[#FF8200] font-bold">{monthYearLabel}</span>
          </p>

          {/* 3D PODIUM SECTION */}
          <div className="w-full mt-6 mb-4 pt-4 px-2">
            <div className="grid grid-cols-3 gap-2 sm:gap-3 items-end max-w-lg mx-auto">
              {/* --- 2ND PLACE (KIRI) --- */}
              <div className="flex flex-col items-center order-1">
                {secondPlace ? (
                  <>
                    {/* Medal 2nd */}
                    <div className="w-6 h-6 rounded-full bg-slate-200 border border-slate-300 text-slate-700 flex items-center justify-center text-[10px] font-black shadow-2xs mb-1.5">
                      2
                    </div>

                    {/* Avatar */}
                    <div className="relative mb-2">
                      <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full p-0.5 bg-linear-to-br from-slate-300 to-slate-400 shadow-md">
                        <div className="w-full h-full rounded-full overflow-hidden bg-zinc-100 flex items-center justify-center">
                          {secondPlace.avatar ? (
                            <img
                              src={secondPlace.avatar}
                              alt={secondPlace.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <UserIcon className="w-7 h-7 text-zinc-400" />
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Name & Badge */}
                    <p className="text-xs font-bold text-zinc-800 truncate max-w-[100px] sm:max-w-[120px] text-center" title={secondPlace.name}>
                      {secondPlace.name}
                    </p>
                    <span className="text-[10px] font-extrabold text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md mt-1 mb-2">
                      🥈 {secondPlace.trophies} Piala
                    </span>

                    {/* Podium Base 2 */}
                    <div className="w-full h-18 sm:h-22 rounded-t-2xl bg-linear-to-b from-slate-200 to-slate-300/80 border-t-2 border-slate-300 flex flex-col items-center justify-center shadow-inner">
                      <span className="text-2xl sm:text-3xl font-black text-slate-500/80">2</span>
                      <span className="text-[9px] font-bold text-slate-600/90 uppercase tracking-widest">Silver</span>
                    </div>
                  </>
                ) : (
                  <div className="w-full h-18 sm:h-22 rounded-t-2xl bg-zinc-100 border border-dashed border-zinc-300 flex items-center justify-center text-xs text-zinc-400">
                    -
                  </div>
                )}
              </div>

              {/* --- 1ST PLACE (TENGAH - ELEVATED) --- */}
              <div className="flex flex-col items-center order-2 -mt-4 relative">
                {firstPlace && (
                  <>
                    {/* Crown */}
                    <Crown className="w-7 h-7 text-amber-500 animate-pulse drop-shadow-sm mb-0.5" />

                    {/* Avatar with Glowing Ring */}
                    <div className="relative mb-2">
                      <div className="w-18 h-18 sm:w-20 sm:h-20 rounded-full p-1 bg-linear-to-tr from-amber-400 via-yellow-300 to-orange-500 shadow-xl ring-4 ring-amber-300/50">
                        <div className="w-full h-full rounded-full overflow-hidden bg-zinc-100 flex items-center justify-center">
                          {firstPlace.avatar ? (
                            <img
                              src={firstPlace.avatar}
                              alt={firstPlace.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <UserIcon className="w-9 h-9 text-zinc-400" />
                          )}
                        </div>
                      </div>
                      <div className="absolute -bottom-1 -right-1 bg-amber-500 text-white rounded-full p-1 shadow-md border-2 border-white">
                        <Trophy className="w-3.5 h-3.5" />
                      </div>
                    </div>

                    {/* Name & Badge */}
                    <p className="text-xs sm:text-sm font-black text-zinc-900 truncate max-w-[110px] sm:max-w-[135px] text-center" title={firstPlace.name}>
                      {firstPlace.name}
                    </p>
                    <span className="text-[10px] sm:text-xs font-black text-amber-800 bg-amber-100 border border-amber-300 px-2.5 py-0.5 rounded-md mt-1 mb-2 shadow-2xs">
                      🥇 {firstPlace.trophies} Piala
                    </span>

                    {/* Podium Base 1 */}
                    <div className="w-full h-26 sm:h-32 rounded-t-2xl bg-linear-to-b from-amber-400 via-amber-300 to-amber-200 border-t-3 border-amber-300 flex flex-col items-center justify-center shadow-lg relative overflow-hidden">
                      <div className="absolute inset-0 bg-linear-to-t from-orange-500/15 to-transparent pointer-events-none" />
                      <span className="text-3xl sm:text-4xl font-black text-amber-700/80">1</span>
                      <span className="text-[10px] font-black text-amber-800 uppercase tracking-widest">Champion</span>
                    </div>
                  </>
                )}
              </div>

              {/* --- 3RD PLACE (KANAN) --- */}
              <div className="flex flex-col items-center order-3">
                {thirdPlace ? (
                  <>
                    {/* Medal 3rd */}
                    <div className="w-6 h-6 rounded-full bg-amber-700/20 border border-amber-700/30 text-amber-900 flex items-center justify-center text-[10px] font-black shadow-2xs mb-1.5">
                      3
                    </div>

                    {/* Avatar */}
                    <div className="relative mb-2">
                      <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full p-0.5 bg-linear-to-br from-amber-600 to-amber-800 shadow-md">
                        <div className="w-full h-full rounded-full overflow-hidden bg-zinc-100 flex items-center justify-center">
                          {thirdPlace.avatar ? (
                            <img
                              src={thirdPlace.avatar}
                              alt={thirdPlace.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <UserIcon className="w-7 h-7 text-zinc-400" />
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Name & Badge */}
                    <p className="text-xs font-bold text-zinc-800 truncate max-w-[100px] sm:max-w-[120px] text-center" title={thirdPlace.name}>
                      {thirdPlace.name}
                    </p>
                    <span className="text-[10px] font-extrabold text-amber-900 bg-amber-100/70 border border-amber-200 px-2 py-0.5 rounded-md mt-1 mb-2">
                      🥉 {thirdPlace.trophies} Piala
                    </span>

                    {/* Podium Base 3 */}
                    <div className="w-full h-15 sm:h-18 rounded-t-2xl bg-linear-to-b from-amber-600/30 to-amber-700/40 border-t-2 border-amber-600/40 flex flex-col items-center justify-center shadow-inner">
                      <span className="text-2xl sm:text-3xl font-black text-amber-900/60">3</span>
                      <span className="text-[9px] font-bold text-amber-900/80 uppercase tracking-widest">Bronze</span>
                    </div>
                  </>
                ) : (
                  <div className="w-full h-15 sm:h-18 rounded-t-2xl bg-zinc-100 border border-dashed border-zinc-300 flex items-center justify-center text-xs text-zinc-400">
                    -
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Motivational Message */}
          <div className="bg-amber-50/60 border border-amber-200/70 rounded-2xl p-3 w-full max-w-md text-xs text-amber-900 font-medium mb-5">
            👏 <span className="font-bold">Great dedication!</span> Terima kasih atas kedisiplinan dan semangat pagi rekan-rekan. Ayo tingkatkan performa di bulan ini! 🔥
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 w-full max-w-md">
            <button
              onClick={onClose}
              className="flex-1 bg-linear-to-r from-[#FF8200] to-[#e07200] hover:from-[#e07200] hover:to-[#c66500] text-white text-xs sm:text-sm font-black py-3 px-4 rounded-xl transition-all shadow-md hover:shadow-lg active:scale-98 flex items-center justify-center gap-2 cursor-pointer"
            >
              🎉 Celebrate & Keep It Up!
            </button>
            <button
              onClick={onClose}
              className="bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs sm:text-sm font-bold py-3 px-4 rounded-xl transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
