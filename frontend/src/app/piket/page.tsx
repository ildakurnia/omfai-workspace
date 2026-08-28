"use client";

import React, { useEffect, useState } from "react";
import Cookies from "js-cookie";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Sparkles,
  Calendar,
  User,
  Users,
  CheckCircle2,
  Clock,
  RefreshCcw,
  Check,
  Loader2,
  FileText,
  AlertCircle,
} from "lucide-react";
import DashboardLayout from "@/components/dashboard-layout";
import api from "@/lib/api";
import { formatIndonesianDate } from "@/lib/utils";

export default function PiketManagementPage() {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<any>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const userCookie = Cookies.get("omfai_user");
    if (userCookie) {
      try {
        setUser(JSON.parse(userCookie));
      } catch (e) {}
    }
  }, []);

  const roles = user?.roles || [];
  const isAdmin = mounted && roles.includes("Admin");
  const isOwnerOrAdmin = isAdmin;

  const todayStr = new Date().toLocaleDateString("en-CA");

  // Query Time Settings
  const [morningTime, setMorningTime] = useState("08:00");
  const [afternoonTime, setAfternoonTime] = useState("16:00");

  const { data: piketSettingsData } = useQuery({
    queryKey: ["piketSettings"],
    queryFn: async () => {
      const res = await api.get("/piket/settings");
      return res.data.data;
    },
    enabled: isOwnerOrAdmin,
  });

  useEffect(() => {
    if (piketSettingsData) {
      if (piketSettingsData.morning_time) setMorningTime(piketSettingsData.morning_time);
      if (piketSettingsData.afternoon_time) setAfternoonTime(piketSettingsData.afternoon_time);
    }
  }, [piketSettingsData]);

  const updatePiketSettingsMutation = useMutation({
    mutationFn: async ({ morning_time, afternoon_time }: { morning_time: string; afternoon_time: string }) => {
      const res = await api.post("/piket/settings", { morning_time, afternoon_time });
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["piketSettings"] });
      alert(data.message || "Pengaturan jam berhasil disimpan!");
    },
  });

  const testWaMutation = useMutation({
    mutationFn: async (session: "morning" | "afternoon") => {
      const res = await api.post("/piket/test-wa", { session });
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["piketToday"] });
      alert(data.message || "Pesan WA berhasil dikirim!");
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || "Gagal mengirim pesan WA.");
    },
  });

  // Query today's piket status
  const { data: piketTodayData, isLoading: isTodayLoading } = useQuery({
    queryKey: ["piketToday"],
    queryFn: async () => {
      const res = await api.get("/piket/today");
      return res.data.data;
    },
  });

  // Query weekly piket schedules (Monday - Friday)
  const { data: piketSchedulesData, isLoading: isSchedulesLoading } = useQuery({
    queryKey: ["piketSchedules"],
    queryFn: async () => {
      const res = await api.get("/piket/schedules");
      return res.data.data || [];
    },
    enabled: isOwnerOrAdmin,
  });

  // Query all active employees for selection dropdown
  const { data: allEmployeesList } = useQuery({
    queryKey: ["allUsersForPiketPage"],
    queryFn: async () => {
      const res = await api.get("/users");
      return res.data.data?.filter((u: any) => u.employee) || [];
    },
    enabled: isOwnerOrAdmin,
  });

  // Mutation to update schedule for a specific day with multiple employees
  const updatePiketDayScheduleMutation = useMutation({
    mutationFn: async ({ day_of_week, employee_ids }: { day_of_week: string; employee_ids: number[] }) => {
      const res = await api.post("/piket/schedules/day", { day_of_week, employee_ids });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["piketToday"] });
      queryClient.invalidateQueries({ queryKey: ["piketSchedules"] });
    },
  });

  // Mutation to quick swap today's piket duty employee
  const [selectedSwapEmpId, setSelectedSwapEmpId] = useState<number | "">("");
  const reassignTodayMutation = useMutation({
    mutationFn: async (employee_id: number) => {
      const res = await api.post("/piket/reassign-today", { employee_id });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["piketToday"] });
      setSelectedSwapEmpId("");
    },
  });

  const dutyEmployees = piketTodayData?.duty_employees || (piketTodayData?.duty_employee ? [piketTodayData.duty_employee] : []);
  const logs = piketTodayData?.logs || (piketTodayData?.log ? [piketTodayData.log] : []);

  const dayTranslation: Record<string, string> = {
    Monday: "Senin",
    Tuesday: "Selasa",
    Wednesday: "Rabu",
    Thursday: "Kamis",
    Friday: "Jumat",
  };

  const handleEmployeeToggle = (dayOfWeek: string, currentEmpIds: number[], empId: number) => {
    let updatedIds: number[];
    if (currentEmpIds.includes(empId)) {
      updatedIds = currentEmpIds.filter((id) => id !== empId);
    } else {
      updatedIds = [...currentEmpIds, empId];
    }

    updatePiketDayScheduleMutation.mutate({
      day_of_week: dayOfWeek,
      employee_ids: updatedIds,
    });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-zinc-150 shadow-xs">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-orange-50 border border-orange-200 text-[#FF8200]">
                <Sparkles className="h-5 w-5" />
              </div>
              <h1 className="text-xl font-bold text-zinc-950">Kelola Jadwal Piket & Kebersihan</h1>
            </div>
            <p className="text-xs text-zinc-500 font-medium mt-1">
              Atur petugas piket harian (Senin - Jumat) dan pantau laporan konfirmasi kebersihan kantor.
            </p>
          </div>

          <div className="text-right bg-zinc-50 px-4 py-2.5 rounded-xl border border-zinc-200 self-start md:self-auto">
            <span className="text-[10px] font-extrabold uppercase text-zinc-400 block">Hari Ini</span>
            <span className="text-xs font-bold text-zinc-800">{formatIndonesianDate(todayStr)}</span>
          </div>
        </div>

        {/* 1. Status Piket Hari Ini */}
        <div className="bg-white rounded-2xl border border-zinc-150 p-6 shadow-xs space-y-4">
          <h2 className="text-base font-bold text-zinc-900 flex items-center gap-2 border-b border-zinc-100 pb-3">
            <Calendar className="h-4.5 w-4.5 text-[#FF8200]" />
            Status Piket Hari Ini ({piketTodayData?.day_name ? (dayTranslation[piketTodayData.day_name] || piketTodayData.day_name) : ''})
          </h2>

          {isTodayLoading ? (
            <div className="py-8 flex items-center justify-center gap-2 text-zinc-400 text-xs font-medium">
              <Loader2 className="h-4 w-4 animate-spin text-[#FF8200]" />
              Memuat status piket...
            </div>
          ) : (
            <div className="space-y-4">
              {logs && logs.length > 0 ? (
                logs.map((logItem: any) => (
                  <div key={logItem.id} className="grid grid-cols-1 md:grid-cols-12 gap-5 items-center bg-zinc-50/70 border border-zinc-200 p-4 rounded-2xl">
                    {/* Petugas Info */}
                    <div className="md:col-span-5 flex items-center gap-3.5">
                      <div className="h-10 w-10 rounded-full bg-orange-100 border border-orange-200 text-[#FF8200] font-black text-sm flex items-center justify-center overflow-hidden shrink-0">
                        {logItem.employee_name?.charAt(0)?.toUpperCase() || "?"}
                      </div>
                      <div>
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">Petugas Piket</span>
                        <h3 className="text-sm font-black text-zinc-900">{logItem.employee_name}</h3>
                      </div>
                    </div>

                    {/* Status Pengiriman WA */}
                    <div className="md:col-span-4 grid grid-cols-2 gap-3">
                      <div className="bg-white border border-zinc-200 rounded-xl p-2.5 text-center">
                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">WA Pagi ({piketTodayData?.morning_time || '08:00'})</span>
                        <span className={`inline-flex items-center gap-1 text-[11px] font-extrabold px-2.5 py-0.5 rounded-full border ${
                          logItem.morning_wa_sent ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-zinc-100 text-zinc-500 border-zinc-200"
                        }`}>
                          {logItem.morning_wa_sent ? "✅ Terkirim" : "⏳ Terjadwal"}
                        </span>
                      </div>

                      <div className="bg-white border border-zinc-200 rounded-xl p-2.5 text-center">
                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">WA Sore ({piketTodayData?.afternoon_time || '16:00'})</span>
                        <span className={`inline-flex items-center gap-1 text-[11px] font-extrabold px-2.5 py-0.5 rounded-full border ${
                          logItem.afternoon_wa_sent ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-zinc-100 text-zinc-500 border-zinc-200"
                        }`}>
                          {logItem.afternoon_wa_sent ? "✅ Terkirim" : "⏳ Terjadwal"}
                        </span>
                      </div>
                    </div>

                    {/* Status Penyelesaian */}
                    <div className="md:col-span-3 flex flex-col justify-center">
                      {logItem.is_completed ? (
                        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-center space-y-0.5">
                          <span className="text-xs font-black text-emerald-800 flex items-center justify-center gap-1">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                            Piket Selesai
                          </span>
                          {logItem.completed_at && (
                            <span className="text-[10px] text-emerald-600 font-bold block">
                              {new Date(logItem.completed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} WIB
                            </span>
                          )}
                          {logItem.proof_image_url && (
                            <a
                              href={logItem.proof_image_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[11px] font-bold text-[#FF8200] hover:underline block pt-0.5"
                            >
                              🖼️ Foto Bukti
                            </a>
                          )}
                        </div>
                      ) : (
                        <a
                          href={`/piket/confirm?token=${logItem.token}`}
                          target="_blank"
                          rel="noreferrer"
                          className="w-full bg-[#FF8200] hover:bg-[#e07200] text-white font-extrabold py-2.5 px-3 rounded-xl shadow-2xs text-xs text-center transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <FileText className="h-3.5 w-3.5" />
                          Form Konfirmasi
                        </a>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-6 text-zinc-400 text-xs font-medium">
                  Belum ada petugas piket yang dijadwalkan untuk hari ini.
                </div>
              )}
            </div>
          )}
        </div>

        {/* 2. Pengaturan Jam Pengingat WA (Pagi & Sore) */}
        {isOwnerOrAdmin && (
          <div className="bg-white rounded-2xl border border-zinc-150 p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-100 pb-4">
              <div>
                <h2 className="text-base font-bold text-zinc-900 flex items-center gap-2">
                  <Clock className="h-4.5 w-4.5 text-[#FF8200]" />
                  Pengaturan Jam Pengingat WhatsApp
                </h2>
                <p className="text-xs text-zinc-400 font-semibold mt-0.5">
                  Atur jam pengiriman pesan WA pengingat otomatis untuk sesi Pagi dan Sore.
                </p>
              </div>

              <button
                type="button"
                onClick={() => updatePiketSettingsMutation.mutate({ morning_time: morningTime, afternoon_time: afternoonTime })}
                disabled={updatePiketSettingsMutation.isPending}
                className="bg-[#FF8200] hover:bg-[#e07200] text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-all cursor-pointer shadow-2xs inline-flex items-center gap-1.5 self-start sm:self-center disabled:opacity-50"
              >
                {updatePiketSettingsMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                Simpan Jam Pengingat
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-4 space-y-3">
                <label className="text-xs font-extrabold uppercase tracking-wider text-zinc-600 flex items-center justify-between">
                  <span>🌸 Jam Pengingat Pagi (Siram Bunga)</span>
                </label>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <input
                      type="time"
                      value={morningTime}
                      onChange={(e) => setMorningTime(e.target.value)}
                      className="text-sm font-extrabold font-mono text-zinc-900 bg-white border border-zinc-300 rounded-xl px-3.5 py-2 focus:outline-none focus:ring-2 focus:ring-[#FF8200] cursor-pointer shadow-2xs"
                    />
                    <span className="text-xs text-zinc-400 font-semibold">WIB</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => testWaMutation.mutate("morning")}
                    disabled={testWaMutation.isPending}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3.5 py-2 rounded-xl transition-all cursor-pointer shadow-2xs inline-flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {testWaMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "🚀 Tes WA Pagi"}
                  </button>
                </div>
              </div>

              <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-4 space-y-3">
                <label className="text-xs font-extrabold uppercase tracking-wider text-zinc-600 flex items-center justify-between">
                  <span>🗑️ Jam Pengingat Sore (Buang Sampah)</span>
                </label>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <input
                      type="time"
                      value={afternoonTime}
                      onChange={(e) => setAfternoonTime(e.target.value)}
                      className="text-sm font-extrabold font-mono text-zinc-900 bg-white border border-zinc-300 rounded-xl px-3.5 py-2 focus:outline-none focus:ring-2 focus:ring-[#FF8200] cursor-pointer shadow-2xs"
                    />
                    <span className="text-xs text-zinc-400 font-semibold">WIB</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => testWaMutation.mutate("afternoon")}
                    disabled={testWaMutation.isPending}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3.5 py-2 rounded-xl transition-all cursor-pointer shadow-2xs inline-flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {testWaMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "🚀 Tes WA Sore"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 3. Pengaturan Jadwal Mingguan (Senin - Jumat) */}
        {isOwnerOrAdmin && (
          <div className="bg-white rounded-2xl border border-zinc-150 p-6 shadow-xs space-y-4">
            <div>
              <h2 className="text-base font-bold text-zinc-900 flex items-center gap-2">
                <Users className="h-4.5 w-4.5 text-[#FF8200]" />
                Pengaturan Jadwal Piket Mingguan (Multi-Petugas per Hari)
              </h2>
              <p className="text-xs text-zinc-400 font-semibold mt-0.5">
                Centang satu atau lebih karyawan yang bertugas piket untuk masing-masing hari kerja. Perubahan akan tersimpan secara otomatis.
              </p>
            </div>

            {isSchedulesLoading ? (
              <div className="py-8 flex items-center justify-center gap-2 text-zinc-400 text-xs font-medium">
                <Loader2 className="h-4 w-4 animate-spin text-[#FF8200]" />
                Memuat jadwal piket...
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4 pt-2">
                {piketSchedulesData?.map((sch: any) => {
                  const dayName = dayTranslation[sch.day_of_week] || sch.day_of_week;
                  const isToday = piketTodayData?.day_name === sch.day_of_week;
                  const currentEmpIds: number[] = sch.employee_ids || [];

                  return (
                    <div
                      key={sch.day_of_week}
                      className={`p-4 rounded-2xl border transition-all space-y-3 flex flex-col justify-between ${
                        isToday
                          ? "bg-orange-50/40 border-orange-300 ring-2 ring-orange-200"
                          : "bg-zinc-50/60 border-zinc-200"
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between border-b border-zinc-200/60 pb-2.5 mb-3">
                          <span className="text-sm font-extrabold text-zinc-900">{dayName}</span>
                          {isToday && (
                            <span className="text-[10px] font-extrabold bg-[#FF8200] text-white px-2 py-0.5 rounded-full">
                              Hari Ini
                            </span>
                          )}
                        </div>

                        <div className="space-y-2">
                          <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400 block">
                            Pilih Petugas Piket:
                          </span>
                          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                            {allEmployeesList?.map((u: any) => {
                              const isChecked = currentEmpIds.includes(u.employee.id);
                              return (
                                <label
                                  key={u.employee.id}
                                  className={`flex items-center gap-2 p-2 rounded-xl border text-xs font-bold transition-all cursor-pointer select-none ${
                                    isChecked
                                      ? "bg-orange-100/70 border-orange-300 text-orange-950"
                                      : "bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-100"
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() =>
                                      handleEmployeeToggle(sch.day_of_week, currentEmpIds, u.employee.id)
                                    }
                                    className="h-3.5 w-3.5 rounded border-zinc-300 text-[#FF8200] focus:ring-[#FF8200] cursor-pointer accent-[#FF8200]"
                                  />
                                  <span className="truncate">{u.employee.name}</span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-zinc-200/60 text-right">
                        <span className="text-[10px] font-extrabold text-zinc-500">
                          {currentEmpIds.length} Petugas Dipilih
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
