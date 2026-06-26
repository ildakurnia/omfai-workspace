"use client";

import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Calendar as CalendarIcon, Plus, Trash2, RefreshCw, X, Loader2 } from "lucide-react";
import DashboardLayout from "@/components/dashboard-layout";
import api from "@/lib/api";
import { formatIndonesianDate } from "@/lib/utils";
import AlertModal from "@/components/alert-modal";
import ConfirmModal from "@/components/confirm-modal";

export default function HolidaysPage() {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [holidayDate, setHolidayDate] = useState("");
  const [holidayName, setHolidayName] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Custom Alert & Confirm Modals State
  const [alertConfig, setAlertConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    variant: "success" | "error" | "warning" | "info";
  }>({
    isOpen: false,
    title: "",
    message: "",
    variant: "success",
  });

  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    variant: "danger" | "warning" | "info";
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: "",
    message: "",
    variant: "danger",
    onConfirm: () => {},
  });

  const showAlert = (message: string, variant: "success" | "error" | "warning" | "info" = "success", title: string = "Informasi") => {
    setAlertConfig({
      isOpen: true,
      title,
      message,
      variant,
    });
  };

  const showConfirm = (
    message: string,
    onConfirm: () => void,
    variant: "danger" | "warning" | "info" = "danger",
    title: string = "Konfirmasi"
  ) => {
    setConfirmConfig({
      isOpen: true,
      title,
      message,
      variant,
      onConfirm: () => {
        onConfirm();
        setConfirmConfig((prev) => ({ ...prev, isOpen: false }));
      },
    });
  };

  // Lock background scroll when modal is open
  useEffect(() => {
    if (isModalOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isModalOpen]);
  const [isSyncing, setIsSyncing] = useState(false);

  // Query: Ambil Semua Hari Libur
  const { data: holidays, isLoading } = useQuery({
    queryKey: ["allHolidays"],
    queryFn: async () => {
      const response = await api.get("/holidays");
      return response.data.data;
    },
  });

  // Mutation: Tambah Hari Libur Kustom
  const addHolidayMutation = useMutation({
    mutationFn: async (data: { date: string; name: string }) => {
      const response = await api.post("/holidays", data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["allHolidays"] });
      closeModal();
    },
    onError: (err: any) => {
      setErrorMsg(err.response?.data?.message || "Gagal menambahkan hari libur.");
    },
  });

  // Mutation: Hapus Hari Libur
  const deleteHolidayMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/holidays/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["allHolidays"] });
    },
  });

  const handleSyncHolidays = async () => {
    setIsSyncing(true);
    try {
      const currentYear = new Date().getFullYear();
      const response = await api.post("/holidays/sync", { year: currentYear });
      showAlert(response.data.message || "Sinkronisasi hari libur berhasil.", "success", "Sinkronisasi Sukses");
      queryClient.invalidateQueries({ queryKey: ["allHolidays"] });
    } catch (err: any) {
      showAlert(err.response?.data?.message || "Gagal menyinkronkan hari libur nasional.", "error", "Sinkronisasi Gagal");
    } finally {
      setIsSyncing(false);
    }
  };

  const openAddModal = () => {
    setHolidayDate("");
    setHolidayName("");
    setIsModalOpen(true);
    setErrorMsg(null);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setHolidayDate("");
    setHolidayName("");
    setErrorMsg(null);
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!holidayDate || !holidayName.trim()) {
      setErrorMsg("Semua field wajib diisi.");
      return;
    }
    addHolidayMutation.mutate({ date: holidayDate, name: holidayName });
  };

  const handleDelete = (id: number, name: string) => {
    showConfirm(
      `Apakah Anda yakin ingin menghapus hari libur "${name}"? Hari ini akan kembali dihitung sebagai hari kerja aktif.`,
      () => {
        deleteHolidayMutation.mutate(id);
      },
      "danger",
      "Hapus Hari Libur"
    );
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-zinc-950">Kalender Hari Libur Perusahaan</h2>
          <p className="text-xs text-zinc-400 font-medium mt-1">
            Sesuaikan tanggal merah resmi dan kustom yang berlaku efektif untuk libur kerja karyawan.
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto shrink-0">
          <button
            onClick={handleSyncHolidays}
            disabled={isSyncing}
            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-white hover:bg-zinc-50 text-zinc-700 text-xs font-bold px-4 py-2.5 rounded-lg border border-zinc-200 shadow-sm transition-all cursor-pointer disabled:opacity-50"
          >
            {isSyncing ? (
              <Loader2 className="h-4 w-4 animate-spin text-zinc-500" />
            ) : (
              <RefreshCw className="h-4 w-4 text-zinc-500" />
            )}
            Tarik Libur Nasional (2026)
          </button>
          
          <button
            onClick={openAddModal}
            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-[#FF8200] hover:bg-[#e07200] text-white text-xs font-bold px-4 py-2.5 rounded-lg shadow-sm transition-all cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            Tambah Libur Kustom
          </button>
        </div>
      </div>

      {/* Tabel Libur */}
      <div className="bg-white rounded-2xl border border-zinc-150 shadow-sm overflow-hidden w-full">
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="space-y-3 p-6 animate-pulse">
              <div className="h-10 bg-zinc-100 rounded" />
              <div className="h-10 bg-zinc-100 rounded" />
            </div>
          ) : !holidays || holidays.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-zinc-400 py-16">
              <CalendarIcon className="h-12 w-12 mb-2 text-zinc-200" />
              <span className="text-sm">Belum ada hari libur terdaftar di sistem.</span>
              <button
                onClick={handleSyncHolidays}
                className="text-[#FF8200] hover:underline font-bold text-xs mt-2"
              >
                Klik untuk menarik otomatis hari libur nasional resmi.
              </button>
            </div>
          ) : (
            <table className="min-w-[600px] md:min-w-full divide-y divide-zinc-150 text-left text-xs">
              <thead className="bg-zinc-50/70">
                <tr className="text-zinc-400 uppercase font-bold tracking-wider">
                  <th className="p-4 pl-6 w-[20%]">Tanggal</th>
                  <th className="p-4 w-[15%]">Hari</th>
                  <th className="p-4 w-[40%]">Nama Hari Libur</th>
                  <th className="p-4 w-[15%]">Tipe Libur</th>
                  <th className="p-4 pr-6 text-center w-[10%]">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 font-medium">
                {holidays.map((item: any) => {
                  const itemDate = new Date(item.date);
                  const daysName = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
                  const dayLabel = daysName[itemDate.getDay()];
                  
                  return (
                    <tr key={item.id} className="text-zinc-700 hover:bg-zinc-50/50">
                      <td className="p-4 pl-6 text-zinc-900 font-bold text-sm">
                        {formatIndonesianDate(itemDate, { month: "long" })}
                      </td>
                      <td className="p-4 text-zinc-500 font-semibold">{dayLabel}</td>
                      <td className="p-4 text-zinc-800 font-semibold">{item.name}</td>
                      <td className="p-4">
                        {item.is_custom ? (
                          <span className="inline-flex items-center bg-orange-50 text-orange-700 px-2 py-0.5 rounded font-bold uppercase text-[9px] border border-orange-100">
                            Kustom Perusahaan
                          </span>
                        ) : (
                          <span className="inline-flex items-center bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded font-bold uppercase text-[9px] border border-zinc-200">
                            Nasional Resmi
                          </span>
                        )}
                      </td>
                      <td className="p-4 pr-6 text-center">
                        <button
                          onClick={() => handleDelete(item.id, item.name)}
                          className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-md transition-all cursor-pointer inline-flex items-center justify-center"
                          title="Hapus Hari Libur"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Modal Add Holiday Custom */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/80 backdrop-blur-sm px-4">
          <div className="bg-white rounded-2xl border border-zinc-100 shadow-2xl w-full max-w-sm p-6 overflow-hidden">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3 mb-5">
              <h3 className="text-sm font-bold text-zinc-950 flex items-center gap-1.5">
                <CalendarIcon className="h-4 w-4 text-[#FF8200]" />
                Tambah Hari Libur Baru
              </h3>
              <button onClick={closeModal} className="p-1 text-zinc-400 hover:text-zinc-700 rounded-lg cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>

            {errorMsg && (
              <div className="rounded-lg bg-red-50 p-3 text-xs font-semibold text-red-600 border border-red-100 mb-4 animate-shake">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1">
                  Tanggal Libur
                </label>
                <input
                  type="date"
                  value={holidayDate}
                  onChange={(e) => setHolidayDate(e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-xs text-zinc-700 focus:outline-none focus:ring-2 focus:ring-[#FF8200] focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1">
                  Nama Hari Libur
                </label>
                <input
                  type="text"
                  value={holidayName}
                  onChange={(e) => setHolidayName(e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 px-3 py-2.5 text-xs text-zinc-950 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#FF8200] focus:border-transparent"
                  placeholder="Contoh: Cuti Bersama Akhir Tahun..."
                />
              </div>

              <div className="pt-4 flex gap-3 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs font-bold py-2.5 rounded-lg transition-all cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={addHolidayMutation.isPending}
                  className="flex-1 flex justify-center items-center bg-[#FF8200] hover:bg-[#e07200] text-white text-xs font-bold py-2.5 rounded-lg transition-all cursor-pointer"
                >
                  {addHolidayMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Menyimpan...
                    </>
                  ) : (
                    "Simpan Hari Libur"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Custom Alert Modal */}
      <AlertModal
        isOpen={alertConfig.isOpen}
        onClose={() => setAlertConfig((prev) => ({ ...prev, isOpen: false }))}
        title={alertConfig.title}
        message={alertConfig.message}
        variant={alertConfig.variant}
      />

      {/* Custom Confirm Modal */}
      <ConfirmModal
        isOpen={confirmConfig.isOpen}
        onClose={() => setConfirmConfig((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={confirmConfig.onConfirm}
        title={confirmConfig.title}
        message={confirmConfig.message}
        variant={confirmConfig.variant}
        confirmText="Ya, Hapus"
        cancelText="Batal"
      />
    </DashboardLayout>
  );
}
