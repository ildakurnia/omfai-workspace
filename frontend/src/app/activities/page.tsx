"use client";

import React, { useEffect, useState } from "react";
import Cookies from "js-cookie";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  ClipboardList,
  Plus,
  Search,
  Filter,
  X,
  Edit2,
  Trash2,
  ExternalLink,
  Loader2,
  CheckCircle,
  Play,
  Pause,
  MessageSquarePlus,
  MoreVertical,
  Lock,
  Clock,
} from "lucide-react";
import DashboardLayout from "@/components/dashboard-layout";
import ReviewModal from "@/components/review-modal";
import api from "@/lib/api";
import { formatDuration, formatActiveDuration, getDateRange, toLocalDateString, formatIndonesianDate } from "@/lib/utils";

// Schema validasi Zod untuk form aktivitas
const activitySchema = z.object({
  category_id: z.string().min(1, "Kategori wajib dipilih"),
  activity: z.string().min(5, "Pekerjaan minimal 5 karakter"),
  status: z.enum(["in_progress", "on_hold", "done"]),
  hold_reason: z.string().optional(),
  reference_link: z.string().optional(),
  progress_note: z.string().optional(),
}).refine((data) => {
  if (data.status === "on_hold" && (!data.hold_reason || data.hold_reason.trim() === "")) {
    return false;
  }
  return true;
}, {
  message: "Alasan hold wajib diisi jika status On Hold",
  path: ["hold_reason"],
}).refine((data) => {
  if (data.reference_link && data.reference_link.trim() !== "") {
    try {
      new URL(data.reference_link);
      return true;
    } catch {
      return false;
    }
  }
  return true;
}, {
  message: "Format link referensi harus berupa URL yang valid",
  path: ["reference_link"],
});

type ActivityFormValues = z.infer<typeof activitySchema>;



