"use client";

import React, { useEffect, useState } from "react";
import Cookies from "js-cookie";
import { useQuery } from "@tanstack/react-query";
import {
  Users,
  ClipboardCheck,
  PlayCircle,
  PauseCircle,
  CheckCircle2,
  AlertCircle,
  PlusCircle,
  FolderOpen,
  ArrowRight,
} from "lucide-react";
import DashboardLayout from "@/components/dashboard-layout";
import api from "@/lib/api";
import { formatDuration, formatActiveDuration, formatIndonesianDate } from "@/lib/utils";

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const userCookie = Cookies.get("omfai_user");
    if (userCookie) {
      try {
        setUser(JSON.parse(userCookie));
      } catch (e) {
        // Abaikan error
      }
    }
  }, []);

  const roles = user?.roles || [];
  const isEmployee = roles.includes("Employee");
  const isOwnerOrAdmin = roles.includes("Owner") || roles.includes("Admin");

  // Query Data Dashboard (khusus Owner & Admin)
  const {
    data: dashboardData,
    isLoading: isDashboardLoading,
    error: dashboardError,
  } = useQuery({
    queryKey: ["dashboardSummary"],
    queryFn: async () => {
      const response = await api.get("/dashboard");
      return response.data.data;
    },
    enabled: !!isOwnerOrAdmin,
  });

  // Query Data Aktivitas Saya (khusus Employee)
  const {
    data: employeeActivitiesData,
    isLoading: isEmployeeLoading,
    error: employeeError,
  } = useQuery({
    queryKey: ["employeeActivities"],
    queryFn: async () => {
      const response = await api.get("/activities", {
        params: { per_page: 5 },
      });
      return response.data.data;
    },
    enabled: !!isEmployee,
  });

  // Query: Ambil Semua Hari Libur untuk durasi kerja
  const { data: holidaysData } = useQuery({
    queryKey: ["allHolidaysForDashboard"],
    queryFn: async () => {
      const response = await api.get("/holidays");
      return response.data.data;
    },
  });

  const holidaySet = React.useMemo(() => {
    return new Set<string>((holidaysData || []).map((h: any) => h.date));
  }, [holidaysData]);

  if (!user) {
    return (
      <DashboardLayout>
        <div className="flex h-64 items-center justify-center">
          <div className="text-zinc-500 animate-pulse text-sm font-medium">Memuat data user...</div>
        </div>
      </DashboardLayout>
    );
  }

  // RENDERING TAMPILAN OWNER / ADMIN
  if (isOwnerOrAdmin) {
    const data = dashboardData || {
      totalEmployees: 0,
      totalActivities: 0,
      inProgress: 0,
      onHold: 0,
      done: 0,
      recentActivities: [],
      onHoldActivities: [],
      categorySummary: [],
    };

    const stats = [
      { name: "Total Aktivitas", value: data.totalActivities, icon: ClipboardCheck, color: "text-zinc-600 bg-zinc-50" },
      { name: "In Progress", value: data.inProgress, icon: PlayCircle, color: "text-blue-500 bg-blue-50/50" },
      { name: "On Hold", value: data.onHold, icon: PauseCircle, color: "text-orange-500 bg-orange-50/50" },
      { name: "Done", value: data.done, icon: CheckCircle2, color: "text-green-500 bg-green-50/50" },
    ];

    return (
      <DashboardLayout>
        <div>
          <h2 className="text-xl font-bold text-zinc-950">Monitoring Ringkasan Perusahaan</h2>
          <p className="text-xs text-zinc-400 font-medium mt-1">Pantau kondisi aktivitas seluruh karyawan secara real-time.</p>
        </div>

        {/* 1. Summary Cards */}
        {isDashboardLoading ? (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-white p-6 rounded-2xl border border-zinc-100 animate-pulse h-28" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((item) => (
              <div
                key={item.name}
                className="bg-white overflow-hidden rounded-2xl border border-zinc-150 p-6 flex items-center justify-between shadow-sm"
              >
                <div className="space-y-2">
                  <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">{item.name}</span>
                  <div className="text-3xl font-extrabold text-zinc-900">{item.value}</div>
                </div>
                <div className={`p-3 rounded-xl ${item.color}`}>
                  <item.icon className="h-6 w-6" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 2. Widgets Grid */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Recent Activities */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-zinc-150 p-6 shadow-sm flex flex-col min-h-[400px]">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
              <div>
                <h3 className="text-sm font-bold text-zinc-950">Aktivitas Terbaru</h3>
                <p className="text-[11px] text-zinc-400 mt-0.5">Daftar pembaruan aktivitas kerja terkini.</p>
              </div>
              <a href="/activities" className="text-xs font-bold text-[#FF8200] hover:underline flex items-center gap-1">
                Semua Aktivitas <ArrowRight className="h-3 w-3" />
              </a>
            </div>

            <div className="flex-1 overflow-y-auto mt-4 space-y-4">
              {isDashboardLoading ? (
                [...Array(3)].map((_, i) => (
                  <div key={i} className="flex gap-4 items-center animate-pulse py-2">
                    <div className="h-8 w-8 rounded-full bg-zinc-100 shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 bg-zinc-100 rounded w-1/3" />
                      <div className="h-2 bg-zinc-100 rounded w-2/3" />
                    </div>
                  </div>
                ))
              ) : data.recentActivities.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center text-zinc-400 py-12">
                  <ClipboardCheck className="h-8 w-8 mb-2 text-zinc-300" />
                  <span className="text-xs">Belum ada aktivitas yang tercatat.</span>
                </div>
              ) : (
                data.recentActivities.map((act: any) => (
                  <div key={act.id} className="flex items-start gap-4 py-3 border-b border-zinc-50 last:border-0">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-orange-100 text-[#FF8200] font-bold text-xs overflow-hidden">
                      {act.employeeAvatarUrl ? (
                        <img src={act.employeeAvatarUrl} className="h-full w-full object-cover" alt={act.employeeName} />
                      ) : (
                        act.employeeName.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="text-xs font-bold text-zinc-900 truncate">{act.employeeName}</h4>
                        <span className="text-[9px] text-zinc-400 font-medium">
                          {new Date(act.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-600 mt-1 break-words whitespace-pre-wrap">{act.activity}</p>
                      {act.progressNote && (
                        <div className="text-[10px] text-zinc-500 font-medium italic mt-1 bg-zinc-50 border border-zinc-100/60 px-2 py-0.5 rounded-md inline-block max-w-full break-words">
                          Progress: {act.progressNote}
                        </div>
                      )}
                      {act.ownerFeedback && (
                        <div className="text-[10px] text-zinc-650 font-semibold mt-1 bg-orange-50/50 border border-orange-100/60 px-2 py-0.5 rounded-md inline-block max-w-full break-words">
                          Feedback: {act.ownerFeedback}
                        </div>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        <span className="px-2 py-0.5 rounded-full bg-zinc-100 border border-zinc-200 text-zinc-600 font-bold text-[9px] uppercase tracking-wide whitespace-nowrap">
                          {act.categoryName}
                        </span>
                        <span
                          className={`text-[9px] font-bold px-2 py-0.5 rounded uppercase ${
                            act.status === "in_progress"
                              ? "bg-blue-50 text-blue-600 border border-blue-100"
                              : act.status === "on_hold"
                              ? "bg-orange-50 text-orange-600 border border-orange-150"
                              : "bg-green-50 text-green-600 border border-green-100"
                          }`}
                        >
                          {act.status.replace("_", " ")}
                        </span>
                        <span className="text-[10px] text-zinc-500 font-semibold flex items-center gap-1">
                          <span>⏱️</span>
                          <span>{formatActiveDuration(act.createdAt, act.completedAt, act.status, act.logs, holidaySet)}</span>
                          {act.status === "in_progress" && (
                            <span className="text-zinc-400 font-medium text-[9px]">(aktif)</span>
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Right Column (On Hold & Category Summary) */}
          <div className="space-y-6">
            {/* On Hold Activities */}
            <div className="bg-white rounded-2xl border border-zinc-155 p-6 shadow-sm flex flex-col min-h-[220px]">
              <div className="border-b border-zinc-100 pb-3">
                <h3 className="text-sm font-bold text-zinc-950 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-orange-500" />
                  Mengalami Kendala (On Hold)
                </h3>
                <p className="text-[10px] text-zinc-400 mt-0.5">Karyawan yang pekerjaannya terhenti sementara.</p>
              </div>

              <div className="flex-1 overflow-y-auto mt-4 space-y-3.5">
                {isDashboardLoading ? (
                  <div className="animate-pulse space-y-3 py-2">
                    <div className="h-12 bg-zinc-100 rounded-lg" />
                    <div className="h-12 bg-zinc-100 rounded-lg" />
                  </div>
                ) : data.onHoldActivities.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center text-zinc-400 py-6">
                    <CheckCircle2 className="h-8 w-8 mb-1.5 text-green-500/80" />
                    <span className="text-xs text-zinc-500 font-medium">Lancar! Tidak ada kendala saat ini.</span>
                  </div>
                ) : (
                  data.onHoldActivities.map((act: any) => (
                    <div key={act.id} className="p-3 bg-orange-50/30 border border-orange-100 rounded-xl">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-zinc-900">{act.employeeName}</span>
                        <span className="text-[9px] text-zinc-400">
                          {formatIndonesianDate(act.updatedAt, { showYear: false })}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-600 mt-1 break-words whitespace-pre-wrap"><strong>Tugas:</strong> {act.activity}</p>
                      <p className="text-xs text-orange-700 font-semibold mt-1 bg-white border border-orange-150 px-2 py-1 rounded-lg">
                        <strong>Kendala:</strong> {act.holdReason}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Category Summary */}
            <div className="bg-white rounded-2xl border border-zinc-155 p-6 shadow-sm">
              <div className="border-b border-zinc-100 pb-3 mb-4">
                <h3 className="text-sm font-bold text-zinc-950 flex items-center gap-2">
                  <FolderOpen className="h-4 w-4 text-zinc-400" />
                  Distribusi Kategori
                </h3>
              </div>

              <div className="space-y-3">
                {isDashboardLoading ? (
                  <div className="space-y-3 py-2">
                    <div className="h-4 bg-zinc-100 rounded animate-pulse" />
                    <div className="h-4 bg-zinc-100 rounded animate-pulse" />
                  </div>
                ) : data.categorySummary.length === 0 ? (
                  <span className="text-xs text-zinc-400">Belum ada data distribusi.</span>
                ) : (
                  data.categorySummary.map((cat: any) => {
                    const percentage = data.totalActivities > 0 ? (cat.count / data.totalActivities) * 100 : 0;
                    return (
                      <div key={cat.categoryName} className="space-y-1">
                        <div className="flex justify-between text-xs font-medium text-zinc-700">
                          <span>{cat.categoryName}</span>
                          <span className="font-bold">{cat.count} tugas ({Math.round(percentage)}%)</span>
                        </div>
                        <div className="w-full bg-zinc-100 h-2 rounded-full overflow-hidden">
                          <div
                            className="bg-[#FF8200] h-full rounded-full transition-all duration-500"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // RENDERING TAMPILAN EMPLOYEE
  const recentActivities = employeeActivitiesData?.data || [];
  const totalOwn = recentActivities.length;
  const ownInProgress = recentActivities.filter((a: any) => a.status === "in_progress").length;
  const ownOnHold = recentActivities.filter((a: any) => a.status === "on_hold").length;
  const ownDone = recentActivities.filter((a: any) => a.status === "done").length;

  return (
    <DashboardLayout>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-zinc-950">Halo, {user.name}!</h2>
          <p className="text-xs text-zinc-400 font-medium mt-1">Catat dan kelola aktivitas harian Anda dengan mudah di bawah ini.</p>
        </div>
      </div>

      {/* 1. Karyawan Summary */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-4">
        <div className="bg-white overflow-hidden rounded-2xl border border-zinc-150 p-6 flex items-center justify-between shadow-sm">
          <div className="space-y-1.5">
            <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Aktivitas Terkini</span>
            <div className="text-2xl font-extrabold text-zinc-900">{totalOwn}</div>
          </div>
          <div className="p-2.5 rounded-lg bg-zinc-50 text-zinc-500">
            <ClipboardCheck className="h-5 w-5" />
          </div>
        </div>
        <div className="bg-white overflow-hidden rounded-2xl border border-zinc-150 p-6 flex items-center justify-between shadow-sm">
          <div className="space-y-1.5">
            <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">In Progress</span>
            <div className="text-2xl font-extrabold text-blue-600">{ownInProgress}</div>
          </div>
          <div className="p-2.5 rounded-lg bg-blue-50 text-blue-500">
            <PlayCircle className="h-5 w-5" />
          </div>
        </div>
        <div className="bg-white overflow-hidden rounded-2xl border border-zinc-150 p-6 flex items-center justify-between shadow-sm">
          <div className="space-y-1.5">
            <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">On Hold</span>
            <div className="text-2xl font-extrabold text-orange-600">{ownOnHold}</div>
          </div>
          <div className="p-2.5 rounded-lg bg-orange-50 text-orange-500">
            <PauseCircle className="h-5 w-5" />
          </div>
        </div>
        <div className="bg-white overflow-hidden rounded-2xl border border-zinc-150 p-6 flex items-center justify-between shadow-sm">
          <div className="space-y-1.5">
            <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Done</span>
            <div className="text-2xl font-extrabold text-green-600">{ownDone}</div>
          </div>
          <div className="p-2.5 rounded-lg bg-green-50 text-green-500">
            <CheckCircle2 className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* 2. List Aktivitas Saya */}
      <div className="bg-white rounded-2xl border border-zinc-150 p-6 shadow-sm flex flex-col">
        <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
          <div>
            <h3 className="text-sm font-bold text-zinc-950">Aktivitas Saya (Terakhir)</h3>
            <p className="text-[11px] text-zinc-400 mt-0.5">Daftar 5 tugas terbaru yang Anda kerjakan.</p>
          </div>
          <a href="/activities" className="text-xs font-bold text-[#FF8200] hover:underline flex items-center gap-1">
            Lihat Histori <ArrowRight className="h-3 w-3" />
          </a>
        </div>

        <div className="overflow-x-auto mt-4">
          {isEmployeeLoading ? (
            <div className="space-y-3 py-4 animate-pulse">
              <div className="h-10 bg-zinc-100 rounded" />
              <div className="h-10 bg-zinc-100 rounded" />
            </div>
          ) : recentActivities.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-zinc-400 py-12">
              <ClipboardCheck className="h-10 w-10 mb-2 text-zinc-300" />
              <span className="text-xs">Anda belum mencatat aktivitas hari ini.</span>
              <a href="/activities" className="text-xs font-bold text-[#FF8200] hover:underline mt-2">
                Buat aktivitas pertama Anda sekarang.
              </a>
            </div>
          ) : (
            <table className="min-w-[800px] md:min-w-full divide-y divide-zinc-100 text-left text-xs">
              <thead>
                <tr className="text-zinc-400 uppercase font-bold tracking-wider">
                  <th className="pb-3 pr-4">Tanggal</th>
                  <th className="pb-3 px-4">Kategori</th>
                  <th className="pb-3 px-4">Aktivitas</th>
                  <th className="pb-3 px-4">Status</th>
                  <th className="pb-3 pl-4">Lampiran / Alasan Hold</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50 font-medium">
                {recentActivities.map((act: any) => (
                  <tr key={act.id} className="text-zinc-700">
                    <td className="py-3.5 pr-4 text-zinc-500">
                      {formatIndonesianDate(act.created_at, { showYear: false })}{" "}
                      <span className="text-[10px] text-zinc-400">
                        {new Date(act.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2.5 py-0.5 rounded-full bg-zinc-100 border border-zinc-200 text-zinc-600 font-bold text-[9px] uppercase tracking-wide whitespace-nowrap">
                        {act.category?.name}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 max-w-sm text-zinc-900">
                      <div className="font-semibold break-words whitespace-pre-wrap">{act.activity}</div>
                      {act.progress_note && (
                        <div className="text-[10px] text-zinc-500 font-medium italic mt-1 break-words whitespace-pre-wrap">
                          Progress: {act.progress_note}
                        </div>
                      )}
                      {act.owner_feedback && (
                        <div className="text-[10px] text-zinc-650 font-semibold mt-1 bg-orange-50/50 border border-orange-100/60 p-1.5 rounded-lg max-w-xs break-words">
                          Feedback: {act.owner_feedback}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`text-[9px] font-bold px-2.5 py-1 rounded uppercase ${
                          act.status === "in_progress"
                            ? "bg-blue-50 text-blue-600 border border-blue-100"
                            : act.status === "on_hold"
                            ? "bg-orange-50 text-orange-600 border border-orange-150"
                            : "bg-green-50 text-green-600 border border-green-100"
                        }`}
                      >
                        {act.status.replace("_", " ")}
                      </span>
                      <div className="text-[10px] text-zinc-500 font-semibold mt-1 flex items-center gap-1">
                        <span>⏱️</span>
                        <span>{formatActiveDuration(act.created_at, act.completed_at, act.status, act.logs, holidaySet)}</span>
                        {act.status === "in_progress" && (
                          <span className="text-zinc-400 font-medium text-[9px]">(aktif)</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 pl-4 max-w-xs truncate">
                      {act.status === "on_hold" && act.hold_reason && (
                        <span className="text-orange-700 font-bold bg-orange-50 border border-orange-100 px-2 py-1 rounded">
                          Kendala: {act.hold_reason}
                        </span>
                      )}
                      {act.reference_link && (
                        <a href={act.reference_link} target="_blank" className="text-[#FF8200] hover:underline font-bold block mt-1">
                          Buka Link Bukti
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
