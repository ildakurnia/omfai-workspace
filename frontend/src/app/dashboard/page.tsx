"use client";

import React, { useEffect, useState } from "react";
import Cookies from "js-cookie";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
  Trophy,
  Calendar,
  Clock,
  MapPin,
  Loader2,
  CheckCircle,
  UserCheck,
  X,
  FileText,
  CalendarX,
  Ban,
  MessageSquare,
  RefreshCw,
  Timer,
  Coffee,
  Check,
} from "lucide-react";
import DashboardLayout from "@/components/dashboard-layout";
import ReviewModal from "@/components/review-modal";
import api from "@/lib/api";
import { formatDuration, formatActiveDuration, formatIndonesianDate, toLocalDateString, formatActiveOvertimeDuration, calculateOvertimeMinutes } from "@/lib/utils";
import AlertModal from "@/components/alert-modal";

// Helper to generate the monthly grid and calculate attendance statuses
const generateMonthlyGrid = (monthStr: string, attendances: any[], leaves: any[], holidays: any[], whPermissions: any[] = []) => {
  if (!monthStr) return [];
  const [year, month] = monthStr.split("-").map(Number);
  const date = new Date(year, month - 1, 1);
  const days = [];
  
  while (date.getMonth() === month - 1) {
    days.push(new Date(date));
    date.setDate(date.getDate() + 1);
  }

  const formattedHolidays = (holidays || []).map((h: any) => h.date);

  return days.map((day) => {
    const dayStr = toLocalDateString(day);
    const dayOfWeek = day.getDay();
    
    const attendance = (attendances || []).find((a: any) => a.date === dayStr);
    const leave = (leaves || []).find((l: any) => {
      return dayStr >= l.start_date && dayStr <= l.end_date && l.status === "approved";
    });
    const whPermission = (whPermissions || []).find((w: any) => {
      return w.date === dayStr && w.status === "approved";
    });

    let status = "-";
    const todayString = new Date().toLocaleDateString("en-CA");
    const isToday = dayStr === todayString;
    const isPast = dayStr < todayString;
    const isSunday = dayOfWeek === 0;
    const isHoliday = formattedHolidays.includes(dayStr);

    if (attendance) {
      status = attendance.status; // "present" or "late"
    } else if (leave) {
      status = leave.type; // "annual_leave", "sick_leave", "permission"
    } else if (isSunday) {
      status = "weekend";
    } else if (isHoliday) {
      status = "holiday";
    } else if (isToday) {
      status = "not_yet";
    } else if (isPast) {
      status = "absent";
    } else {
      status = "future";
    }

    return { status, whPermissionId: whPermission ? whPermission.id : null };
  });
};