export default function ActivitiesPage() {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<any>(null);
  const [selectedActivity, setSelectedActivity] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // States untuk input kendala (hold reason) custom dialog
  const [holdActivity, setHoldActivity] = useState<any>(null);
  const [holdReasonInput, setHoldReasonInput] = useState("");
  const [holdError, setHoldError] = useState<string | null>(null);

  // States untuk review/catatan Owner
  const [reviewActivity, setReviewActivity] = useState<any>(null);
  const [isReviewOpen, setIsReviewOpen] = useState(false);

  // States untuk dropdown aksi per baris
  const [activeDropdownId, setActiveDropdownId] = useState<number | null>(null);

  // States untuk filter
  const [filterPeriod, setFilterPeriod] = useState("all");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterStartDate, setFilterStartDate] = useState("");
  const [filterEndDate, setFilterEndDate] = useState("");
  const [page, setPage] = useState(1);

  const handlePeriodChange = (val: string) => {
    setFilterPeriod(val);
    setPage(1);
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

  useEffect(() => {
    const userCookie = Cookies.get("omfai_user");
    if (userCookie) {
      try {
        setUser(JSON.parse(userCookie));
      } catch (e) {}
    }
  }, []);

  const roles = user?.roles || [];
  const isAdmin = roles.includes("Admin");
  const isOwner = roles.includes("Owner");
  const isEmployee = roles.includes("Employee");

  // React Hook Form setup
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<ActivityFormValues>({
    resolver: zodResolver(activitySchema),
    defaultValues: {
      status: "in_progress",
      activity: "",
      hold_reason: "",
      reference_link: "",
      progress_note: "",
    },
  });

  const watchStatus = watch("status");

  // Query list kategori untuk dropdown filter & form
  const { data: categoriesData } = useQuery({
    queryKey: ["activeCategories"],
    queryFn: async () => {
      const response = await api.get("/categories", { params: { active_only: 1 } });
      return response.data.data;
    },
  });

  // Query: Ambil Semua Hari Libur untuk durasi kerja
  const { data: holidaysData } = useQuery({
    queryKey: ["allHolidays"],
    queryFn: async () => {
      const response = await api.get("/holidays");
      return response.data.data;
    },
  });

  const holidaySet = React.useMemo(() => {
    return new Set<string>((holidaysData || []).map((h: any) => h.date));
  }, [holidaysData]);

  // Query daftar semua karyawan (hanya untuk Admin/Owner untuk memfilter)
  const [filterUser, setFilterUser] = useState("");
  const { data: employeesData } = useQuery({
    queryKey: ["employeesList"],
    queryFn: async () => {
      const response = await api.get("/users");
      return response.data.data;
    },
    enabled: isOwner || isAdmin,
  });

  // Query utama untuk fetch daftar aktivitas
  const { data: activitiesData, isLoading: isListLoading } = useQuery({
    queryKey: ["activities", filterCategory, filterStatus, filterStartDate, filterEndDate, filterUser, page],
    queryFn: async () => {
      const response = await api.get("/activities", {
        params: {
          category_id: filterCategory,
          status: filterStatus,
          start_date: filterStartDate,
          end_date: filterEndDate,
          user_id: isEmployee ? undefined : filterUser,
          page: page,
        },
      });
      return response.data.data;
    },
  });

  // Mutation: Simpan / Edit Aktivitas
  const saveMutation = useMutation({
    mutationFn: async (data: ActivityFormValues) => {
      if (selectedActivity) {
        const response = await api.put(`/activities/${selectedActivity.id}`, data);
        return response.data;
      } else {
        const response = await api.post("/activities", data);
        return response.data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activities"] });
      queryClient.invalidateQueries({ queryKey: ["dashboardSummary"] });
      closeModal();
    },
    onError: (err: any) => {
      setErrorMsg(err.response?.data?.message || "Gagal menyimpan aktivitas.");
    },
  });

  // Mutation: Hapus Aktivitas
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/activities/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activities"] });
      queryClient.invalidateQueries({ queryKey: ["dashboardSummary"] });
    },
  });

  const openAddModal = () => {
    setSelectedActivity(null);
    reset({
      status: "in_progress",
      activity: "",
      hold_reason: "",
      reference_link: "",
      progress_note: "",
    });
    setIsModalOpen(true);
    setErrorMsg(null);
  };

  const openEditModal = (activity: any) => {
    setSelectedActivity(activity);
    reset({
      category_id: String(activity.category_id),
      activity: activity.activity,
      status: activity.status,
      hold_reason: activity.hold_reason || "",
      reference_link: activity.reference_link || "",
      progress_note: activity.progress_note || "",
    });
    setIsModalOpen(true);
    setErrorMsg(null);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedActivity(null);
    setErrorMsg(null);
  };

  const onSubmit = (values: ActivityFormValues) => {
    saveMutation.mutate(values);
  };

  const handleQuickUpdateStatus = async (activity: any, newStatus: string) => {
    if (newStatus === "on_hold") {
      setHoldActivity(activity);
      setHoldReasonInput(activity.hold_reason || "");
      setHoldError(null);
      return;
    }
    
    try {
      await api.put(`/activities/${activity.id}`, {
        category_id: String(activity.category_id),
        activity: activity.activity,
        status: newStatus,
        hold_reason: activity.hold_reason || "",
        reference_link: activity.reference_link || "",
        progress_note: activity.progress_note || "",
      });
      
      queryClient.invalidateQueries({ queryKey: ["activities"] });
      queryClient.invalidateQueries({ queryKey: ["dashboardSummary"] });
    } catch (err: any) {
      alert(err.response?.data?.message || "Gagal mengubah status aktivitas.");
    }
  };

  const submitQuickHold = async () => {
    if (!holdReasonInput.trim()) {
      setHoldError("Alasan hold / kendala pengerjaan wajib diisi.");
      return;
    }

    try {
      await api.put(`/activities/${holdActivity.id}`, {
        category_id: String(holdActivity.category_id),
        activity: holdActivity.activity,
        status: "on_hold",
        hold_reason: holdReasonInput,
        reference_link: holdActivity.reference_link || "",
        progress_note: holdActivity.progress_note || "",
      });

      queryClient.invalidateQueries({ queryKey: ["activities"] });
      queryClient.invalidateQueries({ queryKey: ["dashboardSummary"] });
      
      // Close modal
      setHoldActivity(null);
      setHoldReasonInput("");
      setHoldError(null);
    } catch (err: any) {
      setHoldError(err.response?.data?.message || "Gagal menyimpan kendala.");
    }
  };

  const handleDelete = (id: number) => {
    if (confirm("Apakah Anda yakin ingin menghapus catatan aktivitas ini?")) {
      deleteMutation.mutate(id);
    }
  };

  const handleResetFilters = () => {
    setFilterPeriod("all");
    setFilterCategory("");
    setFilterStatus("");
    setFilterStartDate("");
    setFilterEndDate("");
    setFilterUser("");
    setPage(1);
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-zinc-950">Kelola & Histori Aktivitas</h2>
          <p className="text-xs text-zinc-400 font-medium mt-1">Daftar lengkap catatan aktivitas pekerjaan harian karyawan.</p>
        </div>
        {isEmployee && (
          <button
            onClick={openAddModal}
            className="flex items-center gap-2 bg-[#FF8200] hover:bg-[#e07200] text-white text-sm font-bold px-4 py-2.5 rounded-lg shadow-sm transition-all cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            Catat Aktivitas Baru
          </button>
        )}
      </div>

      {/* 1. Bar Filter Pencarian */}
      <div className="bg-white p-5 rounded-2xl border border-zinc-150 shadow-sm space-y-4">
        <div className="flex items-center gap-2 text-zinc-800 border-b border-zinc-100 pb-3">
          <Filter className="h-4 w-4 text-zinc-400" />
          <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">Penyaringan Data</span>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {/* Filter Periode */}
          <div>
            <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Periode Waktu</label>
            <select
              value={filterPeriod}
              onChange={(e) => handlePeriodChange(e.target.value)}
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-xs text-zinc-700 bg-white focus:outline-none focus:ring-1 focus:ring-[#FF8200]"
            >
              <option value="all">Semua Waktu</option>
              <option value="today">Hari Ini (Harian)</option>
              <option value="week">Minggu Ini (Mingguan)</option>
              <option value="month">Bulan Ini (Bulanan)</option>
              <option value="custom">Pilih Tanggal (Kustom)</option>
            </select>
          </div>

          {/* Filter Kategori */}
          <div>
            <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Kategori</label>
            <select
              value={filterCategory}
              onChange={(e) => {
                setFilterCategory(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-xs text-zinc-700 bg-white focus:outline-none focus:ring-1 focus:ring-[#FF8200]"
            >
              <option value="">Semua Kategori</option>
              {categoriesData?.map((cat: any) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          {/* Filter Status */}
          <div>
            <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Status</label>
            <select
              value={filterStatus}
              onChange={(e) => {
                setFilterStatus(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-xs text-zinc-700 bg-white focus:outline-none focus:ring-1 focus:ring-[#FF8200]"
            >
              <option value="">Semua Status</option>
              <option value="in_progress">In Progress</option>
              <option value="on_hold">On Hold</option>
              <option value="done">Done</option>
            </select>
          </div>

          {/* Filter Karyawan (Admin/Owner Only) */}
          {(isAdmin || isOwner) ? (
            <div>
              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Karyawan</label>
              <select
                value={filterUser}
                onChange={(e) => {
                  setFilterUser(e.target.value);
                  setPage(1);
                }}
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-xs text-zinc-700 bg-white focus:outline-none focus:ring-1 focus:ring-[#FF8200]"
              >
                <option value="">Semua Karyawan</option>
                {employeesData?.filter((e: any) => e.roles?.[0]?.name === "Employee").map((emp: any) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="hidden lg:block"></div>
          )}

          {/* Tombol Reset Filter */}
          <div className="flex items-end">
            <button
              onClick={handleResetFilters}
              className="w-full bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs font-bold py-2.5 px-4 rounded-lg transition-all cursor-pointer"
            >
              Reset Filter
            </button>
          </div>
        </div>

        {/* Form Pilih Tanggal Kustom (Hanya jika memilih Kustom) */}
        {filterPeriod === "custom" && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 max-w-md pt-3 border-t border-zinc-100 animate-fadeIn">
            <div>
              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Mulai Tanggal</label>
              <input
                type="date"
                value={filterStartDate}
                onChange={(e) => {
                  setFilterStartDate(e.target.value);
                  setPage(1);
                }}
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-xs text-zinc-700 focus:outline-none focus:ring-1 focus:ring-[#FF8200]"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Sampai Tanggal</label>
              <input
                type="date"
                value={filterEndDate}
                onChange={(e) => {
                  setFilterEndDate(e.target.value);
                  setPage(1);
                }}
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-xs text-zinc-700 focus:outline-none focus:ring-1 focus:ring-[#FF8200]"
              />
            </div>
          </div>
        )}
      </div>

      {/* 2. Tabel Data Aktivitas */}
      <div className="bg-white rounded-2xl border border-zinc-150 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          {isListLoading ? (
            <div className="space-y-3 p-6 animate-pulse">
              <div className="h-10 bg-zinc-100 rounded" />
              <div className="h-10 bg-zinc-100 rounded" />
              <div className="h-10 bg-zinc-100 rounded" />
            </div>
          ) : !activitiesData || activitiesData.data.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-zinc-400 py-16">
              <ClipboardList className="h-12 w-12 mb-2 text-zinc-200" />
              <span className="text-sm">Tidak ada catatan aktivitas yang ditemukan.</span>
            </div>
          ) : (
            <table className="min-w-[900px] md:min-w-full divide-y divide-zinc-150 text-left text-xs">
              <thead className="bg-zinc-50/70">
                <tr className="text-zinc-400 uppercase font-bold tracking-wider">
                  {(isAdmin || isOwner) ? (
                    <th className="py-5 pl-6 md:pl-8 pr-4">Karyawan</th>
                  ) : (
                    <th className="py-5 pl-6 md:pl-8 pr-4">Tanggal</th>
                  )}
                  {(isAdmin || isOwner) && <th className="py-5 px-4">Tanggal</th>}
                  <th className="py-5 px-4">Kategori</th>
                  <th className="py-5 px-4">Aktivitas Pekerjaan</th>
                  <th className="py-5 px-4">Status</th>
                  <th className="py-5 px-4">Hold Reason / Link Bukti</th>
                  <th className="py-5 pl-4 pr-6 md:pr-8 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 font-medium">
                {activitiesData.data.map((act: any) => {
                  const canEdit =
                    isAdmin ||
                    (isEmployee && act.status !== "done" && act.user_id === user['id']);
                  
                  return (
                    <tr key={act.id} className="text-zinc-700 hover:bg-zinc-50/50">
                      {(isAdmin || isOwner) ? (
                        <td className="py-5 pl-6 md:pl-8 pr-4">
                          <div className="font-bold text-zinc-900">{act.user?.name}</div>
                        </td>
                      ) : (
                        <td className="py-5 pl-6 md:pl-8 pr-4">
                          <div>{formatIndonesianDate(act.created_at)}</div>
                          <div className="text-[10px] text-zinc-400 font-medium">
                            {new Date(act.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} WIB
                          </div>
                        </td>
                      )}
                      {(isAdmin || isOwner) && (
                        <td className="py-5 px-4">
                          <div>{formatIndonesianDate(act.created_at)}</div>
                          <div className="text-[10px] text-zinc-400 font-medium">
                            {new Date(act.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} WIB
                          </div>
                        </td>
                      )}
                       <td className="py-5 px-4">
                         <span className="px-2.5 py-0.5 rounded-full bg-zinc-100 border border-zinc-200 text-zinc-600 font-bold text-[9px] uppercase tracking-wide whitespace-nowrap">
                           {act.category?.name}
                         </span>
                       </td>
                      <td className="py-5 px-4 max-w-md break-words text-zinc-900">
                        <div className="font-semibold">{act.activity}</div>
                        {act.progress_note && (
                          <div className="text-[10px] text-zinc-500 font-medium italic mt-1.5 bg-zinc-50 border border-zinc-100/60 px-2 py-1 rounded-md max-w-md break-words">
                            Progress: {act.progress_note}
                          </div>
                        )}
                        {act.owner_feedback && (
                          <div className="text-[10px] text-zinc-650 font-medium mt-1.5 bg-orange-50/40 border border-orange-100/60 p-2 rounded-xl max-w-md break-words">
                            <strong className="text-[#e07200]">Catatan Owner:</strong> {act.owner_feedback}
                          </div>
                        )}
                      </td>
                      <td className="py-5 px-4">
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
                          <Clock className="h-3 w-3 text-zinc-400 shrink-0" />
                          <span>{formatActiveDuration(act.created_at, act.completed_at, act.status, act.logs, holidaySet)}</span>
                          {act.status === "in_progress" && (
                            <span className="text-zinc-400 font-medium text-[9px]">(aktif)</span>
                          )}
                        </div>
                      </td>
                      <td className="py-5 px-4 max-w-xs break-words">
                        {act.status === "on_hold" && act.hold_reason && (
                          <div className="text-orange-700 font-bold bg-orange-50/50 border border-orange-100 p-2 rounded-lg text-[11px] mb-1">
                            Kendala: {act.hold_reason}
                          </div>
                        )}
                        {act.reference_link && (
                          <a
                            href={act.reference_link}
                            target="_blank"
                            className="text-[#FF8200] hover:underline font-bold inline-flex items-center gap-1 text-[11px] mt-1"
                          >
                            Buka Bukti <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                        {!act.hold_reason && !act.reference_link && "-"}
                      </td>
                      <td className="py-5 pl-4 pr-6 md:pr-8 text-center">
                        {isOwner && !canEdit ? (
                          <button
                            onClick={() => {
                              setReviewActivity(act);
                              setIsReviewOpen(true);
                            }}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-orange-200 bg-orange-50/40 hover:bg-orange-50 text-[10px] font-bold text-[#FF8200] transition-all cursor-pointer shadow-sm hover:border-orange-300"
                          >
                            <MessageSquarePlus className="h-3 w-3 text-[#FF8200]" />
                            {act.owner_feedback ? "Edit Review" : "Review"}
                          </button>
                        ) : (
                          <div className="relative inline-block text-left">
                            <button
                              onClick={() => setActiveDropdownId(activeDropdownId === act.id ? null : act.id)}
                              className="p-1.5 hover:bg-zinc-100 text-zinc-500 hover:text-zinc-900 rounded-lg transition-all border border-zinc-200 focus:outline-none cursor-pointer flex items-center justify-center bg-white shadow-sm"
                              title="Aksi"
                            >
                              <MoreVertical className="h-4 w-4" />
                            </button>
 
                            {activeDropdownId === act.id && (
                              <>
                                {/* Backdrop untuk menutup dropdown saat klik di luar */}
                                <div className="fixed inset-0 z-20" onClick={() => setActiveDropdownId(null)} />
 
                                {/* Dropdown Menu Container */}
                                <div className="absolute right-0 mt-1.5 w-44 rounded-xl bg-white border border-zinc-200 shadow-xl z-30 py-1.5 text-left animate-fadeIn">
                                  {/* Opsi Aksi Owner (Review/Feedback) */}
                                  {isOwner && (
                                    <button
                                      onClick={() => {
                                        setReviewActivity(act);
                                        setIsReviewOpen(true);
                                        setActiveDropdownId(null);
                                      }}
                                      className="flex w-full items-center gap-2 px-3.5 py-2 text-xs font-bold text-orange-600 hover:bg-orange-50/50 cursor-pointer"
                                    >
                                      <MessageSquarePlus className="h-4 w-4 text-orange-500" />
                                      {act.owner_feedback ? "Edit Catatan" : "Beri Catatan"}
                                    </button>
                                  )}
 
                                  {/* Opsi Aksi Modifikasi (Employee/Admin) */}
                                  {canEdit ? (
                                    <>
                                      {isOwner && <div className="border-t border-zinc-100 my-1" />}
                                      
                                      {/* Quick Status Toggles */}
                                      {act.status === "in_progress" && (
                                        <>
                                          <button
                                            onClick={() => {
                                              handleQuickUpdateStatus(act, "on_hold");
                                              setActiveDropdownId(null);
                                            }}
                                            className="flex w-full items-center gap-2 px-3.5 py-2 text-xs font-semibold text-orange-600 hover:bg-orange-50/40 cursor-pointer"
                                          >
                                            <Pause className="h-4 w-4 text-orange-500" />
                                            Jeda Pekerjaan
                                          </button>
                                          <button
                                            onClick={() => {
                                              handleQuickUpdateStatus(act, "done");
                                              setActiveDropdownId(null);
                                            }}
                                            className="flex w-full items-center gap-2 px-3.5 py-2 text-xs font-semibold text-green-600 hover:bg-green-50/40 cursor-pointer"
                                          >
                                            <CheckCircle className="h-4 w-4 text-green-500" />
                                            Selesaikan
                                          </button>
                                        </>
                                      )}
 
                                      {act.status === "on_hold" && (
                                        <>
                                          <button
                                            onClick={() => {
                                              handleQuickUpdateStatus(act, "in_progress");
                                              setActiveDropdownId(null);
                                            }}
                                            className="flex w-full items-center gap-2 px-3.5 py-2 text-xs font-semibold text-blue-600 hover:bg-blue-50/40 cursor-pointer"
                                          >
                                            <Play className="h-4 w-4 text-blue-500" />
                                            Lanjutkan
                                          </button>
                                          <button
                                            onClick={() => {
                                              handleQuickUpdateStatus(act, "done");
                                              setActiveDropdownId(null);
                                            }}
                                            className="flex w-full items-center gap-2 px-3.5 py-2 text-xs font-semibold text-green-600 hover:bg-green-50/40 cursor-pointer"
                                          >
                                            <CheckCircle className="h-4 w-4 text-green-500" />
                                            Selesaikan
                                          </button>
                                        </>
                                      )}
 
                                      <div className="border-t border-zinc-100 my-1" />
 
                                      {/* Edit & Delete */}
                                      <button
                                        onClick={() => {
                                          openEditModal(act);
                                          setActiveDropdownId(null);
                                        }}
                                        className="flex w-full items-center gap-2 px-3.5 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 cursor-pointer"
                                      >
                                        <Edit2 className="h-3.5 w-3.5 text-zinc-400" />
                                        Ubah Detail
                                      </button>
                                      <button
                                        onClick={() => {
                                          handleDelete(act.id);
                                          setActiveDropdownId(null);
                                        }}
                                        className="flex w-full items-center gap-2 px-3.5 py-2 text-xs font-bold text-red-650 hover:bg-red-50 cursor-pointer"
                                      >
                                        <Trash2 className="h-3.5 w-3.5 text-red-500" />
                                        Hapus Aktivitas
                                      </button>
                                    </>
                                  ) : (
                                    /* Tampilan saat tidak memiliki akses / done */
                                    !isOwner && (
                                      <>
                                        {act.status === "done" ? (
                                          <div className="flex items-center gap-2 px-3.5 py-2 text-xs font-bold text-green-600 bg-green-50/30">
                                            <Lock className="h-3.5 w-3.5 text-green-500 shrink-0" />
                                            Terkunci (Done)
                                          </div>
                                        ) : (
                                          <div className="flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-zinc-400 italic">
                                            <Lock className="h-3.5 w-3.5 text-zinc-300 shrink-0" />
                                            No Access
                                          </div>
                                        )}
                                      </>
                                    )
                                  )}
                                </div>
                              </>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
 
        {/* Paginasi Sederhana */}
        {activitiesData && activitiesData.total > activitiesData.per_page && (
          <div className="bg-zinc-50 px-6 py-4 flex items-center justify-between border-t border-zinc-150">
            <span className="text-xs text-zinc-500 font-semibold">
              Menampilkan {activitiesData.from} - {activitiesData.to} dari {activitiesData.total} data
            </span>
            <div className="flex gap-2">
              <button
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
                className="px-3 py-1.5 bg-white border border-zinc-200 rounded-lg text-xs font-bold text-zinc-700 disabled:opacity-50 transition-all cursor-pointer"
              >
                Sebelum
              </button>
              <button
                disabled={page === activitiesData.last_page}
                onClick={() => setPage(page + 1)}
                className="px-3 py-1.5 bg-white border border-zinc-200 rounded-lg text-xs font-bold text-zinc-700 disabled:opacity-50 transition-all cursor-pointer"
              >
                Berikutnya
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 3. Modal Form CRUD (Dialog Glassmorphism) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/40 backdrop-blur-sm px-4">
          <div className="bg-white rounded-2xl border border-zinc-100 shadow-2xl w-full max-w-md p-6 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3 mb-5 shrink-0">
              <h3 className="text-sm font-bold text-zinc-950">
                {selectedActivity ? "Ubah Catatan Aktivitas" : "Catat Aktivitas Baru"}
              </h3>
              <button onClick={closeModal} className="p-1 text-zinc-400 hover:text-zinc-700 rounded-lg cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>

            {errorMsg && (
              <div className="rounded-lg bg-red-50 p-3 text-xs font-semibold text-red-600 border border-red-100 mb-4 shrink-0">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 overflow-y-auto flex-1 px-2 py-1.5">
              {/* Dropdown Kategori */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1">
                  Kategori Pekerjaan
                </label>
                <select
                  {...register("category_id")}
                  className={`w-full rounded-lg border px-3 py-2.5 text-xs text-zinc-700 bg-white focus:outline-none focus:ring-2 focus:ring-[#FF8200] focus:border-transparent ${
                    errors.category_id ? "border-red-300" : "border-zinc-200"
                  }`}
                >
                  <option value="">Pilih Kategori...</option>
                  {categoriesData?.map((cat: any) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
                {errors.category_id && (
                  <p className="mt-1 text-xs text-red-600 font-semibold">{errors.category_id.message}</p>
                )}
              </div>

              {/* Deskripsi Aktivitas */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1">
                  Aktivitas / Pekerjaan
                </label>
                <textarea
                  {...register("activity")}
                  rows={4}
                  className={`w-full rounded-lg border px-3 py-2 text-xs text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#FF8200] focus:border-transparent ${
                    errors.activity ? "border-red-300" : "border-zinc-200"
                  }`}
                  placeholder="Deskripsikan pekerjaan yang sedang/sudah Anda lakukan..."
                />
                {errors.activity && (
                  <p className="mt-1 text-xs text-red-600 font-semibold">{errors.activity.message}</p>
                )}
              </div>

              {/* Status Dropdown (Hanya saat edit) */}
              {selectedActivity && (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1">
                    Status Saat Ini
                  </label>
                  <select
                    {...register("status")}
                    className="w-full rounded-lg border px-3 py-2.5 text-xs text-zinc-700 bg-white focus:outline-none focus:ring-2 focus:ring-[#FF8200] focus:border-transparent border-zinc-200"
                  >
                    <option value="in_progress">In Progress</option>
                    <option value="on_hold">On Hold</option>
                    <option value="done">Done</option>
                  </select>
                </div>
              )}

              {/* Kondisional: Alasan Hold (Jika status = on_hold) */}
              {watchStatus === "on_hold" && (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1 text-orange-600">
                    Kendala / Alasan Hold (Wajib)
                  </label>
                  <textarea
                    {...register("hold_reason")}
                    rows={2}
                    className={`w-full rounded-lg border px-3 py-2 text-xs text-zinc-900 placeholder-orange-300 bg-orange-50/20 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent ${
                      errors.hold_reason ? "border-red-300" : "border-orange-200"
                    }`}
                    placeholder="Sebutkan kendala apa yang Anda alami sehingga pekerjaan terhambat..."
                  />
                  {errors.hold_reason && (
                    <p className="mt-1 text-xs text-red-600 font-semibold">{errors.hold_reason.message}</p>
                  )}
                </div>
              )}

              {/* Reference Link (Bukti) */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1">
                  Link Referensi / Bukti Kerja (Opsional)
                </label>
                <input
                  {...register("reference_link")}
                  type="text"
                  className={`w-full rounded-lg border px-3 py-2.5 text-xs text-zinc-950 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#FF8200] focus:border-transparent ${
                    errors.reference_link ? "border-red-300" : "border-zinc-200"
                  }`}
                  placeholder="https://github.com/... atau https://drive.google.com/..."
                />
                {errors.reference_link && (
                  <p className="mt-1 text-xs text-red-600 font-semibold">{errors.reference_link.message}</p>
                )}
              </div>

              {/* Catatan Progres / Notes */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1">
                  Catatan Progres / Hasil Kerja (Opsional)
                </label>
                <textarea
                  {...register("progress_note")}
                  rows={3}
                  className="w-full rounded-lg border border-zinc-200 px-3 py-2.5 text-xs text-zinc-950 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#FF8200] focus:border-transparent"
                  placeholder="Jelaskan progres perkembangan pekerjaan hari ini (misal: Selesai halaman login 80%...)"
                />
              </div>

              {/* Tombol Simpan Form */}
              <div className="pt-4 flex gap-3 border-t border-zinc-100 shrink-0">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs font-bold py-2.5 rounded-lg transition-all cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saveMutation.isPending}
                  className="flex-1 flex justify-center items-center bg-[#FF8200] hover:bg-[#e07200] text-white text-xs font-bold py-2.5 rounded-lg transition-all cursor-pointer"
                >
                  {saveMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Menyimpan...
                    </>
                  ) : (
                    "Simpan Catatan"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. Modal Input Kendala (Hold Reason) Custom */}
      {holdActivity && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/40 backdrop-blur-sm px-4 animate-fadeIn">
          <div className="bg-white rounded-2xl border border-zinc-100 shadow-2xl w-full max-w-sm p-6 overflow-hidden">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3 mb-5">
              <h3 className="text-sm font-bold text-zinc-950 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-orange-500 animate-pulse" />
                Catat Kendala Pekerjaan
              </h3>
              <button
                onClick={() => {
                  setHoldActivity(null);
                  setHoldReasonInput("");
                  setHoldError(null);
                }}
                className="p-1 text-zinc-400 hover:text-zinc-700 rounded-lg cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {holdError && (
              <div className="rounded-lg bg-red-50 p-3 text-xs font-semibold text-red-600 border border-red-100 mb-4 animate-shake">
                {holdError}
              </div>
            )}

            <div className="space-y-4">
              <div className="bg-zinc-50 border border-zinc-150 p-3 rounded-lg text-[11px] leading-relaxed">
                <span className="block font-bold text-zinc-400 uppercase tracking-wider mb-1">Aktivitas Terpilih</span>
                <span className="text-zinc-700 font-semibold">{holdActivity.activity}</span>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1.5 text-orange-600">
                  Apa kendala yang sedang dialami? (Wajib)
                </label>
                <textarea
                  value={holdReasonInput}
                  onChange={(e) => setHoldReasonInput(e.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-orange-200 px-3 py-2 text-xs text-zinc-900 placeholder-orange-300 bg-orange-50/10 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="Contoh: Menunggu feedback dari tim UI/UX atau API server down..."
                />
              </div>

              <div className="pt-4 flex gap-3 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => {
                    setHoldActivity(null);
                    setHoldReasonInput("");
                    setHoldError(null);
                  }}
                  className="flex-1 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs font-bold py-2.5 rounded-lg transition-all cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={submitQuickHold}
                  className="flex-1 bg-gradient-to-r from-orange-500 to-[#FF8200] hover:from-orange-600 hover:to-[#e07200] text-white text-xs font-bold py-2.5 rounded-lg transition-all cursor-pointer"
                >
                  Jeda Aktivitas (Hold)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. Modal Review/Feedback Owner */}
      <ReviewModal
        isOpen={isReviewOpen}
        onClose={() => {
          setIsReviewOpen(false);
          setReviewActivity(null);
        }}
        activity={reviewActivity}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["activities"] });
          queryClient.invalidateQueries({ queryKey: ["dashboardSummary"] });
        }}
      />
    </DashboardLayout>
  );
}
