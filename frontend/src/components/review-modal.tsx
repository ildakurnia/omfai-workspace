"use client";

import React, { useState, useEffect } from "react";
import { X, Loader2, MessageSquarePlus, Save } from "lucide-react";
import api from "@/lib/api";

interface ReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  activity: any;
  onSuccess: () => void;
}

export default function ReviewModal({ isOpen, onClose, activity, onSuccess }: ReviewModalProps) {
  const [feedback, setFeedback] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (activity) {
      setFeedback(activity.owner_feedback || "");
      setError(null);
    }
  }, [activity, isOpen]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  if (!isOpen || !activity) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      await api.post(`/activities/${activity.id}/review`, {
        owner_feedback: feedback.trim() === "" ? null : feedback,
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(
        err.response?.data?.message || 
        "Gagal menyimpan catatan. Silakan coba lagi."
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/80 backdrop-blur-sm p-4 animate-fade-in">
      {/* Backdrop Close Click */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Modal Dialog Body */}
      <div className="relative w-full max-w-md bg-white rounded-2xl border border-zinc-200 shadow-2xl p-6 sm:p-7 z-10 transform transition-all duration-300 scale-100 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-zinc-100">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-orange-50 text-[#FF8200] rounded-xl">
              <MessageSquarePlus className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-950">Catatan Evaluasi Owner</h3>
              <p className="text-xs text-zinc-400 font-semibold mt-0.5">Berikan arahan/review pada aktivitas karyawan</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-lg transition-all cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {error && (
            <div className="p-3 text-xs bg-red-50 border border-red-100 text-red-600 rounded-xl font-semibold">
              {error}
            </div>
          )}

          {/* Activity Info Summary */}
          <div className="p-3.5 bg-zinc-50 border border-zinc-100 rounded-xl space-y-1.5">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Aktivitas Karyawan ({activity.employeeName || activity.user?.name})</span>
            <p className="text-sm text-zinc-800 font-bold break-words whitespace-pre-wrap">{activity.activity}</p>
            <div className="flex items-center gap-2.5 mt-2">
              <span className="text-[10px] bg-zinc-200/60 text-zinc-600 px-2 py-0.5 rounded font-bold uppercase tracking-wide">
                {activity.categoryName || activity.category?.name}
              </span>
              <span className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider">
                Status: {(activity.status || "").replace("_", " ")}
              </span>
            </div>
          </div>

          {/* Feedback Textarea */}
          <div className="space-y-1.5">
            <label htmlFor="owner_feedback" className="block text-xs font-bold uppercase tracking-wider text-zinc-400">
              Ulasan / Catatan Umpan Balik
            </label>
            <textarea
              id="owner_feedback"
              rows={4}
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              className="block w-full rounded-xl border border-zinc-200 p-3 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#FF8200] focus:border-transparent transition-all resize-none"
              placeholder="Tulis instruksi pengerjaan, solusi kendala, atau ulasan hasil di sini..."
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2.5 pt-3 border-t border-zinc-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2.5 text-sm font-bold text-zinc-500 hover:text-zinc-700 hover:bg-zinc-100 rounded-lg transition-all cursor-pointer disabled:opacity-50"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex items-center gap-1.5 px-5 py-2.5 text-sm font-bold text-white bg-[#FF8200] hover:bg-[#e07200] rounded-lg shadow-sm shadow-orange-200 transition-all cursor-pointer disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                <>
                  <Save className="h-3.5 w-3.5" />
                  Simpan Catatan
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