const renderTextWithLinks = (text: string) => {
  if (!text) return "";
  const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+|[a-zA-Z0-9.-]+\.(?:com|org|net|edu|gov|io|id|dev|sh|co)(?:\/[^\s]*)?)/gi;
  const parts = text.split(urlRegex);
  return parts.map((part, index) => {
    if (part.match(urlRegex)) {
      const href = /^(https?:\/\/)/i.test(part) 
        ? part 
        : `https://${part}`;
      return (
        <a
          key={index}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:text-blue-800 hover:underline break-all font-bold"
          onClick={(e) => e.stopPropagation()}
        >
          {part}
        </a>
      );
    }
    return part;
  });
};

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null);
  const [activeAttendanceTab, setActiveAttendanceTab] = useState<string>("all");

  // Custom Alert Modal State
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

  const showAlert = (message: string, variant: "success" | "error" | "warning" | "info" = "success", title: string = "Informasi") => {
    setAlertConfig({
      isOpen: true,
      title,
      message,
      variant,
    });
  };

  const formatLateMinutes = (minutes: number) => {
    const rounded = Math.round(minutes);
    if (rounded < 60) {
      return `${rounded} Menit`;
    }
    const hours = Math.floor(rounded / 60);
    const remainingMinutes = rounded % 60;
    return `${hours} Jam ${remainingMinutes} Menit`;
  };

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

  const queryClient = useQueryClient();
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [isClearingCache, setIsClearingCache] = useState(false);

  const handleClearCache = async () => {
    setIsClearingCache(true);
    try {
      const res = await api.post("/admin/clear-cache");
      showAlert(res.data.message || "Cache berhasil dibersihkan!", "success", "Sukses");
    } catch (err: any) {
      showAlert(
        err.response?.data?.message || "Gagal membersihkan cache server.",
        "error",
        "Eror"
      );
    } finally {
      setIsClearingCache(false);
    }
  };

  // States untuk review/catatan Owner dari Dashboard
  const [reviewActivity, setReviewActivity] = useState<any>(null);
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [activePhotoUrl, setActivePhotoUrl] = useState<string | null>(null);

  // States untuk Persetujuan Pengajuan Karyawan
  const [activeRequestTab, setActiveRequestTab] = useState<"leave" | "wh_permission">("leave");
  const [isRejectionModalOpen, setIsRejectionModalOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [rejectionId, setRejectionId] = useState<number | null>(null);
  const [rejectionType, setRejectionType] = useState<"leave" | "wh_permission" | null>(null);
  const [rejectionError, setRejectionError] = useState<string | null>(null);

  // Query: Ambil riwayat absen login karyawan
  const { data: attendanceHistory, isLoading: attendanceLoading } = useQuery({
    queryKey: ["attendanceHistory"],
    queryFn: async () => {
      const res = await api.get("/history-absen");
      return res.data;
    },
    enabled: !!isEmployee,
  });

  // Query: Ambil riwayat cuti login karyawan
  const { data: leaveHistory, isLoading: leaveLoading } = useQuery({
    queryKey: ["leaveHistory"],
    queryFn: async () => {
      const res = await api.get("/history-cuti");
      return res.data;
    },
    enabled: !!isEmployee,
  });

  // Query: Ambil riwayat izin jam kerja login karyawan
  const { data: workHourPermissions, isLoading: workHourPermissionsLoading } = useQuery({
    queryKey: ["workHourPermissionsHistory"],
    queryFn: async () => {
      const res = await api.get("/work-hour-permissions");
      return res.data;
    },
    enabled: !!isEmployee,
  });

  // Query: Ambil Geofences aktif
  const { data: geofences } = useQuery({
    queryKey: ["geofencesList"],
    queryFn: async () => {
      const res = await api.get("/geofences");
      return res.data.data || [];
    },
    enabled: !!isEmployee,
  });

  // Mutation: Clock In / Clock Out
  const tapMutation = useMutation({
    mutationFn: async (coords: { latitude: number; longitude: number }) => {
      const res = await api.post("/absen", coords);
      return res.data;
    },
    onSuccess: (data) => {
      setGpsError(null);
      queryClient.invalidateQueries({ queryKey: ["attendanceHistory"] });
      showAlert(data.message, "success", "Absensi Berhasil");
    },
    onError: (err: any) => {
      setGpsError(err.response?.data?.message || "Gagal memproses absen.");
    },
  });

  // Trigger GPS Absen Masuk/Pulang
  const handleGPSAbsen = () => {
    setGpsLoading(true);
    setGpsError(null);

    if (!navigator.geolocation) {
      setGpsError("Geolocation tidak didukung oleh browser Anda.");
      setGpsLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        tapMutation.mutate(coords, {
          onSettled: () => setGpsLoading(false),
        });
      },
      (error) => {
        let msg = "Gagal mendapatkan lokasi Anda.";
        if (error.code === 1) msg = "Izin akses lokasi ditolak oleh browser Anda.";
        else if (error.code === 2) msg = "Lokasi tidak dapat ditentukan.";
        else if (error.code === 3) msg = "Waktu pencarian lokasi habis.";
        setGpsError(msg);
        setGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  // Trigger GPS Istirahat Mulai/Selesai
  const handleGPSBreak = () => {
    setGpsLoading(true);
    setGpsError(null);

    if (!navigator.geolocation) {
      setGpsError("Geolocation tidak didukung oleh browser Anda.");
      setGpsLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (!position.coords.latitude || !position.coords.longitude) {
          setGpsError("Gagal mendapatkan koordinat GPS yang valid dari perangkat Anda. Pastikan GPS aktif.");
          setGpsLoading(false);
          return;
        }
        const coords = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        breakMutation.mutate(coords, {
          onSettled: () => setGpsLoading(false),
        });
      },
      (error) => {
        let msg = "Gagal mendapatkan lokasi Anda.";
        if (error.code === 1) msg = "Izin akses lokasi ditolak oleh browser Anda.";
        else if (error.code === 2) msg = "Lokasi tidak dapat ditentukan.";
        else if (error.code === 3) msg = "Waktu pencarian lokasi habis.";
        setGpsError(msg);
        setGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  // Mutation: Record Break Start / End
  const breakMutation = useMutation({
    mutationFn: async (coords: { latitude: number; longitude: number }) => {
      const res = await api.post("/istirahat", coords);
      return res.data;
    },
    onSuccess: (data) => {
      setGpsError(null);
      queryClient.invalidateQueries({ queryKey: ["attendanceHistory"] });
      showAlert(data.message, "success", "Pencatatan Berhasil");
    },
    onError: (err: any) => {
      setGpsError(err.response?.data?.message || "Gagal mencatat jam istirahat.");
      showAlert(err.response?.data?.message || "Gagal mencatat jam istirahat.", "error", "Gagal");
    },
  });

  const [isBefore12, setIsBefore12] = useState(true);

  useEffect(() => {
    const checkTime = () => {
      const hr = new Date().getHours();
      setIsBefore12(hr < 12);
    };
    checkTime();
    const interval = setInterval(checkTime, 60000);
    return () => clearInterval(interval);
  }, []);

  const todayStr = toLocalDateString(new Date());

  // Cache state to prevent layout flashes
  const [cachedState, setCachedState] = useState<{
    attendance: any;
    isLeave: boolean;
    hasLoaded: boolean;
  }>({ attendance: null, isLeave: false, hasLoaded: false });

  // Load cache on mount to prevent Next.js hydration mismatch
  useEffect(() => {
    try {
      const storedDate = localStorage.getItem("omfai_cached_date");
      if (storedDate === todayStr) {
        const attendance = JSON.parse(localStorage.getItem("omfai_cached_attendance") || "null");
        const isLeave = localStorage.getItem("omfai_cached_on_leave") === "true";
        setCachedState((prev) => {
          if (!prev.hasLoaded) {
            return { attendance, isLeave, hasLoaded: true };
          }
          return prev;
        });
      }
    } catch (e) {
      // ignore
    }
  }, [todayStr]);

  useEffect(() => {
    if (isEmployee && !attendanceLoading && !leaveLoading) {
      const actualAttendance = attendanceHistory?.data
        ? attendanceHistory.data.find((a: any) => a.date === todayStr)
        : null;
      const actualLeave = leaveHistory?.data
        ? leaveHistory.data.some((l: any) => {
            return todayStr >= l.start_date && todayStr <= l.end_date && l.status === "approved";
          })
        : false;

      setCachedState({
        attendance: actualAttendance,
        isLeave: actualLeave,
        hasLoaded: true,
      });

      try {
        localStorage.setItem("omfai_cached_date", todayStr);
        localStorage.setItem("omfai_cached_attendance", JSON.stringify(actualAttendance));
        localStorage.setItem("omfai_cached_on_leave", String(actualLeave));
      } catch (e) {
        // ignore
      }
    }
  }, [attendanceHistory, leaveHistory, attendanceLoading, leaveLoading, isEmployee, todayStr]);

  const todayAttendance = cachedState.attendance;

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

  // Query: Fetch ALL leave requests for Owner/Admin approval
  const { data: allLeaveRequests, isLoading: allLeavesLoading } = useQuery({
    queryKey: ["allLeaveRequestsList"],
    queryFn: async () => {
      const res = await api.get("/leave-requests");
      return res.data.data || [];
    },
    enabled: !!isOwnerOrAdmin,
  });

  // Query: Fetch ALL work hour permissions for Owner/Admin approval
  const { data: allWorkHourPermissions, isLoading: allWorkHourPermissionsLoading } = useQuery({
    queryKey: ["allWorkHourPermissionsList"],
    queryFn: async () => {
      const res = await api.get("/admin/work-hour-permissions");
      return res.data.data || [];
    },
    enabled: !!isOwnerOrAdmin,
  });

  // Mutation: Approve Leave Request
  const approveLeaveMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await api.post(`/leave-requests/${id}/approve`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dashboardSummary"] });
      queryClient.invalidateQueries({ queryKey: ["allLeaveRequestsList"] });
      showAlert("Pengajuan cuti disetujui.", "success", "Persetujuan Berhasil");
    },
    onError: (err: any) => {
      showAlert(err.response?.data?.message || "Gagal menyetujui pengajuan.", "error", "Persetujuan Gagal");
    },
  });

  // Mutation: Reject Leave Request
  const rejectLeaveMutation = useMutation({
    mutationFn: async (payload: { id: number; reason: string }) => {
      const res = await api.post(`/leave-requests/${payload.id}/reject`, {
        rejection_reason: payload.reason,
      });
      return res.data;
    },
    onSuccess: () => {
      setIsRejectionModalOpen(false);
      setRejectionReason("");
      setRejectionId(null);
      setRejectionType(null);
      queryClient.invalidateQueries({ queryKey: ["dashboardSummary"] });
      queryClient.invalidateQueries({ queryKey: ["allLeaveRequestsList"] });
      showAlert("Pengajuan cuti ditolak.", "success", "Penolakan Berhasil");
    },
    onError: (err: any) => {
      setRejectionError(err.response?.data?.message || "Gagal menolak pengajuan.");
    },
  });

  // Mutation: Approve Work Hour Permission
  const approveWorkHourPermissionMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await api.post(`/admin/work-hour-permissions/${id}/approve`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dashboardSummary"] });
      queryClient.invalidateQueries({ queryKey: ["allWorkHourPermissionsList"] });
      showAlert("Pengajuan izin jam kerja disetujui.", "success", "Persetujuan Berhasil");
    },
    onError: (err: any) => {
      showAlert(err.response?.data?.message || "Gagal menyetujui pengajuan.", "error", "Persetujuan Gagal");
    },
  });

  // Mutation: Reject Work Hour Permission
  const rejectWorkHourPermissionMutation = useMutation({
    mutationFn: async (payload: { id: number; reason: string }) => {
      const res = await api.post(`/admin/work-hour-permissions/${payload.id}/reject`, {
        rejection_reason: payload.reason,
      });
      return res.data;
    },
    onSuccess: () => {
      setIsRejectionModalOpen(false);
      setRejectionReason("");
      setRejectionId(null);
      setRejectionType(null);
      queryClient.invalidateQueries({ queryKey: ["dashboardSummary"] });
      queryClient.invalidateQueries({ queryKey: ["allWorkHourPermissionsList"] });
      showAlert("Pengajuan izin jam kerja ditolak.", "success", "Penolakan Berhasil");
    },
    onError: (err: any) => {
      setRejectionError(err.response?.data?.message || "Gagal menolak pengajuan.");
    },
  });

  const handleOpenRejectModal = (id: number, type: "leave" | "wh_permission") => {
    setRejectionId(id);
    setRejectionType(type);
    setRejectionReason("");
    setRejectionError(null);
    setIsRejectionModalOpen(true);
  };

  const handleConfirmReject = () => {
    if (!rejectionReason || rejectionReason.trim().length < 3) {
      setRejectionError("Alasan penolakan harus diisi minimal 3 karakter.");
      return;
    }
    if (rejectionId && rejectionType) {
      if (rejectionType === "leave") {
        rejectLeaveMutation.mutate({ id: rejectionId, reason: rejectionReason });
      } else {
        rejectWorkHourPermissionMutation.mutate({ id: rejectionId, reason: rejectionReason });
      }
    }
  };

  // Query Data Aktivitas Saya Bulan Ini (khusus Employee untuk total lembur)
  const { data: currentMonthActivities } = useQuery({
    queryKey: ["currentMonthOvertimeActivities"],
    queryFn: async () => {
      const start = toLocalDateString(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
      const end = toLocalDateString(new Date());
      const res = await api.get("/activities", {
        params: {
          start_date: start,
          end_date: end,
          per_page: 200,
        }
      });
      return res.data.data?.data || [];
    },
    enabled: !!isEmployee,
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
    const pendingLeaves = allLeaveRequests?.filter((r: any) => r.status === "pending") || [];
    const pendingWorkHourPermissions = allWorkHourPermissions?.filter((r: any) => r.status === "pending") || [];
    const totalPendingRequests = pendingLeaves.length + pendingWorkHourPermissions.length;

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
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold text-zinc-950">Monitoring Ringkasan Perusahaan</h2>
            <p className="text-sm text-zinc-500 font-medium mt-1.5">Pantau kondisi aktivitas seluruh karyawan secara real-time.</p>
          </div>
          {roles.includes("Admin") && (
            <button
              onClick={handleClearCache}
              disabled={isClearingCache}
              className="inline-flex items-center gap-2 bg-red-550 hover:bg-red-100/80 text-red-650 border border-red-100 text-xs font-bold px-4 py-2.5 rounded-xl cursor-pointer transition-all self-start sm:self-center disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isClearingCache ? "animate-spin" : ""}`} />
              {isClearingCache ? "Membersihkan..." : "Bersihkan Cache"}
            </button>
          )}
        </div>

        {/* Persetujuan Pengajuan Karyawan (Hanya tampil jika ada request pending) */}
        {!allLeavesLoading && !allWorkHourPermissionsLoading && totalPendingRequests > 0 && (
          <div className="bg-white rounded-2xl border border-zinc-150 p-6 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h3 className="text-base font-bold text-zinc-955 flex items-center gap-2">
                  <CheckCircle className="h-4.5 w-4.5 text-[#FF8200]" />
                  Persetujuan Pengajuan Karyawan (Pending)
                  <span className="inline-flex items-center justify-center bg-orange-100 text-[#FF8200] text-xs font-bold px-2.5 py-0.5 rounded-full">
                    {totalPendingRequests}
                  </span>
                </h3>
                <p className="text-xs text-zinc-400 font-semibold mt-0.5">
                  Daftar pengajuan cuti/izin dan izin jam kerja karyawan yang memerlukan persetujuan.
                </p>
              </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex gap-4 border-b border-zinc-100 pb-2">
              <button
                onClick={() => setActiveRequestTab("leave")}
                className={`pb-2 text-sm font-bold transition-all relative border-b-2 px-1.5 cursor-pointer ${
                  activeRequestTab === "leave"
                    ? "border-[#FF8200] text-[#FF8200]"
                    : "border-transparent text-zinc-400 hover:text-zinc-650"
                }`}
              >
                Cuti & Izin Kerja ({pendingLeaves.length})
              </button>
              <button
                onClick={() => setActiveRequestTab("wh_permission")}
                className={`pb-2 text-sm font-bold transition-all relative border-b-2 px-1.5 cursor-pointer ${
                  activeRequestTab === "wh_permission"
                    ? "border-[#FF8200] text-[#FF8200]"
                    : "border-transparent text-zinc-400 hover:text-zinc-650"
                }`}
              >
                Izin Jam Kerja ({pendingWorkHourPermissions.length})
              </button>
            </div>

            {/* Content List */}
            <div>
              {activeRequestTab === "leave" ? (
                pendingLeaves.length === 0 ? (
                  <div className="text-center py-6 text-zinc-400 text-xs">
                    Tidak ada pengajuan cuti/izin pending di tab ini.
                  </div>
                ) : (
                  <>
                    {/* Desktop Table View */}
                    <div className="hidden md:block overflow-x-auto border border-zinc-150 rounded-xl shadow-sm">
                      <table className="w-full divide-y divide-zinc-150 text-left text-sm">
                        <thead className="bg-zinc-50/70 font-bold text-zinc-400 uppercase tracking-wider text-xs">
                          <tr>
                            <th className="p-3.5 pl-5">Nama Karyawan</th>
                            <th className="p-3.5">Tipe Pengajuan</th>
                            <th className="p-3.5">Periode Tanggal</th>
                            <th className="p-3.5">Alasan</th>
                            <th className="p-3.5 text-center">Lampiran</th>
                            <th className="p-3.5 text-center">Aksi</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100 font-medium text-zinc-700">
                          {pendingLeaves.map((item: any) => {
                            const typeLabel = item.type === "annual_leave" ? "Cuti Tahunan" : item.type === "sick_leave" ? "Sakit" : "Izin";
                            return (
                              <tr key={item.id} className="hover:bg-zinc-50/30">
                                <td className="p-3.5 pl-5 flex items-center gap-3">
                                  <div className="flex h-8.5 w-8.5 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-700 font-bold text-xs overflow-hidden relative">
                                    {item.employee?.user?.avatar ? (
                                      <img src={api.defaults.baseURL + "/../storage/" + item.employee.user.avatar} className="h-full w-full object-cover" alt={item.employee?.name} />
                                    ) : (
                                      item.employee?.name ? item.employee.name.charAt(0).toUpperCase() : "E"
                                    )}
                                  </div>
                                  <div>
                                    <div className="font-bold text-zinc-900">{item.employee?.name}</div>
                                    <div className="text-xs text-zinc-400 font-mono font-bold mt-0.5">{item.employee?.employee_code}</div>
                                  </div>
                                </td>
                                <td className="p-3.5">
                                  <span className={`inline-block text-xs font-bold px-2.5 py-1 rounded-full border ${
                                    item.type === "annual_leave" 
                                      ? "bg-blue-50 text-blue-700 border-blue-100" 
                                      : item.type === "sick_leave" 
                                      ? "bg-rose-50 text-rose-700 border-rose-100" 
                                      : "bg-amber-50 text-amber-700 border-amber-100"
                                  }`}>
                                    {typeLabel}
                                  </span>
                                </td>
                                <td className="p-3.5 text-zinc-500 font-semibold">
                                  {formatIndonesianDate(item.start_date)} s/d {formatIndonesianDate(item.end_date)}
                                </td>
                                <td className="p-3.5 text-zinc-650 max-w-[200px] break-words whitespace-pre-wrap">
                                  {item.reason}
                                </td>
                                <td className="p-3.5 text-center">
                                  {item.attachment ? (
                                    <a
                                      href={api.defaults.baseURL + "/../storage/" + item.attachment}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-800 font-bold border border-blue-100 bg-blue-50 px-2.5 py-1 rounded-md"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <FileText className="h-3.5 w-3.5" />
                                      Lihat Lampiran
                                    </a>
                                  ) : (
                                    <span className="text-zinc-400">-</span>
                                  )}
                                </td>
                                <td className="p-3.5 text-center">
                                  <div className="flex justify-center gap-2">
                                    <button
                                      onClick={() => approveLeaveMutation.mutate(item.id)}
                                      disabled={approveLeaveMutation.isPending}
                                      className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-100 px-3 py-2 rounded-lg flex items-center gap-1 text-xs font-bold cursor-pointer transition-all disabled:opacity-50"
                                    >
                                      <Check className="h-3 w-3" />
                                      Setujui
                                    </button>
                                    <button
                                      onClick={() => handleOpenRejectModal(item.id, "leave")}
                                      className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-100 px-3 py-2 rounded-lg flex items-center gap-1 text-xs font-bold cursor-pointer transition-all"
                                    >
                                      <Ban className="h-3 w-3" />
                                      Tolak
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile Card List View */}
                    <div className="grid grid-cols-1 gap-4 md:hidden">
                      {pendingLeaves.map((item: any) => {
                        const typeLabel = item.type === "annual_leave" ? "Cuti Tahunan" : item.type === "sick_leave" ? "Sakit" : "Izin";
                        return (
                          <div key={item.id} className="p-4 bg-zinc-50 border border-zinc-150 rounded-xl space-y-3.5">
                            <div className="flex items-center gap-3">
                              <div className="flex h-8.5 w-8.5 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-700 font-bold text-xs overflow-hidden relative">
                                {item.employee?.user?.avatar ? (
                                  <img src={api.defaults.baseURL + "/../storage/" + item.employee.user.avatar} className="h-full w-full object-cover" alt={item.employee?.name} />
                                ) : (
                                  item.employee?.name ? item.employee.name.charAt(0).toUpperCase() : "E"
                                )}
                              </div>
                              <div>
                                <div className="font-bold text-zinc-900 text-sm">{item.employee?.name}</div>
                                <div className="text-xs text-zinc-400 font-mono font-bold">{item.employee?.employee_code}</div>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-xs border-t border-b border-zinc-100 py-2.5">
                              <div>
                                <span className="text-xs text-zinc-400 block font-bold uppercase tracking-wider">Tipe</span>
                                <span className={`inline-block text-xs font-bold px-2 py-0.5 rounded border mt-0.5 ${
                                  item.type === "annual_leave" 
                                    ? "bg-blue-50 text-blue-700 border-blue-100" 
                                    : item.type === "sick_leave" 
                                    ? "bg-rose-50 text-rose-700 border-rose-100" 
                                    : "bg-amber-50 text-amber-700 border-amber-100"
                                }`}>
                                  {typeLabel}
                                </span>
                              </div>
                              <div>
                                <span className="text-xs text-zinc-400 block font-bold uppercase tracking-wider">Periode</span>
                                <span className="font-semibold text-zinc-700 block mt-0.5 text-sm">
                                  {formatIndonesianDate(item.start_date)} s/d {formatIndonesianDate(item.end_date)}
                                </span>
                              </div>
                            </div>
                            <div className="text-xs">
                              <span className="text-xs text-zinc-400 block font-bold uppercase tracking-wider">Alasan</span>
                              <p className="text-zinc-700 mt-1 font-semibold break-words whitespace-pre-wrap text-sm">{item.reason}</p>
                            </div>
                            {item.attachment && (
                              <div className="pt-1">
                                <a
                                  href={api.defaults.baseURL + "/../storage/" + item.attachment}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex w-full justify-center items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 font-bold border border-blue-100 bg-blue-50 px-2.5 py-2 rounded-lg"
                                >
                                  <FileText className="h-4 w-4" />
                                  Lihat Lampiran
                                </a>
                              </div>
                            )}
                            <div className="grid grid-cols-2 gap-3 pt-2">
                              <button
                                onClick={() => approveLeaveMutation.mutate(item.id)}
                                disabled={approveLeaveMutation.isPending}
                                className="w-full bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-100 py-2.5 rounded-lg flex items-center justify-center gap-1 text-xs font-bold cursor-pointer transition-all disabled:opacity-50"
                              >
                                <Check className="h-3.5 w-3.5" />
                                Setujui
                              </button>
                              <button
                                onClick={() => handleOpenRejectModal(item.id, "leave")}
                                className="w-full bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-100 py-2.5 rounded-lg flex items-center justify-center gap-1 text-xs font-bold cursor-pointer transition-all"
                              >
                                <Ban className="h-3.5 w-3.5" />
                                Tolak
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )
              ) : (
                pendingWorkHourPermissions.length === 0 ? (
                  <div className="text-center py-6 text-zinc-400 text-xs">
                    Tidak ada pengajuan izin jam kerja pending di tab ini.
                  </div>
                ) : (
                  <>
                    {/* Desktop Table View */}
                    <div className="hidden md:block overflow-x-auto border border-zinc-150 rounded-xl shadow-sm">
                      <table className="w-full divide-y divide-zinc-150 text-left text-sm">
                        <thead className="bg-zinc-50/70 font-bold text-zinc-400 uppercase tracking-wider text-xs">
                          <tr>
                            <th className="p-3.5 pl-5">Nama Karyawan</th>
                            <th className="p-3.5">Tipe Izin</th>
                            <th className="p-3.5">Tanggal & Jam</th>
                            <th className="p-3.5">Alasan</th>
                            <th className="p-3.5 text-center">Lampiran</th>
                            <th className="p-3.5 text-center">Aksi</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100 font-medium text-zinc-700">
                          {pendingWorkHourPermissions.map((item: any) => {
                            const typeLabel = item.type === "out_temporary" ? "Keluar Sementara" : item.type === "arrive_late" ? "Datang Terlambat" : "Pulang Cepat";
                            const timeRange = (item.type === "leave_early") 
                              ? `Mulai ${item.start_time ? item.start_time.substring(0, 5) : "--:--"}`
                              : `${item.start_time ? item.start_time.substring(0, 5) : "--:--"} s/d ${item.end_time ? item.end_time.substring(0, 5) : "--:--"}`;
                            return (
                              <tr key={item.id} className="hover:bg-zinc-50/30">
                                <td className="p-3.5 pl-5 flex items-center gap-3">
                                  <div className="flex h-8.5 w-8.5 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-700 font-bold text-xs overflow-hidden relative">
                                    {item.employee?.user?.avatar ? (
                                      <img src={api.defaults.baseURL + "/../storage/" + item.employee.user.avatar} className="h-full w-full object-cover" alt={item.employee?.name} />
                                    ) : (
                                      item.employee?.name ? item.employee.name.charAt(0).toUpperCase() : "E"
                                    )}
                                  </div>
                                  <div>
                                    <div className="font-bold text-zinc-900">{item.employee?.name}</div>
                                    <div className="text-xs text-zinc-400 font-mono font-bold mt-0.5">{item.employee?.employee_code}</div>
                                  </div>
                                </td>
                                <td className="p-3.5">
                                  <span className={`inline-block text-xs font-bold px-2.5 py-1 rounded-full border ${
                                    item.type === "arrive_late" 
                                      ? "bg-amber-50 text-amber-700 border-amber-100" 
                                      : item.type === "leave_early" 
                                      ? "bg-violet-50 text-violet-700 border-violet-100" 
                                      : "bg-purple-50 text-purple-700 border-purple-100"
                                  }`}>
                                    {typeLabel}
                                  </span>
                                </td>
                                <td className="p-3.5 text-zinc-500 font-semibold">
                                  <div className="text-zinc-700 font-bold text-sm">{formatIndonesianDate(item.date)}</div>
                                  <div className="text-xs text-zinc-400 mt-0.5">{timeRange}</div>
                                </td>
                                <td className="p-3.5 text-zinc-650 max-w-[200px] break-words whitespace-pre-wrap">
                                  {item.reason}
                                </td>
                                <td className="p-3.5 text-center">
                                  {item.attachment ? (
                                    <a
                                      href={api.defaults.baseURL + "/../storage/" + item.attachment}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-800 font-bold border border-blue-100 bg-blue-50 px-2.5 py-1 rounded-md"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <FileText className="h-3.5 w-3.5" />
                                      Lihat Lampiran
                                    </a>
                                  ) : (
                                    <span className="text-zinc-400">-</span>
                                  )}
                                </td>
                                <td className="p-3.5 text-center">
                                  <div className="flex justify-center gap-2">
                                    <button
                                      onClick={() => approveWorkHourPermissionMutation.mutate(item.id)}
                                      disabled={approveWorkHourPermissionMutation.isPending}
                                      className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-100 px-3 py-2 rounded-lg flex items-center gap-1 text-xs font-bold cursor-pointer transition-all disabled:opacity-50"
                                    >
                                      <Check className="h-3 w-3" />
                                      Setujui
                                    </button>
                                    <button
                                      onClick={() => handleOpenRejectModal(item.id, "wh_permission")}
                                      className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-100 px-3 py-2 rounded-lg flex items-center gap-1 text-xs font-bold cursor-pointer transition-all"
                                    >
                                      <Ban className="h-3 w-3" />
                                      Tolak
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile Card List View */}
                    <div className="grid grid-cols-1 gap-4 md:hidden">
                      {pendingWorkHourPermissions.map((item: any) => {
                        const typeLabel = item.type === "out_temporary" ? "Keluar Sementara" : item.type === "arrive_late" ? "Datang Terlambat" : "Pulang Cepat";
                        const timeRange = (item.type === "leave_early") 
                          ? `Mulai ${item.start_time ? item.start_time.substring(0, 5) : "--:--"}`
                          : `${item.start_time ? item.start_time.substring(0, 5) : "--:--"} s/d ${item.end_time ? item.end_time.substring(0, 5) : "--:--"}`;
                        return (
                          <div key={item.id} className="p-4 bg-zinc-50 border border-zinc-150 rounded-xl space-y-3.5">
                            <div className="flex items-center gap-3">
                              <div className="flex h-8.5 w-8.5 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-700 font-bold text-xs overflow-hidden relative">
                                {item.employee?.user?.avatar ? (
                                  <img src={api.defaults.baseURL + "/../storage/" + item.employee.user.avatar} className="h-full w-full object-cover" alt={item.employee?.name} />
                                ) : (
                                  item.employee?.name ? item.employee.name.charAt(0).toUpperCase() : "E"
                                )}
                              </div>
                              <div>
                                <div className="font-bold text-zinc-900 text-sm">{item.employee?.name}</div>
                                <div className="text-xs text-zinc-400 font-mono font-bold">{item.employee?.employee_code}</div>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-xs border-t border-b border-zinc-100 py-2.5">
                              <div>
                                <span className="text-xs text-zinc-400 block font-bold uppercase tracking-wider">Tipe Izin</span>
                                <span className={`inline-block text-xs font-bold px-2 py-0.5 rounded border mt-0.5 ${
                                  item.type === "arrive_late" 
                                    ? "bg-amber-50 text-amber-700 border-amber-100" 
                                    : item.type === "leave_early" 
                                    ? "bg-violet-50 text-violet-700 border-violet-100" 
                                    : "bg-purple-50 text-purple-700 border-purple-100"
                                }`}>
                                  {typeLabel}
                                </span>
                              </div>
                              <div>
                                <span className="text-xs text-zinc-400 block font-bold uppercase tracking-wider">Tanggal & Jam</span>
                                <div className="mt-0.5">
                                  <span className="font-semibold text-zinc-700 block text-sm">{formatIndonesianDate(item.date)}</span>
                                  <span className="text-xs text-zinc-400 block font-mono font-bold mt-0.5">{timeRange}</span>
                                </div>
                              </div>
                            </div>
                            <div className="text-xs">
                              <span className="text-xs text-zinc-400 block font-bold uppercase tracking-wider">Alasan</span>
                              <p className="text-zinc-700 mt-1 font-semibold break-words whitespace-pre-wrap text-sm">{item.reason}</p>
                            </div>
                            {item.attachment && (
                              <div className="pt-1">
                                <a
                                  href={api.defaults.baseURL + "/../storage/" + item.attachment}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex w-full justify-center items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 font-bold border border-blue-100 bg-blue-50 px-2.5 py-2 rounded-lg"
                                >
                                  <FileText className="h-4 w-4" />
                                  Lihat Lampiran
                                </a>
                              </div>
                            )}
                            <div className="grid grid-cols-2 gap-3 pt-2">
                              <button
                                onClick={() => approveWorkHourPermissionMutation.mutate(item.id)}
                                disabled={approveWorkHourPermissionMutation.isPending}
                                className="w-full bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-100 py-2.5 rounded-lg flex items-center justify-center gap-1 text-xs font-bold cursor-pointer transition-all disabled:opacity-50"
                              >
                                <Check className="h-3.5 w-3.5" />
                                Setujui
                              </button>
                              <button
                                onClick={() => handleOpenRejectModal(item.id, "wh_permission")}
                                className="w-full bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-100 py-2.5 rounded-lg flex items-center justify-center gap-1 text-xs font-bold cursor-pointer transition-all"
                              >
                                <Ban className="h-3.5 w-3.5" />
                                Tolak
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )
              )}
            </div>
          </div>
        )}

        {/* Widget Kehadiran Hari Ini */}
        {!isDashboardLoading && data.attendanceSummary && (
          <div className="bg-white rounded-2xl border border-zinc-150 p-6 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
              <div>
                <h3 className="text-base font-bold text-zinc-950 flex items-center gap-2">
                  <Calendar className="h-4.5 w-4.5 text-[#FF8200]" />
                  Monitoring Kehadiran Hari Ini
                </h3>
                <p className="text-xs text-zinc-400 font-semibold mt-0.5">
                  Daftar kehadiran dan perizinan karyawan tanggal {formatIndonesianDate(new Date().toISOString().slice(0, 10))}.
                </p>
              </div>
              {activeAttendanceTab !== "all" && (
                <button
                  onClick={() => setActiveAttendanceTab("all")}
                  className="bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs font-bold px-3.5 py-1.5 rounded-lg border border-zinc-200 cursor-pointer transition-all self-start sm:self-center"
                >
                  Tampilkan Semua Karyawan
                </button>
              )}
            </div>

            {/* Filter Tabs */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 border-b border-zinc-100 pb-4">
              <button
                onClick={() => setActiveAttendanceTab("present")}
                className={`px-4 py-3 rounded-xl border text-sm font-bold transition-all text-left flex flex-col justify-between cursor-pointer ${
                  activeAttendanceTab === "present"
                    ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                    : "bg-emerald-50/50 text-emerald-800 border-emerald-100 hover:bg-emerald-50"
                }`}
              >
                <span className={`text-xs uppercase tracking-wider font-bold ${
                  activeAttendanceTab === "present" ? "text-white" : "text-emerald-600"
                }`}>Tepat Waktu</span>
                <span className="text-3xl font-extrabold mt-1">
                  {data.attendanceSummary.onTimeCount}
                </span>
              </button>

              <button
                onClick={() => setActiveAttendanceTab("late")}
                className={`px-4 py-3 rounded-xl border text-sm font-bold transition-all text-left flex flex-col justify-between cursor-pointer ${
                  activeAttendanceTab === "late"
                    ? "bg-amber-600 text-white border-amber-600 shadow-sm"
                    : "bg-amber-50/50 text-amber-850 border-amber-100 hover:bg-amber-50"
                }`}
              >
                <span className={`text-xs uppercase tracking-wider font-bold ${
                  activeAttendanceTab === "late" ? "text-white" : "text-amber-750"
                }`}>Terlambat</span>
                <span className="text-3xl font-extrabold mt-1">
                  {data.attendanceSummary.lateCount}
                </span>
              </button>

              <button
                onClick={() => setActiveAttendanceTab("leave")}
                className={`px-4 py-3 rounded-xl border text-sm font-bold transition-all text-left flex flex-col justify-between cursor-pointer ${
                  activeAttendanceTab === "leave"
                    ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                    : "bg-blue-50/50 text-blue-800 border-blue-100 hover:bg-blue-50"
                }`}
              >
                <span className={`text-xs uppercase tracking-wider font-bold ${
                  activeAttendanceTab === "leave" ? "text-white" : "text-blue-650"
                }`}>Cuti / Izin</span>
                <span className="text-3xl font-extrabold mt-1">
                  {data.attendanceSummary.leaveCount}
                </span>
              </button>

              <button
                onClick={() => setActiveAttendanceTab("wh_permission")}
                className={`px-4 py-3 rounded-xl border text-sm font-bold transition-all text-left flex flex-col justify-between cursor-pointer ${
                  activeAttendanceTab === "wh_permission"
                    ? "bg-purple-600 text-white border-purple-600 shadow-sm"
                    : "bg-purple-50/50 text-purple-850 border-purple-100 hover:bg-purple-50"
                }`}
              >
                <span className={`text-xs uppercase tracking-wider font-bold ${
                  activeAttendanceTab === "wh_permission" ? "text-white" : "text-purple-700"
                }`}>Izin Jam Kerja</span>
                <span className="text-3xl font-extrabold mt-1">
                  {data.attendanceSummary.whPermissionCount || 0}
                </span>
              </button>

              <button
                onClick={() => setActiveAttendanceTab("absent")}
                className={`px-4 py-3 rounded-xl border text-sm font-bold transition-all text-left flex flex-col justify-between cursor-pointer ${
                  activeAttendanceTab === "absent"
                    ? "bg-rose-600 text-white border-rose-600 shadow-sm"
                    : "bg-rose-50/50 text-rose-800 border-rose-100 hover:bg-rose-50"
                }`}
              >
                <span className={`text-xs uppercase tracking-wider font-bold ${
                  activeAttendanceTab === "absent" ? "text-white" : "text-rose-700"
                }`}>Belum Absen</span>
                <span className="text-3xl font-extrabold mt-1">
                  {data.attendanceSummary.absentCount}
                </span>
              </button>
            </div>

            {/* List Karyawan */}
            <div className="overflow-x-auto border border-zinc-150 rounded-xl shadow-sm">
              <table className="w-full divide-y divide-zinc-150 text-left text-sm">
                <thead className="bg-zinc-50/70 font-bold text-zinc-400 uppercase tracking-wider text-xs">
                  <tr>
                    <th className="p-3.5 pl-5">Nama Karyawan</th>
                    <th className="p-3.5">Absen Masuk</th>
                    <th className="p-3.5">Jam Istirahat</th>
                    <th className="p-3.5">Absen Pulang</th>
                    <th className="p-3.5 text-center">Status Kehadiran</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 font-medium text-zinc-700">
                  {data.attendanceSummary.details
                    .filter((item: any) => {
                      if (activeAttendanceTab === "all") return true;
                      return item.status === activeAttendanceTab;
                    })
                    .map((item: any) => {
                      return (
                        <tr key={item.employee_id} className="hover:bg-zinc-50/30">
                          <td className="p-3.5 pl-5 flex items-center gap-3">
                            <div className="flex h-8.5 w-8.5 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-700 font-bold text-xs overflow-hidden relative">
                              {item.avatar_url ? (
                                <img src={item.avatar_url} className="h-full w-full object-cover" alt={item.name} />
                              ) : (
                                item.name.charAt(0).toUpperCase()
                              )}
                            </div>
                            <div>
                              <div className="font-bold text-zinc-900 flex items-center gap-1.5">
                                {item.name}
                                {item.is_earliest && (
                                  <span className="inline-flex items-center gap-1 bg-yellow-50 text-yellow-800 border border-yellow-200 text-xs px-2 py-0.5 rounded-md font-extrabold shadow-sm animate-pulse">
                                    <Trophy className="h-3 w-3 text-yellow-600 fill-yellow-500 shrink-0" />
                                    Datang Tercepat!
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-zinc-400 font-mono font-bold mt-0.5">{item.employee_code}</div>
                            </div>
                          </td>
                          <td className="p-3.5 font-mono text-zinc-800 font-bold">
                            <div className="flex items-center gap-1">
                              {item.check_in}
                              {item.is_earliest && (
                                <span title="Datang Tercepat!">
                                  <Trophy className="h-3.5 w-3.5 text-yellow-500 fill-yellow-400 shrink-0" />
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-3.5 font-mono text-zinc-850 font-bold">
                            {item.break_start !== "-"
                              ? `${item.break_start} - ${item.break_end !== "-" ? item.break_end : "..."}`
                              : "-"}
                          </td>
                          <td className="p-3.5 font-mono text-zinc-800 font-bold">{item.check_out}</td>
                          <td className="p-3.5 text-center">
                            <span
                              className={`inline-block text-xs font-extrabold px-2.5 py-1 rounded-full border uppercase tracking-wider ${
                                item.status === "present"
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                                  : item.status === "late"
                                  ? "bg-amber-50 text-amber-700 border-amber-100"
                                  : item.status === "leave"
                                  ? "bg-blue-50 text-blue-700 border-blue-100"
                                  : item.status === "wh_permission"
                                  ? "bg-purple-50 text-purple-700 border-purple-100"
                                  : "bg-rose-50 text-rose-700 border-rose-100"
                              }`}
                            >
                              {item.status === "late"
                                ? `TERLAMBAT (${formatLateMinutes(item.late_minutes)})`
                                : item.status_label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  {data.attendanceSummary.details.filter((item: any) => {
                    if (activeAttendanceTab === "all") return true;
                    return item.status === activeAttendanceTab;
                  }).length === 0 && (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-zinc-400 text-xs">
                        Tidak ada karyawan dengan status ini untuk hari ini.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}



        {/* 1. Summary Cards */}
        {isDashboardLoading ? (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-white p-6 rounded-2xl border border-zinc-100 animate-pulse h-28" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((item: any) => (
              <div
                key={item.name}
                className="bg-white overflow-hidden rounded-2xl border border-zinc-150 p-6 flex items-center justify-between shadow-sm"
              >
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">{item.name}</span>
                  <div className="text-3xl font-extrabold text-zinc-900 mt-1">{item.value}</div>
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
                <h3 className="text-base font-bold text-zinc-950">Aktivitas Terbaru</h3>
                <p className="text-xs text-zinc-500 mt-0.5">Daftar pembaruan aktivitas kerja terkini.</p>
              </div>
              <a href="/activities" className="text-sm font-bold text-[#FF8200] hover:underline flex items-center gap-1">
                Semua Aktivitas <ArrowRight className="h-3 w-3" />
              </a>
            </div>

            <div className="flex-1 overflow-y-auto mt-4 space-y-4">
              {isDashboardLoading ? (
                [...Array(3)].map((_, i) => (
                  <div key={i} className="flex gap-4 items-center animate-pulse py-2">
                    <div className="h-10 w-10 rounded-full bg-zinc-100 shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3.5 bg-zinc-100 rounded w-1/3" />
                      <div className="h-2.5 bg-zinc-100 rounded w-2/3" />
                    </div>
                  </div>
                ))
              ) : data.recentActivities.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center text-zinc-400 py-12">
                  <ClipboardCheck className="h-8 w-8 mb-2 text-zinc-300" />
                  <span className="text-sm">Belum ada aktivitas yang tercatat.</span>
                </div>
              ) : (
                data.recentActivities.map((act: any) => (
                  <div key={act.id} className="flex items-start gap-4 py-3.5 border-b border-zinc-50 last:border-0">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange-100 text-[#FF8200] font-bold text-sm overflow-hidden">
                      {act.employeeAvatarUrl ? (
                        <img src={act.employeeAvatarUrl} className="h-full w-full object-cover" alt={act.employeeName} />
                      ) : (
                        act.employeeName.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="text-sm font-bold text-zinc-900 truncate">{act.employeeName}</h4>
                        <span className="text-xs text-zinc-400 font-semibold">
                          {new Date(act.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      <div className="text-sm text-zinc-700 mt-1 break-words whitespace-pre-wrap">{renderTextWithLinks(act.activity)}</div>
                      {act.progressNote && (
                        <div className="text-xs text-zinc-500 font-semibold italic mt-1.5 bg-zinc-50 border border-zinc-100/60 px-2.5 py-1 rounded-lg inline-block max-w-full break-words">
                          Progress: {act.progressNote}
                        </div>
                      )}
                      {act.ownerFeedback && (
                        <div className="text-xs text-orange-700 font-semibold mt-1.5 bg-orange-50/30 border border-orange-100/60 px-2.5 py-1 rounded-lg inline-block max-w-full break-words">
                          Feedback: {act.ownerFeedback}
                        </div>
                      )}
                      {act.proofImageUrl && (
                        <div className="mt-1.5 flex items-center gap-1 text-xs">
                          <span className="text-zinc-400">🖼️</span>
                          <a
                            href={act.proofImageUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#FF8200] hover:text-[#e07200] hover:underline font-bold"
                          >
                            Lihat Foto Bukti
                          </a>
                        </div>
                      )}
                      <div className="flex flex-col gap-1.5 mt-2.5">
                        <div className="flex items-center gap-2.5">
                          <span className="px-2.5 py-0.5 rounded-full bg-zinc-100 border border-zinc-200 text-zinc-650 font-bold text-[10px] uppercase tracking-wide whitespace-nowrap">
                            {act.categoryName}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2.5 py-0.5 rounded uppercase ${
                              act.status === "in_progress"
                                ? "bg-blue-50 text-blue-600 border border-blue-100"
                                : act.status === "on_hold"
                                ? "bg-orange-50 text-orange-600 border border-orange-150"
                                : "bg-green-50 text-green-600 border border-green-100"
                            }`}
                          >
                            {act.status.replace("_", " ")}
                          </span>
                          <span className="text-xs text-zinc-500 font-semibold flex items-center gap-1">
                            <span>⏱️</span>
                            <span>{formatActiveDuration(act.createdAt, act.completedAt, act.status, act.logs, holidaySet)}</span>
                            {act.status === "in_progress" && (
                              <span className="text-zinc-400 font-medium text-[9.5px]">(aktif)</span>
                            )}
                          </span>
                        </div>
                        {formatActiveOvertimeDuration(act.createdAt, act.completedAt, act.logs, holidaySet, act.holdReason) && (
                          <div className="flex items-center gap-1 text-xs text-orange-600 font-bold">
                            <span>🌙</span>
                            <span>Time Log: {formatActiveOvertimeDuration(act.createdAt, act.completedAt, act.logs, holidaySet, act.holdReason)}</span>
                          </div>
                        )}
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
                <h3 className="text-base font-bold text-zinc-950 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-orange-500" />
                  Mengalami Kendala (On Hold)
                </h3>
                <p className="text-xs text-zinc-500 mt-0.5">Karyawan yang pekerjaannya terhenti sementara.</p>
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
                    <span className="text-sm text-zinc-500 font-medium">Lancar! Tidak ada kendala saat ini.</span>
                  </div>
                ) : (
                  data.onHoldActivities.map((act: any) => (
                    <div key={act.id} className="p-3.5 bg-orange-50/30 border border-orange-100 rounded-xl">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-bold text-zinc-900">{act.employeeName}</span>
                        <span className="text-xs text-zinc-400 font-semibold">
                          {formatIndonesianDate(act.updatedAt, { showYear: false })}
                        </span>
                      </div>
                      <div className="text-sm text-zinc-700 mt-1.5 break-words whitespace-pre-wrap">
                        <strong>Tugas:</strong> {renderTextWithLinks(act.activity)}
                      </div>
                      {act.referenceLink && (
                        <div className="mt-1.5 flex items-center gap-1 text-xs">
                          <span className="text-zinc-400">🔗</span>
                          <a
                            href={act.referenceLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#FF8200] hover:text-[#e07200] hover:underline font-bold"
                          >
                            Buka Link Bukti / Pekerjaan
                          </a>
                        </div>
                      )}
                      {act.proofImageUrl && (
                        <div className="mt-1.5 flex items-center gap-1 text-xs">
                          <span className="text-zinc-400">🖼️</span>
                          <a
                            href={act.proofImageUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#FF8200] hover:text-[#e07200] hover:underline font-bold"
                          >
                            Lihat Foto Bukti
                          </a>
                        </div>
                      )}
                      <div className="text-sm text-orange-700 font-semibold mt-1.5 bg-white border border-orange-150 px-2 py-1 rounded-lg break-words whitespace-pre-wrap">
                        <strong>Kendala:</strong> {renderTextWithLinks(act.holdReason ? act.holdReason.replace(/Lembur/g, "Time Log") : "")}
                      </div>
                      {roles.includes("Owner") && (
                        <button
                          onClick={() => {
                            setReviewActivity(act);
                            setIsReviewOpen(true);
                          }}
                          className="mt-2.5 flex items-center justify-center gap-1.5 w-full py-2 px-3 text-xs font-bold text-white bg-[#FF8200] hover:bg-[#e07200] rounded-lg shadow-sm shadow-orange-100 cursor-pointer"
                        >
                          <MessageSquare className="h-3.5 w-3.5" />
                          Beri Feedback / ACC
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Category Summary */}
            <div className="bg-white rounded-2xl border border-zinc-155 p-6 shadow-sm">
              <div className="border-b border-zinc-100 pb-3 mb-4">
                <h3 className="text-base font-bold text-zinc-950 flex items-center gap-2">
                  <FolderOpen className="h-4 w-4 text-zinc-400" />
                  Distribusi Kategori
                </h3>
              </div>

              <div className="space-y-3.5">
                {isDashboardLoading ? (
                  <div className="space-y-3 py-2">
                    <div className="h-4 bg-zinc-100 rounded animate-pulse" />
                    <div className="h-4 bg-zinc-100 rounded animate-pulse" />
                  </div>
                ) : data.categorySummary.length === 0 ? (
                  <span className="text-sm text-zinc-400">Belum ada data distribusi.</span>
                ) : (
                  data.categorySummary.map((cat: any) => {
                    const percentage = data.totalActivities > 0 ? (cat.count / data.totalActivities) * 100 : 0;
                    return (
                      <div key={cat.categoryName} className="space-y-1.5">
                        <div className="flex justify-between text-sm font-medium text-zinc-700">
                          <span>{cat.categoryName}</span>
                          <span className="font-bold text-zinc-900">{cat.count} tugas ({Math.round(percentage)}%)</span>
                        </div>
                        <div className="w-full bg-zinc-100 h-2.5 rounded-full overflow-hidden">
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

        {/* Review Modal for Owner */}
        {roles.includes("Owner") && (
          <ReviewModal
            isOpen={isReviewOpen}
            onClose={() => {
              setIsReviewOpen(false);
              setReviewActivity(null);
            }}
            activity={reviewActivity}
            onSuccess={() => {
              queryClient.invalidateQueries({ queryKey: ["dashboardSummary"] });
            }}
          />
        )}

        {/* Custom Alert Modal */}
        <AlertModal
          isOpen={alertConfig.isOpen}
          onClose={() => setAlertConfig((prev) => ({ ...prev, isOpen: false }))}
          title={alertConfig.title}
          message={alertConfig.message}
          variant={alertConfig.variant}
        />

        {/* Modal Alasan Penolakan Pengajuan */}
        {isRejectionModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/80 backdrop-blur-sm px-4">
            <div className="bg-white rounded-2xl border border-zinc-100 shadow-2xl w-full max-w-sm p-6 overflow-hidden">
              <div className="flex items-center justify-between border-b border-zinc-100 pb-3 mb-5">
                <h3 className="text-sm font-bold text-zinc-955">Masukkan Alasan Penolakan</h3>
                <button
                  onClick={() => setIsRejectionModalOpen(false)}
                  className="p-1 text-zinc-400 hover:text-zinc-700 rounded-lg cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {rejectionError && (
                <div className="rounded-lg bg-red-50 p-3 text-xs font-semibold text-red-600 border border-red-100 mb-4">
                  {rejectionError}
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1">
                    Alasan Penolakan
                  </label>
                  <textarea
                    rows={3}
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-xs text-zinc-950 focus:outline-none focus:ring-2 focus:ring-orange-500/10 focus:border-[#FF8200]"
                    placeholder="Masukkan alasan mengapa pengajuan ditolak..."
                  />
                </div>

                <div className="pt-4 flex gap-3 border-t border-zinc-100">
                  <button
                    type="button"
                    onClick={() => setIsRejectionModalOpen(false)}
                    className="flex-1 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs font-bold py-2.5 rounded-lg transition-all cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    onClick={handleConfirmReject}
                    disabled={rejectLeaveMutation.isPending || rejectWorkHourPermissionMutation.isPending}
                    className="flex-1 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold py-2.5 rounded-lg transition-all cursor-pointer flex justify-center items-center disabled:opacity-50"
                  >
                    {rejectLeaveMutation.isPending || rejectWorkHourPermissionMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Memproses...
                      </>
                    ) : (
                      "Tolak Pengajuan"
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </DashboardLayout>
    );
  }

  // RENDERING TAMPILAN EMPLOYEE
  const recentActivities = employeeActivitiesData?.data || [];
  const monthActivities = currentMonthActivities || [];
  const totalOwn = monthActivities.length;
  const ownInProgress = monthActivities.filter((a: any) => a.status === "in_progress").length;
  const ownOnHold = monthActivities.filter((a: any) => a.status === "on_hold").length;
  const ownDone = monthActivities.filter((a: any) => a.status === "done").length;

  // Calculate employee monthly overtime minutes sum
  const totalOvertimeMinutes = (currentMonthActivities || []).reduce((acc: number, act: any) => {
    return acc + calculateOvertimeMinutes(act.created_at, act.completed_at, act.logs, holidaySet, act.hold_reason);
  }, 0);
  const employeeOvertimeHours = Math.floor(totalOvertimeMinutes / 60);
  const employeeOvertimeMins = totalOvertimeMinutes % 60;
  const employeeOvertimeMinutesSumFormatted = totalOvertimeMinutes > 0
    ? (employeeOvertimeHours > 0 ? `${employeeOvertimeHours} jam ${employeeOvertimeMins} menit` : `${employeeOvertimeMins} menit`)
    : "0 menit";

  // Hitung statistik absensi karyawan untuk bulan berjalan saat ini
  const currentMonthStr = new Date().toISOString().slice(0, 7); // e.g. "2026-06"
  const dashboardEmployeeGrid = isEmployee
    ? generateMonthlyGrid(currentMonthStr, attendanceHistory?.data || [], leaveHistory?.data || [], holidaysData || [], workHourPermissions?.data || [])
    : [];

  const totalPresent = dashboardEmployeeGrid.filter((d: any) => d.status === "present").length;
  const totalLate = dashboardEmployeeGrid.filter((d: any) => d.status === "late").length;
  const totalLeave = dashboardEmployeeGrid.filter((d: any) => ["annual_leave", "sick_leave", "permission"].includes(d.status)).length;
  const totalWhPermissions = dashboardEmployeeGrid.filter((d: any) => d.whPermissionId !== null).length;
  const totalAbsent = dashboardEmployeeGrid.filter((d: any) => d.status === "absent").length;

  // Check if today is approved leave day
  const isTodayOnLeave = cachedState.isLeave;
  const showLoading = !cachedState.hasLoaded && (attendanceLoading || leaveLoading);

  return (
    <DashboardLayout>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-zinc-950">Halo, {user.name}!</h2>
          <p className="text-sm text-zinc-500 font-medium mt-1.5">Catat dan kelola aktivitas harian Anda dengan mudah di bawah ini.</p>
        </div>
      </div>

      {/* Widget Absen Cepat Karyawan */}
      <div className="bg-white rounded-2xl border border-zinc-150 shadow-sm p-4 md:p-6 space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-zinc-950 flex items-center gap-2">
              <Clock className="h-4 w-4 text-[#FF8200]" />
              Absen Masuk & Pulang
            </h3>
            <p className="text-[11px] text-zinc-400 font-semibold">
              Pastikan GPS Anda aktif dan berada di dalam radius kantor untuk menyetor kehadiran.
            </p>
          </div>
          
          {/* Geofence Alert */}
          {geofences && geofences.length > 0 && (
            <div className="bg-orange-50/50 rounded-xl p-2.5 px-4 border border-orange-100 flex items-center gap-2 text-xs text-orange-850">
              <MapPin className="h-4 w-4 shrink-0 text-[#FF8200]" />
              <span className="font-bold text-[11px]">
                Radius Kantor: {geofences.map((g: any) => g.name).join(", ")}
              </span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center border border-zinc-100 rounded-2xl p-4 md:p-5 bg-zinc-50/30">
          {/* Info Tanggal */}
          <div className="space-y-1 md:col-span-2 md:border-r md:border-zinc-100 md:pr-4">
            <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Tanggal Hari Ini</p>
            <p className="text-sm font-bold text-zinc-950">{formatIndonesianDate(todayStr)}</p>
          </div>

          {/* Absen Masuk Status */}
          <div className="space-y-1 md:col-span-2 md:border-r md:border-zinc-100 md:px-4">
            <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Absen Masuk</p>
            <div className="flex items-center gap-2">
              <p className="text-base font-mono font-bold text-zinc-800">
                {todayAttendance?.check_in ? todayAttendance.check_in.substring(0, 5) : "--:--"}
              </p>
              {todayAttendance?.status && (
                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                  todayAttendance.status === "present" ? "bg-emerald-50 text-emerald-700 border border-emerald-100" : "bg-amber-50 text-amber-700 border border-amber-100"
                }`}>
                  {todayAttendance.status === "present" ? "Tepat Waktu" : "Terlambat"}
                </span>
              )}
            </div>
          </div>

          {/* Jam Istirahat Status */}
          <div className="space-y-1 md:col-span-3 md:border-r md:border-zinc-100 md:px-4">
            <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Jam Istirahat</p>
            <div className="flex items-center gap-2">
              <p className="text-base font-mono font-bold text-zinc-800">
                {todayAttendance?.break_start
                  ? `${todayAttendance.break_start.substring(0, 5)} - ${
                      todayAttendance.break_end ? todayAttendance.break_end.substring(0, 5) : "--:--"
                    }`
                  : "--:--"}
              </p>
              {todayAttendance?.break_start && !todayAttendance?.break_end && (
                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-100 animate-pulse">
                  Sedang Istirahat
                </span>
              )}
              {todayAttendance?.break_start && todayAttendance?.break_end && (
                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                  Selesai
                </span>
              )}
            </div>
          </div>

          {/* Absen Pulang Status */}
          <div className="space-y-1 md:col-span-2 md:border-r md:border-zinc-100 md:px-4">
            <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Absen Pulang</p>
            <p className="text-base font-mono font-bold text-zinc-800">
              {todayAttendance?.check_out ? todayAttendance.check_out.substring(0, 5) : "--:--"}
            </p>
          </div>

          {/* Tombol Absen / Istirahat */}
          <div className="md:col-span-3 md:pl-4 flex flex-col gap-2 justify-stretch md:justify-end">
            <button
              onClick={handleGPSAbsen}
              disabled={
                gpsLoading ||
                tapMutation.isPending ||
                showLoading ||
                (todayAttendance?.check_in && todayAttendance?.check_out) ||
                (isTodayOnLeave && !todayAttendance?.check_in) ||
                (todayAttendance?.check_in && todayAttendance?.break_start && !todayAttendance?.break_end)
              }
              className="w-full bg-[#FF8200] hover:bg-[#e07200] disabled:bg-zinc-100 disabled:text-zinc-400 disabled:border-zinc-150 disabled:shadow-none text-white font-bold py-2.5 px-4 rounded-xl shadow-md shadow-orange-500/10 hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer text-xs whitespace-nowrap"
            >
              {gpsLoading || tapMutation.isPending || showLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {showLoading ? "Memuat status..." : "Memverifikasi..."}
                </>
              ) : isTodayOnLeave && !todayAttendance?.check_in ? (
                <>
                  <Ban className="h-4 w-4 text-zinc-400" />
                  Sedang Cuti / Izin
                </>
              ) : todayAttendance?.check_in && todayAttendance?.check_out ? (
                <>
                  <CheckCircle className="h-4 w-4 text-zinc-400" />
                  Sudah Absen Hari Ini
                </>
              ) : todayAttendance?.check_in ? (
                <>
                  <Clock className="h-4 w-4" />
                  {todayAttendance?.break_start && !todayAttendance?.break_end
                    ? "Selesaikan Istirahat Dulu"
                    : "Absen Pulang (Clock Out)"}
                </>
              ) : (
                <>
                  <Clock className="h-4 w-4" />
                  Absen Masuk (Clock In)
                </>
              )}
            </button>

            {/* Tombol Istirahat khusus jika sudah Clock In dan belum Clock Out */}
            {todayAttendance?.check_in && !todayAttendance?.check_out && (
              <button
                onClick={handleGPSBreak}
                disabled={breakMutation.isPending || gpsLoading || (!todayAttendance?.break_start && isBefore12) || (todayAttendance?.break_start && todayAttendance?.break_end)}
                className="w-full bg-violet-600 hover:bg-violet-700 disabled:bg-zinc-100 disabled:text-zinc-400 disabled:shadow-none text-white font-bold py-2.5 px-4 rounded-xl shadow-md shadow-violet-500/10 hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer text-xs whitespace-nowrap"
              >
                {breakMutation.isPending || gpsLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Memproses...
                  </>
                ) : !todayAttendance?.break_start ? (
                  <>
                    <Coffee className="h-4 w-4" />
                    {isBefore12 ? "Mulai Istirahat (Tersedia 12:00)" : "Mulai Istirahat"}
                  </>
                ) : !todayAttendance?.break_end ? (
                  <>
                    <Coffee className="h-4 w-4 text-amber-300 animate-bounce" />
                    Selesai Istirahat
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 text-zinc-400" />
                    Istirahat Selesai
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {gpsError && (
          <div className="bg-red-50 text-red-700 text-xs font-semibold p-3 border border-red-100 rounded-xl flex items-start gap-2 max-w-xl">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-500 mt-0.5" />
            <span>{gpsError}</span>
          </div>
        )}
      </div>

      {/* Rekap Absensi Bulan Ini */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-zinc-950 flex items-center gap-2">
          <Calendar className="h-4.5 w-4.5 text-[#FF8200]" />
          Rekap Absensi Bulan Ini ({new Date().toLocaleDateString("id-ID", { month: "long", year: "numeric" })})
        </h3>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <div className="bg-white overflow-hidden rounded-2xl border border-zinc-150 p-4.5 flex items-center justify-between shadow-sm">
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Tepat Waktu</span>
              <div className="text-2xl font-extrabold text-emerald-600">{totalPresent} Hari</div>
            </div>
            <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600">
              <UserCheck className="h-5 w-5" />
            </div>
          </div>

          <div className="bg-white overflow-hidden rounded-2xl border border-zinc-150 p-4.5 flex items-center justify-between shadow-sm">
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Terlambat</span>
              <div className="text-2xl font-extrabold text-amber-600">{totalLate} Hari</div>
            </div>
            <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600">
              <Clock className="h-5 w-5" />
            </div>
          </div>

          <div className="bg-white overflow-hidden rounded-2xl border border-zinc-150 p-4.5 flex items-center justify-between shadow-sm">
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Izin & Cuti</span>
              <div className="text-2xl font-extrabold text-blue-600">{totalLeave} Hari</div>
            </div>
            <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600">
              <FileText className="h-5 w-5" />
            </div>
          </div>

          <div className="bg-white overflow-hidden rounded-2xl border border-zinc-150 p-4.5 flex items-center justify-between shadow-sm">
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Izin Jam Kerja</span>
              <div className="text-2xl font-extrabold text-purple-600">{totalWhPermissions} Hari</div>
            </div>
            <div className="p-2.5 rounded-xl bg-purple-50 text-purple-600">
              <Timer className="h-5 w-5" />
            </div>
          </div>

          <div className="bg-white overflow-hidden rounded-2xl border border-zinc-150 p-4.5 flex items-center justify-between shadow-sm col-span-2 md:col-span-1">
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Tidak Hadir</span>
              <div className="text-2xl font-extrabold text-rose-600">{totalAbsent} Hari</div>
            </div>
            <div className="p-2.5 rounded-xl bg-rose-50 text-rose-600">
              <CalendarX className="h-5 w-5" />
            </div>
          </div>
        </div>
      </div>

      {/* Ringkasan Aktivitas Kerja */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-zinc-950 flex items-center gap-2">
          <ClipboardCheck className="h-4.5 w-4.5 text-[#FF8200]" />
          Ringkasan Aktivitas Kerja Bulan Ini
        </h3>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-4">
          <div className="bg-white overflow-hidden rounded-2xl border border-zinc-150 p-6 flex items-center justify-between shadow-sm">
            <div className="space-y-1.5">
              <span className="text-sm font-bold text-zinc-400 uppercase tracking-wider">Aktivitas Terkini</span>
              <div className="text-3xl font-extrabold text-zinc-900">{totalOwn}</div>
            </div>
            <div className="p-2.5 rounded-lg bg-zinc-50 text-zinc-500">
              <ClipboardCheck className="h-5 w-5" />
            </div>
          </div>
          <div className="bg-white overflow-hidden rounded-2xl border border-zinc-150 p-6 flex items-center justify-between shadow-sm">
            <div className="space-y-1.5">
              <span className="text-sm font-bold text-zinc-400 uppercase tracking-wider">In Progress</span>
              <div className="text-3xl font-extrabold text-blue-600">{ownInProgress}</div>
            </div>
            <div className="p-2.5 rounded-lg bg-blue-50 text-blue-500">
              <PlayCircle className="h-5 w-5" />
            </div>
          </div>
          <div className="bg-white overflow-hidden rounded-2xl border border-zinc-150 p-6 flex items-center justify-between shadow-sm">
            <div className="space-y-1.5">
              <span className="text-sm font-bold text-zinc-400 uppercase tracking-wider">On Hold</span>
              <div className="text-3xl font-extrabold text-orange-600">{ownOnHold}</div>
            </div>
            <div className="p-2.5 rounded-lg bg-orange-50 text-orange-500">
              <PauseCircle className="h-5 w-5" />
            </div>
          </div>
          <div className="bg-white overflow-hidden rounded-2xl border border-zinc-150 p-6 flex items-center justify-between shadow-sm">
            <div className="space-y-1.5">
              <span className="text-sm font-bold text-zinc-400 uppercase tracking-wider">Done</span>
              <div className="text-3xl font-extrabold text-green-600">{ownDone}</div>
            </div>
            <div className="p-2.5 rounded-lg bg-green-50 text-green-500">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </div>
        </div>
      </div>

      {/* 2. List Aktivitas Saya */}
      <div className="bg-white rounded-2xl border border-zinc-150 p-6 shadow-sm flex flex-col">
        <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
          <div>
            <h3 className="text-base font-bold text-zinc-955">Aktivitas Saya (Terakhir)</h3>
            <p className="text-xs text-zinc-500 mt-0.5">Daftar 5 tugas terbaru yang Anda kerjakan.</p>
          </div>
          <a href="/activities" className="text-sm font-bold text-[#FF8200] hover:underline flex items-center gap-1">
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
              <span className="text-sm">Anda belum mencatat aktivitas hari ini.</span>
              <a href="/activities" className="text-sm font-bold text-[#FF8200] hover:underline mt-2">
                Buat aktivitas pertama Anda sekarang.
              </a>
            </div>
          ) : (
            <table className="min-w-[800px] md:min-w-full divide-y divide-zinc-100 text-left text-xs">
              <thead>
                <tr className="text-zinc-400 uppercase font-bold tracking-wider text-xs">
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
                    <td className="py-3.5 pr-4 text-zinc-500 text-sm">
                      {formatIndonesianDate(act.created_at, { showYear: false })}{" "}
                      <span className="text-xs text-zinc-400 font-semibold block mt-0.5">
                        {new Date(act.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2.5 py-0.5 rounded-full bg-zinc-100 border border-zinc-200 text-zinc-650 font-bold text-[10px] uppercase tracking-wide whitespace-nowrap">
                        {act.category?.name}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 max-w-sm text-zinc-900 text-sm">
                      <div className="font-semibold break-words whitespace-pre-wrap">{act.activity}</div>
                      {act.progress_note && (
                        <div className="text-xs text-zinc-500 font-semibold italic mt-1.5 break-words whitespace-pre-wrap">
                          Progress: {act.progress_note}
                        </div>
                      )}
                      {act.owner_feedback && (
                        <div className="text-xs text-orange-700 font-semibold mt-1.5 bg-orange-50/50 border border-orange-100/60 p-1.5 rounded-lg max-w-xs break-words">
                          Feedback: {act.owner_feedback}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`text-[10px] font-bold px-2.5 py-1 rounded uppercase ${
                          act.status === "in_progress"
                            ? "bg-blue-50 text-blue-600 border border-blue-100"
                            : act.status === "on_hold"
                            ? "bg-orange-50 text-orange-600 border border-orange-150"
                            : "bg-green-50 text-green-600 border border-green-100"
                        }`}
                      >
                        {act.status.replace("_", " ")}
                      </span>
                      <div className="text-xs text-zinc-505 font-medium mt-1.5 space-y-1">
                        <div className="flex items-center gap-1">
                          <span>⏱️</span>
                          <span>{formatActiveDuration(act.created_at, act.completed_at, act.status, act.logs, holidaySet)}</span>
                          {act.status === "in_progress" && (
                            <span className="text-zinc-400 font-medium text-[9.5px]">(aktif)</span>
                          )}
                        </div>
                        {formatActiveOvertimeDuration(act.created_at, act.completed_at, act.logs, holidaySet, act.hold_reason) && (
                          <div className="flex items-center gap-1 text-orange-600 font-bold">
                            <span>🌙</span>
                            <span>Time Log: {formatActiveOvertimeDuration(act.created_at, act.completed_at, act.logs, holidaySet, act.hold_reason)}</span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 pl-4 max-w-xs text-sm">
                      {act.status === "on_hold" && act.hold_reason && (
                        <span className="text-orange-700 font-bold bg-orange-50 border border-orange-100 px-2 py-1 rounded-lg">
                          Kendala: {act.hold_reason ? act.hold_reason.replace(/Lembur/g, "Time Log") : ""}
                        </span>
                      )}
                      {act.reference_link && (
                        <a href={act.reference_link} target="_blank" className="text-[#FF8200] hover:underline font-bold block mt-1">
                          Buka Link Bukti
                        </a>
                      )}
                      {act.proof_image_url && (
                        <a 
                          href={act.proof_image_url} 
                          target="_blank" 
                          rel="noreferrer"
                          className="text-[#FF8200] hover:underline font-bold block mt-1"
                        >
                          🖼️ Lihat Foto Bukti
                        </a>
                      )}
                      {!act.hold_reason && !act.reference_link && !act.proof_image_url && "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Review Modal for Owner */}
      {roles.includes("Owner") && (
        <ReviewModal
          isOpen={isReviewOpen}
          onClose={() => {
            setIsReviewOpen(false);
            setReviewActivity(null);
          }}
          activity={reviewActivity}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["dashboardSummary"] });
          }}
        />
      )}

      {/* Custom Alert Modal */}
      <AlertModal
        isOpen={alertConfig.isOpen}
        onClose={() => setAlertConfig((prev) => ({ ...prev, isOpen: false }))}
        title={alertConfig.title}
        message={alertConfig.message}
        variant={alertConfig.variant}
      />

      {/* Lightbox / Foto Bukti Modal */}
      {activePhotoUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/90 backdrop-blur-sm p-4 animate-fade-in">
          <div className="absolute inset-0 cursor-pointer" onClick={() => setActivePhotoUrl(null)} />
          <div className="relative max-w-4xl max-h-[85vh] bg-white p-2 rounded-2xl shadow-2xl z-10 flex flex-col items-center">
            <button
              onClick={() => setActivePhotoUrl(null)}
              className="absolute top-4 right-4 p-2 bg-zinc-900/80 hover:bg-zinc-800 text-white rounded-full z-20 cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
            <img 
              src={activePhotoUrl} 
              alt="Foto Bukti Kerja" 
              className="max-w-full max-h-[80vh] rounded-lg object-contain" 
            />
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
