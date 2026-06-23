"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileDown, FileBarChart2, Filter, Loader2, Calendar } from "lucide-react";
import DashboardLayout from "@/components/dashboard-layout";
import api from "@/lib/api";
import { formatDuration, formatActiveDuration, getDateRange, toLocalDateString, formatIndonesianDate } from "@/lib/utils";

export default function ReportsPage() {
  // States untuk filter pencarian laporan
  const [filterPeriod, setFilterPeriod] = useState("all");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterUser, setFilterUser] = useState("");
  const [filterStartDate, setFilterStartDate] = useState("");
  const [filterEndDate, setFilterEndDate] = useState("");

  const handlePeriodChange = (val: string) => {
    setFilterPeriod(val);
    if (val === "all") {
      setFilterStartDate("");
      setFilterEndDate("");
    } else if (val === "custom") {
      const todayStr = toLocalDateString(new Date());
      setFilterStartDate(todayStr);
      setFilterEndDate(todayStr);
    } else {
      const { startDate, endDate } = getDateRange(val);
      setFilterStartDate(startDate);
      setFilterEndDate(endDate);
    }
  };

  const [isDownloading, setIsDownloading] = useState(false);

  // Query Kategori untuk dropdown filter
  const { data: categories } = useQuery({
    queryKey: ["activeCategoriesForReport"],
    queryFn: async () => {
      const response = await api.get("/categories", { params: { active_only: 1 } });
      return response.data.data;
    },
  });

  // Query Karyawan untuk dropdown filter
  const { data: employees } = useQuery({
    queryKey: ["employeesForReport"],
    queryFn: async () => {
      const response = await api.get("/users");
      return response.data.data;
    },
  });

  // Query: Ambil Semua Hari Libur untuk durasi kerja
  const { data: holidaysData } = useQuery({
    queryKey: ["allHolidaysForReport"],
    queryFn: async () => {
      const response = await api.get("/holidays");
      return response.data.data;
    },
  });

  const holidaySet = React.useMemo(() => {
    return new Set<string>((holidaysData || []).map((h: any) => h.date));
  }, [holidaysData]);

  // Query Preview Laporan Aktivitas
  const { data: reportActivities, isLoading: isReportLoading } = useQuery({
    queryKey: ["reportData", filterCategory, filterStatus, filterStartDate, filterEndDate, filterUser],
    queryFn: async () => {
      const response = await api.get("/reports", {
        params: {
          category_id: filterCategory,
          status: filterStatus,
          start_date: filterStartDate,
          end_date: filterEndDate,
          user_id: filterUser,
        },
      });
      return response.data.data;
    },
  });

  // Fungsi untuk mengunduh PDF secara terintegrasi
  const handleDownloadPdf = async () => {
    setIsDownloading(true);
    try {
      const response = await api.get("/reports/pdf", {
        params: {
          category_id: filterCategory,
          status: filterStatus,
          start_date: filterStartDate,
          end_date: filterEndDate,
          user_id: filterUser,
        },
        responseType: "blob", // Penting: memberitahu Axios untuk memproses data biner (PDF)
      });

      // Membuat URL Blob dan mengunduhnya di browser
      const blob = new Blob([response.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `OMFAI_Workspace_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      alert("Gagal mengunduh file laporan PDF. Silakan periksa koneksi backend.");
    } finally {
      setIsDownloading(false);
    }
  };

  const handleResetFilters = () => {
    setFilterPeriod("all");
    setFilterCategory("");
    setFilterStatus("");
    setFilterUser("");
    setFilterStartDate("");
    setFilterEndDate("");
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-zinc-950">Laporan Aktivitas Kerja</h2>
          <p className="text-sm text-zinc-400 font-semibold mt-1">Cetak dan filter seluruh aktivitas kerja karyawan berdasarkan kriteria tertentu.</p>
        </div>
        <button
          onClick={handleDownloadPdf}
          disabled={isDownloading || !reportActivities || reportActivities.length === 0}
          className="flex items-center gap-2 bg-[#FF8200] hover:bg-[#e07200] disabled:bg-zinc-300 text-white text-sm font-bold px-4 py-2.5 rounded-lg shadow-sm transition-all cursor-pointer disabled:cursor-not-allowed"
        >
          {isDownloading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Mengunduh PDF...
            </>
          ) : (
            <>
              <FileDown className="h-4 w-4" />
              Unduh Laporan PDF
            </>
          )}
        </button>
      </div>

      {/* 1. Bar Filter Pencarian Laporan */}
      <div className="bg-white p-5 rounded-2xl border border-zinc-150 shadow-sm space-y-4">
        <div className="flex items-center gap-2 text-zinc-800 border-b border-zinc-100 pb-3">
          <Filter className="h-4 w-4 text-zinc-400" />
          <span className="text-sm font-bold uppercase tracking-wider text-zinc-500">Parameter Filter</span>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {/* Periode Waktu */}
          <div>
            <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5">Periode Waktu</label>
            <select
              value={filterPeriod}
              onChange={(e) => handlePeriodChange(e.target.value)}
              className="w-full rounded-lg border border-zinc-200 px-3 py-2.5 text-sm text-zinc-700 bg-white focus:outline-none focus:ring-1 focus:ring-[#FF8200]"
            >
              <option value="all">Semua Waktu</option>
              <option value="today">Hari Ini (Harian)</option>
              <option value="week">Minggu Ini (Mingguan)</option>
              <option value="month">Bulan Ini (Bulanan)</option>
              <option value="custom">Pilih Tanggal (Kustom)</option>
            </select>
          </div>

          {/* Kategori */}
          <div>
            <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5">Kategori</label>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="w-full rounded-lg border border-zinc-200 px-3 py-2.5 text-sm text-zinc-700 bg-white focus:outline-none focus:ring-1 focus:ring-[#FF8200]"
            >
              <option value="">Semua Kategori</option>
              {categories?.map((cat: any) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          {/* Status */}
          <div>
            <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5">Status</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full rounded-lg border border-zinc-200 px-3 py-2.5 text-sm text-zinc-700 bg-white focus:outline-none focus:ring-1 focus:ring-[#FF8200]"
            >
              <option value="">Semua Status</option>
              <option value="in_progress">In Progress</option>
              <option value="on_hold">On Hold</option>
              <option value="done">Done</option>
            </select>
          </div>

          {/* Karyawan */}
          <div>
            <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5">Karyawan</label>
            <select
              value={filterUser}
              onChange={(e) => setFilterUser(e.target.value)}
              className="w-full rounded-lg border border-zinc-200 px-3 py-2.5 text-sm text-zinc-700 bg-white focus:outline-none focus:ring-1 focus:ring-[#FF8200]"
            >
              <option value="">Semua Karyawan</option>
              {employees?.filter((e: any) => e.roles?.[0]?.name === "Employee").map((emp: any) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name}
                </option>
              ))}
            </select>
          </div>

          {/* Tombol Reset Filter */}
          <div className="flex items-end">
            <button
              onClick={handleResetFilters}
              className="w-full bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-sm font-bold py-2.5 px-4 rounded-lg transition-all cursor-pointer"
            >
              Reset Filter
            </button>
          </div>
        </div>

        {/* Form Pilih Tanggal Kustom (Hanya jika memilih Kustom) */}
        {filterPeriod === "custom" && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 max-w-md pt-3 border-t border-zinc-100 animate-fadeIn">
            <div>
              <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5">Mulai Tanggal</label>
              <input
                type="date"
                value={filterStartDate}
                onChange={(e) => setFilterStartDate(e.target.value)}
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-700 focus:outline-none focus:ring-1 focus:ring-[#FF8200]"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5">Sampai Tanggal</label>
              <input
                type="date"
                value={filterEndDate}
                onChange={(e) => setFilterEndDate(e.target.value)}
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-700 focus:outline-none focus:ring-1 focus:ring-[#FF8200]"
              />
            </div>
          </div>
        )}
      </div>

      {/* 2. Preview Laporan */}
      <div className="bg-white rounded-2xl border border-zinc-150 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between">
          <span className="text-sm font-bold uppercase tracking-wider text-zinc-500">Preview Laporan</span>
          <span className="text-sm text-zinc-400 font-semibold">
            Total Ditemukan: {reportActivities?.length || 0} Aktivitas
          </span>
        </div>

        <div className="overflow-x-auto">
          {isReportLoading ? (
            <div className="space-y-3 p-6 animate-pulse">
              <div className="h-10 bg-zinc-100 rounded" />
              <div className="h-10 bg-zinc-100 rounded" />
            </div>
          ) : !reportActivities || reportActivities.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-zinc-450 py-16">
              <FileBarChart2 className="h-12 w-12 mb-2 text-zinc-200" />
              <span className="text-sm">Tidak ada aktivitas yang sesuai kriteria filter.</span>
            </div>
          ) : (
            <table className="min-w-[900px] md:min-w-full divide-y divide-zinc-150 text-left text-sm">
              <thead className="bg-zinc-50/70">
                <tr className="text-zinc-400 uppercase font-bold tracking-wider text-xs">
                  <th className="py-5 pl-6 md:pl-8 pr-4">Karyawan</th>
                  <th className="py-5 px-4">Tanggal</th>
                  <th className="py-5 px-4">Kategori</th>
                  <th className="py-5 px-4">Aktivitas</th>
                  <th className="py-5 px-4">Status</th>
                  <th className="py-5 pl-4 pr-6 md:pr-8">Lampiran / Alasan Hold</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 font-medium">
                {reportActivities.map((act: any) => (
                  <tr key={act.id} className="text-zinc-700 hover:bg-zinc-50/50">
                    <td className="py-5 pl-6 md:pl-8 pr-4">
                      <div className="font-bold text-zinc-950 text-sm">{act.user?.name}</div>
                    </td>
                    <td className="py-5 px-4">
                      <div className="font-bold text-zinc-900 text-[13px]">{formatIndonesianDate(act.created_at)}</div>
                      <div className="text-xs text-zinc-400 font-semibold mt-0.5">
                        {new Date(act.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} WIB
                      </div>
                    </td>
                     <td className="py-5 px-4">
                       <span className="px-2.5 py-0.5 rounded-full bg-zinc-100 border border-zinc-200 text-zinc-650 font-bold text-[10px] uppercase tracking-wide whitespace-nowrap">
                         {act.category?.name}
                       </span>
                     </td>
                    <td className="py-5 px-4 max-w-md break-words text-zinc-900">
                      <div className="font-bold text-[13.5px] text-zinc-900 leading-relaxed">{act.activity}</div>
                      {act.progress_note && (
                        <div className="text-xs text-zinc-500 font-medium italic mt-2 bg-zinc-50 border border-zinc-100 px-2.5 py-1.5 rounded-lg max-w-md break-words">
                          Progress: {act.progress_note}
                        </div>
                      )}
                    </td>
                    <td className="py-5 px-4">
                      <span
                        className={`text-[10.5px] font-bold px-2.5 py-1 rounded uppercase ${
                          act.status === "in_progress"
                            ? "bg-blue-50 text-blue-600 border border-blue-100"
                            : act.status === "on_hold"
                            ? "bg-orange-50 text-orange-600 border border-orange-150"
                            : "bg-green-50 text-green-600 border border-green-100"
                        }`}
                      >
                        {act.status.replace("_", " ")}
                      </span>
                      <div className="text-xs text-zinc-500 font-semibold mt-1.5 flex items-center gap-1">
                        <span>⏱️</span>
                        <span>{formatActiveDuration(act.created_at, act.completed_at, act.status, act.logs, holidaySet)}</span>
                        {act.status === "in_progress" && (
                          <span className="text-zinc-400 font-medium text-[10px]">(aktif)</span>
                        )}
                      </div>
                    </td>
                    <td className="py-5 pl-4 pr-6 md:pr-8 max-w-xs break-words text-xs">
                      {act.status === "on_hold" && act.hold_reason && (
                        <div className="text-orange-700 font-bold bg-orange-50/50 border border-orange-100 p-2 rounded-lg text-xs mb-1">
                          Kendala: {act.hold_reason}
                        </div>
                      )}
                      {act.reference_link && (
                        <a
                          href={act.reference_link}
                          target="_blank"
                          className="text-[#FF8200] hover:underline font-bold inline-flex items-center gap-1 text-xs mt-1"
                        >
                          Bukti Link <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                      {!act.hold_reason && !act.reference_link && "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

// Sub-komponen ikon kecil inline
function ExternalLink(props: any) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M15 3h6v6" />
      <path d="M10 14 21 3" />
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    </svg>
  );
}
