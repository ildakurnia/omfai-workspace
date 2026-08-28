"use client";
// Halaman Konfirmasi Piket Kantor OMFAI (Auto-deployed via GitHub Actions)

import React, { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  Clock,
  Upload,
  Calendar,
  User,
  Sparkles,
  AlertCircle,
  Loader2,
  FileText,
  Image as ImageIcon,
  Check,
  ArrowLeft,
} from "lucide-react";
import api from "@/lib/api";
import { formatIndonesianDate } from "@/lib/utils";

function PiketConfirmContent() {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || searchParams.get("t");

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isMorningChecked, setIsMorningChecked] = useState(false);
  const [isAfternoonChecked, setIsAfternoonChecked] = useState(false);

  // Query details by token
  const { data, isLoading, error } = useQuery({
    queryKey: ["piketConfirmDetails", token],
    queryFn: async () => {
      if (!token) throw new Error("Token tidak valid");
      const res = await api.get(`/piket/confirm/${token}`);
      return res.data.data;
    },
    enabled: !!token,
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const confirmMutation = useMutation({
    mutationFn: async () => {
      if (!token) throw new Error("Token tidak ada");
      const formData = new FormData();
      if (selectedFile) {
        formData.append("proof_image", selectedFile);
      }
      if (notes) {
        formData.append("notes", notes);
      }

      const res = await api.post(`/piket/confirm/${token}`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["piketConfirmDetails", token] });
      queryClient.invalidateQueries({ queryKey: ["piketToday"] });
      setIsSuccess(true);
      setErrorMessage(null);
      if (typeof window !== "undefined") {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    },
    onError: (err: any) => {
      setErrorMessage(err.response?.data?.message || "Gagal menyimpan konfirmasi piket.");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    confirmMutation.mutate();
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl border border-zinc-200 shadow-sm max-w-md w-full text-center space-y-4">
          <AlertCircle className="h-12 w-12 text-rose-500 mx-auto" />
          <h2 className="text-lg font-bold text-zinc-900">Token Tautan Tidak Valid</h2>
          <p className="text-xs text-zinc-500 font-medium">Tautan konfirmasi piket ini tidak valid atau sudah tidak berlaku.</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-[#FF8200]" />
          <p className="text-xs font-bold text-zinc-500">Memuat data konfirmasi piket...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl border border-zinc-200 shadow-sm max-w-md w-full text-center space-y-4">
          <AlertCircle className="h-12 w-12 text-rose-500 mx-auto" />
          <h2 className="text-lg font-bold text-zinc-900">Tautan Kadaluarsa / Tidak Ditemukan</h2>
          <p className="text-xs text-zinc-500 font-medium">Data konfirmasi piket tidak ditemukan di sistem.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50/40 via-zinc-50 to-zinc-50 flex items-center justify-center p-4 md:p-6">
      <div className="max-w-lg w-full bg-white rounded-3xl border border-zinc-200 shadow-xl overflow-hidden">
        {/* Header Banner */}
        <div className="bg-gradient-to-r from-orange-500 via-[#FF8200] to-amber-500 p-6 text-white text-center relative overflow-hidden">
          <a
            href="/dashboard"
            className="absolute top-4 left-4 bg-white/20 hover:bg-white/30 text-white text-xs font-bold px-3 py-1.5 rounded-xl backdrop-blur-md transition-all flex items-center gap-1.5 cursor-pointer border border-white/20 shadow-2xs"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Dashboard
          </a>
          <div className="absolute -right-6 -bottom-6 opacity-10">
            <Sparkles className="w-32 h-32" />
          </div>
          <div className="inline-flex p-3 bg-white/20 backdrop-blur-md rounded-2xl mb-3 shadow-inner">
            <Sparkles className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-xl font-black tracking-wide">Konfirmasi Piket Kantor</h1>
          <p className="text-xs opacity-90 font-medium mt-1">Siram Bunga & Kebersihan Harian OMFAI Workspace</p>
        </div>

        <div className="p-6 space-y-6">
          {/* Card Info Petugas */}
          <div className="bg-zinc-50 border border-zinc-200/80 rounded-2xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-orange-100 border border-orange-200 flex items-center justify-center text-[#FF8200] font-bold text-sm">
                <User className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">Petugas Piket</p>
                <p className="text-sm font-extrabold text-zinc-900">{data.employee_name}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">Tanggal</p>
              <p className="text-xs font-bold text-zinc-800">{formatIndonesianDate(data.date)}</p>
            </div>
          </div>

          {/* Info Status jika sudah pernah diisi */}
          {data.is_completed && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-center space-y-2 animate-fade-in">
              <div className="inline-flex items-center gap-2 text-emerald-900 font-extrabold text-xs">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                Piket Hari Ini Sudah Terisi
                {data.completed_at && ` (Pukul ${new Date(data.completed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} WIB)`}
              </div>
              <p className="text-[11px] text-emerald-700 font-medium leading-relaxed">
                Anda dapat melengkapi checklist tugas sore (Membuang Sampah) atau mengunggah foto bukti baru di bawah ini.
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
              {/* Checklist Tugas */}
              <div className="space-y-3">
                <p className="text-xs font-extrabold uppercase tracking-wider text-zinc-400">Checklist Tugas Piket (Centang yang Sudah Dikerjakan)</p>
                <div className="space-y-2.5">
                  <label className={`flex items-center gap-3 p-3.5 rounded-xl border text-xs font-bold transition-all cursor-pointer select-none ${
                    isMorningChecked ? "bg-emerald-50/70 border-emerald-300 text-emerald-950 shadow-2xs" : "bg-zinc-50 border-zinc-200 text-zinc-700 hover:bg-zinc-100/70"
                  }`}>
                    <input
                      type="checkbox"
                      checked={isMorningChecked}
                      onChange={(e) => setIsMorningChecked(e.target.checked)}
                      className="h-4.5 w-4.5 rounded-md border-zinc-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer accent-emerald-600"
                    />
                    <span>🌸 Menyiram Bunga & Tanaman (Sesi Pagi)</span>
                  </label>

                  <label className={`flex items-center gap-3 p-3.5 rounded-xl border text-xs font-bold transition-all cursor-pointer select-none ${
                    isAfternoonChecked ? "bg-emerald-50/70 border-emerald-300 text-emerald-950 shadow-2xs" : "bg-zinc-50 border-zinc-200 text-zinc-700 hover:bg-zinc-100/70"
                  }`}>
                    <input
                      type="checkbox"
                      checked={isAfternoonChecked}
                      onChange={(e) => setIsAfternoonChecked(e.target.checked)}
                      className="h-4.5 w-4.5 rounded-md border-zinc-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer accent-emerald-600"
                    />
                    <span>🗑️ Membuang Sampah Harian (Sesi Sore)</span>
                  </label>
                </div>
              </div>

              {/* Upload Foto (Opsional) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-extrabold uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
                    <ImageIcon className="h-3.5 w-3.5 text-[#FF8200]" />
                    Upload Foto Bukti
                  </label>
                  <span className="text-[10px] font-bold text-orange-600 bg-orange-50 border border-orange-200 px-2 py-0.5 rounded-full">
                    Opsional
                  </span>
                </div>

                {previewUrl ? (
                  <div className="relative rounded-2xl overflow-hidden border border-zinc-200 group">
                    <img src={previewUrl} alt="Preview Bukti" className="w-full h-48 object-cover" />
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedFile(null);
                        setPreviewUrl(null);
                      }}
                      className="absolute top-2 right-2 bg-zinc-900/80 hover:bg-zinc-900 text-white p-1.5 rounded-xl text-xs font-bold transition-all backdrop-blur-sm cursor-pointer"
                    >
                      Ganti Foto
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center p-5 border-2 border-dashed border-zinc-200 hover:border-[#FF8200] rounded-2xl bg-zinc-50/50 hover:bg-orange-50/30 transition-all cursor-pointer group">
                    <Upload className="h-7 w-7 text-zinc-400 group-hover:text-[#FF8200] transition-colors mb-1.5" />
                    <p className="text-xs font-bold text-zinc-700">Pilih Foto atau Ambil Kamera</p>
                    <p className="text-[10px] text-zinc-400 mt-0.5">JPG, PNG up to 5MB</p>
                    <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                  </label>
                )}
              </div>

              {/* Catatan Tambahan (Opsional) */}
              <div className="space-y-1.5">
                <label className="text-xs font-extrabold uppercase tracking-wider text-zinc-500">
                  Catatan (Opsional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Tambahkan catatan jika ada kendala / info..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full rounded-xl border border-zinc-200 px-3.5 py-2.5 text-xs font-medium text-zinc-800 focus:outline-none focus:ring-2 focus:ring-[#FF8200]"
                />
              </div>

              {errorMessage && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-bold">
                  {errorMessage}
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={confirmMutation.isPending}
                className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-extrabold py-3.5 px-4 rounded-xl shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer text-sm disabled:opacity-50"
              >
                {confirmMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Menyimpan & Mengirim Notifikasi...
                  </>
                ) : (
                  <>
                    <Check className="h-4.5 w-4.5" />
                    Ceklis & Selesaikan Piket
                  </>
                )}
              </button>

              {/* Tombol Kembali ke Dashboard */}
              <a
                href="/dashboard"
                className="w-full bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-bold py-3 px-4 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer text-xs border border-zinc-200 mt-3"
              >
                <ArrowLeft className="h-4 w-4" />
                Kembali ke Dashboard
              </a>
            </form>
        </div>
      </div>
    </div>
  );
}

export default function PiketConfirmPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-[#FF8200]" />
            <p className="text-xs font-bold text-zinc-500">Memuat data konfirmasi piket...</p>
          </div>
        </div>
      }
    >
      <PiketConfirmContent />
    </Suspense>
  );
}
