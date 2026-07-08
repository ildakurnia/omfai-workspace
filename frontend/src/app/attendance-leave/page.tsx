"use client";

import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Calendar,
  Clock,
  CheckCircle,
  AlertCircle,
  Loader2,
  Upload,
  X,
  Check,
  Ban,
  MapPin,
  UserCheck,
  RefreshCw,
  FileText,
  Filter,
  CalendarX,
  Moon,
  Timer,
  Coffee,
  Trophy,
} from "lucide-react";
import DashboardLayout from "@/components/dashboard-layout";
import api from "@/lib/api";
import { formatIndonesianDate, toLocalDateString, calculateOvertimeMinutes } from "@/lib/utils";
import Cookies from "js-cookie";
import AlertModal from "@/components/alert-modal";
import ConfirmModal from "@/components/confirm-modal";

// Leave submission validation schema
const leaveSchema = z.object({
  type: z.enum(["annual_leave", "sick_leave", "permission"]),
  start_date: z.string().min(1, "Tanggal mulai wajib diisi"),
  end_date: z.string().min(1, "Tanggal selesai wajib diisi"),
  reason: z.string().min(1, "Alasan wajib diisi"),
  attachment: z.any().optional(),
});

type LeaveFormValues = z.infer<typeof leaveSchema>;

export default function AttendanceLeavePage() {
  const queryClient = useQueryClient();
  const [currentUser, setCurrentUser] = useState<any>(null);
  
  // Date states
  const now = new Date();
  const currentMonthString = toLocalDateString(now).slice(0, 7); // e.g. "2026-06"
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthString);
  
  // Modals / Admin selection states
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");
  const [isRejectionModalOpen, setIsRejectionModalOpen] = useState(false);
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [isLeaveHistoryModalOpen, setIsLeaveHistoryModalOpen] = useState(false);
  const [rejectionId, setRejectionId] = useState<number | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [rejectionError, setRejectionError] = useState<string | null>(null);
  const [rejectionType, setRejectionType] = useState<"leave" | "work_hour">("leave");

  // Work hour permission states
  const [isWorkHourModalOpen, setIsWorkHourModalOpen] = useState(false);
  const [workHourType, setWorkHourType] = useState<"out_temporary" | "arrive_late" | "leave_early">("out_temporary");
  const [workHourDate, setWorkHourDate] = useState("");
  const [workHourStartTime, setWorkHourStartTime] = useState("");
  const [workHourEndTime, setWorkHourEndTime] = useState("");
  const [workHourReason, setWorkHourReason] = useState("");
  const [workHourAttachment, setWorkHourAttachment] = useState<File | null>(null);
  const [historyActiveTab, setHistoryActiveTab] = useState<"leave" | "work_hour">("leave");
  
  // Absen submission GPS loading/error states
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);

  // Filter state for attendance grid
  const [attendanceFilter, setAttendanceFilter] = useState<"present" | "late" | "leave" | "wh_permission" | "absent" | "earliest" | null>(null);

  // Reset filter on month or employee change
  useEffect(() => {
    setAttendanceFilter(null);
  }, [selectedMonth, selectedEmployeeId]);

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

  // Geofence management states
  const [isGeofenceModalOpen, setIsGeofenceModalOpen] = useState(false);
  const [geofenceEditId, setGeofenceEditId] = useState<number | null>(null);
  const [geofenceName, setGeofenceName] = useState("");
  const [geofenceLat, setGeofenceLat] = useState("");
  const [geofenceLng, setGeofenceLng] = useState("");
  const [geofenceRadius, setGeofenceRadius] = useState<number>(100);

  // Load current user from Cookie
  useEffect(() => {
    document.title = "Absensi & Cuti | OMFAI Workspace";
    const userCookie = Cookies.get("omfai_user");
    if (userCookie) {
      try {
        setCurrentUser(JSON.parse(userCookie));
      } catch (e) {
        // ignore
      }
    }
  }, []);

  const roles = currentUser?.roles || [];
  const isAdmin = roles.includes("Admin");
  const isOwner = roles.includes("Owner");
  const isEmployee = roles.includes("Employee");

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<LeaveFormValues>({
    resolver: zodResolver(leaveSchema),
    defaultValues: {
      type: "annual_leave",
    },
  });

  const leaveType = watch("type");

  // Fetch holidays (for filtering calendar)
  const { data: holidays } = useQuery({
    queryKey: ["holidaysList"],
    queryFn: async () => {
      const res = await api.get("/holidays");
      return res.data.data || [];
    },
  });

  // Fetch active geofences
  const { data: geofences } = useQuery({
    queryKey: ["geofencesList"],
    queryFn: async () => {
      const res = await api.get("/geofences");
      return res.data.data || [];
    },
  });

  // Fetch logged in employee attendance history
  const { data: attendanceHistory, isLoading: attendanceLoading } = useQuery({
    queryKey: ["attendanceHistory"],
    queryFn: async () => {
      const res = await api.get("/history-absen");
      return res.data;
    },
    enabled: isEmployee,
  });

  // Fetch logged in employee leave history
  const { data: leaveHistory, isLoading: leaveLoading } = useQuery({
    queryKey: ["leaveHistory"],
    queryFn: async () => {
      const res = await api.get("/history-cuti");
      return res.data;
    },
    enabled: isEmployee,
  });

  // Fetch logged in employee work hour permissions history
  const { data: workHourPermissions, isLoading: workHourPermissionsLoading } = useQuery({
    queryKey: ["workHourPermissionsHistory"],
    queryFn: async () => {
      const res = await api.get("/work-hour-permissions");
      return res.data;
    },
    enabled: isEmployee,
  });

  // Cache state to prevent layout flashes
  const todayStr = toLocalDateString(now);
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

  // Fetch all employees (for Admin/Owner filter and reports)
  const { data: employees } = useQuery({
    queryKey: ["employeesListForReports"],
    queryFn: async () => {
      const res = await api.get("/users");
      // filter only employees
      return (res.data.data || []).filter((u: any) => 
        u.roles?.[0]?.name === "Employee" && u.employee
      );
    },
    enabled: isAdmin || isOwner,
  });

  // Set default selected employee for Admin
  useEffect(() => {
    if (employees && employees.length > 0 && !selectedEmployeeId) {
      setSelectedEmployeeId(employees[0].id.toString());
    }
  }, [employees, selectedEmployeeId]);

  // Fetch selected employee's attendance (for Admin/Owner reports view)
  const { data: adminSelectedEmpAttendance, isLoading: adminSelectedEmpLoading } = useQuery({
    queryKey: ["adminSelectedEmpAttendance", selectedEmployeeId],
    queryFn: async () => {
      if (!selectedEmployeeId) return null;
      const res = await api.get(`/users/${selectedEmployeeId}`);
      return res.data.data || null;
    },
    enabled: (isAdmin || isOwner) && !!selectedEmployeeId,
  });

  const holidaySet = React.useMemo(() => {
    return new Set<string>((holidays || []).map((h: any) => h.date));
  }, [holidays]);

  // Fetch selected employee's activities for overtime calculation (Admin/Owner view)
  const selectedUserId = adminSelectedEmpAttendance?.id;
  const { data: adminSelectedEmpActivities, isLoading: adminSelectedEmpActivitiesLoading } = useQuery({
    queryKey: ["adminSelectedEmpActivities", selectedUserId, selectedMonth],
    queryFn: async () => {
      if (!selectedUserId) return [];
      const [year, month] = selectedMonth.split("-").map(Number);
      const startDate = `${selectedMonth}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      const endDate = `${selectedMonth}-${String(lastDay).padStart(2, "0")}`;
      
      const response = await api.get("/reports", {
        params: {
          start_date: startDate,
          end_date: endDate,
          user_id: selectedUserId,
          overtime_only: "true",
        },
      });
      return response.data.data || [];
    },
    enabled: (isAdmin || isOwner) && !!selectedUserId,
  });

  // Fetch ALL leave requests for Owner/Admin approval
  const { data: allLeaveRequests, isLoading: allLeavesLoading } = useQuery({
    queryKey: ["allLeaveRequestsList"],
    queryFn: async () => {
      const res = await api.get("/leave-requests");
      return res.data.data || [];
    },
    enabled: isAdmin || isOwner,
  });

  // Fetch ALL work hour permissions for Owner/Admin approval
  const { data: allWorkHourPermissions, isLoading: allWorkHourPermissionsLoading } = useQuery({
    queryKey: ["allWorkHourPermissionsList"],
    queryFn: async () => {
      const res = await api.get("/admin/work-hour-permissions");
      return res.data.data || [];
    },
    enabled: isAdmin || isOwner,
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

  // Mutation: Record Break Start / End
  const breakMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post("/istirahat");
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["attendanceHistory"] });
      showAlert(data.message, "success", "Pencatatan Berhasil");
    },
    onError: (err: any) => {
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

  // Mutation: Submit Leave
  const submitLeaveMutation = useMutation({
    mutationFn: async (values: LeaveFormValues) => {
      const formData = new FormData();
      formData.append("type", values.type);
      formData.append("start_date", values.start_date);
      formData.append("end_date", values.end_date);
      formData.append("reason", values.reason);
      if (values.attachment && values.attachment[0]) {
        formData.append("attachment", values.attachment[0]);
      }

      const res = await api.post("/ajukan-cuti", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });
      return res.data;
    },
    onSuccess: () => {
      reset({
        type: "annual_leave",
        start_date: "",
        end_date: "",
        reason: "",
        attachment: null,
      });
      queryClient.invalidateQueries({ queryKey: ["leaveHistory"] });
      setIsLeaveModalOpen(false);
      showAlert("Pengajuan cuti/izin berhasil dikirim.", "success", "Pengajuan Dikirim");
    },
    onError: (err: any) => {
      showAlert(err.response?.data?.message || "Gagal mengirim pengajuan.", "error", "Gagal Mengirim");
    },
  });

  // Mutation: Approve Leave Request
  const approveLeaveMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await api.post(`/leave-requests/${id}/approve`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["allLeaveRequestsList"] });
      queryClient.invalidateQueries({ queryKey: ["employeesListForReports"] });
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
      queryClient.invalidateQueries({ queryKey: ["allLeaveRequestsList"] });
      showAlert("Pengajuan cuti ditolak.", "success", "Penolakan Berhasil");
    },
    onError: (err: any) => {
      setRejectionError(err.response?.data?.message || "Gagal menolak pengajuan.");
    },
  });

  // Mutation: Save Geofence
  const saveGeofenceMutation = useMutation({
    mutationFn: async (payload: { id?: number; name: string; latitude: number; longitude: number; radius: number }) => {
      if (payload.id) {
        return (await api.put(`/geofences/${payload.id}`, payload)).data;
      } else {
        return (await api.post("/geofences", payload)).data;
      }
    },
    onSuccess: () => {
      setIsGeofenceModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ["geofencesList"] });
      showAlert("Lokasi geofence berhasil disimpan.", "success", "Simpan Berhasil");
    },
    onError: (err: any) => {
      showAlert(err.response?.data?.message || "Gagal menyimpan lokasi geofence.", "error", "Simpan Gagal");
    },
  });

  // Mutation: Delete Geofence
  const deleteGeofenceMutation = useMutation({
    mutationFn: async (id: number) => {
      return (await api.delete(`/geofences/${id}`)).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["geofencesList"] });
      showAlert("Lokasi geofence berhasil dihapus.", "success", "Hapus Berhasil");
    },
    onError: (err: any) => {
      showAlert(err.response?.data?.message || "Gagal menghapus lokasi geofence.", "error", "Hapus Gagal");
    },
  });

  // Mutation: Delete/Reset Attendance
  const deleteAttendanceMutation = useMutation({
    mutationFn: async (id: number) => {
      return (await api.delete(`/attendances/${id}`)).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminSelectedEmpAttendance"] });
      showAlert("Data absensi berhasil dihapus/reset.", "success", "Reset Berhasil");
    },
    onError: (err: any) => {
      showAlert(err.response?.data?.message || "Gagal menghapus/reset data absensi.", "error", "Reset Gagal");
    },
  });

  // Mutation: Delete/Reset Leave
  const deleteLeaveMutation = useMutation({
    mutationFn: async (id: number) => {
      return (await api.delete(`/leave-requests/${id}`)).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminSelectedEmpAttendance"] });
      queryClient.invalidateQueries({ queryKey: ["allLeaveRequestsList"] });
      showAlert("Pengajuan cuti/izin berhasil dihapus/reset.", "success", "Reset Berhasil");
    },
    onError: (err: any) => {
      showAlert(err.response?.data?.message || "Gagal menghapus/reset pengajuan cuti/izin.", "error", "Reset Gagal");
    },
  });

  // Mutation: Cancel Leave Request (Employee Only)
  const cancelLeaveMutation = useMutation({
    mutationFn: async (id: number) => {
      return (await api.post(`/ajukan-cuti/${id}/cancel`)).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leaveHistory"] });
      showAlert("Pengajuan berhasil dibatalkan.", "success", "Pembatalan Berhasil");
    },
    onError: (err: any) => {
      showAlert(err.response?.data?.message || "Gagal membatalkan pengajuan.", "error", "Pembatalan Gagal");
    },
  });

  // Mutation: Submit Work Hour Permission
  const submitWorkHourPermissionMutation = useMutation({
    mutationFn: async (payload: {
      type: string;
      date: string;
      start_time: string;
      end_time: string;
      reason: string;
      attachment: File | null;
    }) => {
      const formData = new FormData();
      formData.append("type", payload.type);
      formData.append("date", payload.date);
      if (payload.start_time) formData.append("start_time", payload.start_time);
      if (payload.end_time) formData.append("end_time", payload.end_time);
      formData.append("reason", payload.reason);
      if (payload.attachment) {
        formData.append("attachment", payload.attachment);
      }

      const res = await api.post("/work-hour-permissions", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });
      return res.data;
    },
    onSuccess: () => {
      setWorkHourDate("");
      setWorkHourStartTime("");
      setWorkHourEndTime("");
      setWorkHourReason("");
      setWorkHourAttachment(null);
      queryClient.invalidateQueries({ queryKey: ["workHourPermissionsHistory"] });
      setIsWorkHourModalOpen(false);
      showAlert("Pengajuan izin jam kerja berhasil dikirim.", "success", "Pengajuan Dikirim");
    },
    onError: (err: any) => {
      showAlert(err.response?.data?.message || "Gagal mengirim pengajuan.", "error", "Gagal Mengirim");
    },
  });

  // Mutation: Cancel Work Hour Permission (Employee Only)
  const cancelWorkHourPermissionMutation = useMutation({
    mutationFn: async (id: number) => {
      return (await api.post(`/work-hour-permissions/${id}/cancel`)).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workHourPermissionsHistory"] });
      showAlert("Pengajuan izin jam kerja berhasil dibatalkan.", "success", "Pembatalan Berhasil");
    },
    onError: (err: any) => {
      showAlert(err.response?.data?.message || "Gagal membatalkan pengajuan.", "error", "Pembatalan Gagal");
    },
  });

  // Mutation: Approve Work Hour Permission (Owner/Admin)
  const approveWorkHourPermissionMutation = useMutation({
    mutationFn: async (id: number) => {
      return (await api.post(`/admin/work-hour-permissions/${id}/approve`)).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["allWorkHourPermissionsList"] });
      queryClient.invalidateQueries({ queryKey: ["employeesListForReports"] });
      queryClient.invalidateQueries({ queryKey: ["adminSelectedEmpAttendance"] });
      queryClient.invalidateQueries({ queryKey: ["attendanceHistory"] });
      showAlert("Pengajuan izin jam kerja disetujui.", "success", "Persetujuan Berhasil");
    },
    onError: (err: any) => {
      showAlert(err.response?.data?.message || "Gagal menyetujui pengajuan.", "error", "Persetujuan Gagal");
    },
  });

  // Mutation: Reject Work Hour Permission (Owner/Admin)
  const rejectWorkHourPermissionMutation = useMutation({
    mutationFn: async (payload: { id: number; reason: string }) => {
      return (await api.post(`/admin/work-hour-permissions/${payload.id}/reject`, {
        rejection_reason: payload.reason,
      })).data;
    },
    onSuccess: () => {
      setIsRejectionModalOpen(false);
      setRejectionReason("");
      setRejectionId(null);
      queryClient.invalidateQueries({ queryKey: ["allWorkHourPermissionsList"] });
      showAlert("Pengajuan izin jam kerja ditolak.", "success", "Penolakan Berhasil");
    },
    onError: (err: any) => {
      setRejectionError(err.response?.data?.message || "Gagal menolak pengajuan.");
    },
  });

  // Mutation: Delete/Reset Work Hour Permission (Owner/Admin)
  const deleteWorkHourPermissionMutation = useMutation({
    mutationFn: async (id: number) => {
      return (await api.delete(`/admin/work-hour-permissions/${id}`)).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["allWorkHourPermissionsList"] });
      queryClient.invalidateQueries({ queryKey: ["adminSelectedEmpAttendance"] });
      showAlert("Pengajuan izin jam kerja berhasil dihapus/reset.", "success", "Reset Berhasil");
    },
    onError: (err: any) => {
      showAlert(err.response?.data?.message || "Gagal menghapus/reset pengajuan.", "error", "Reset Gagal");
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

  const onSubmitLeave = (values: LeaveFormValues) => {
    submitLeaveMutation.mutate(values);
  };

  const handleOpenLeaveModalWithDate = (dateStr: string) => {
    reset({
      type: "annual_leave",
      start_date: dateStr,
      end_date: dateStr,
      reason: "",
      attachment: null,
    });
    setIsLeaveModalOpen(true);
  };

  const handleOpenRejectModal = (id: number, type: "leave" | "work_hour" = "leave") => {
    setRejectionType(type);
    setRejectionId(id);
    setRejectionReason("");
    setRejectionError(null);
    setIsRejectionModalOpen(true);
  };

  const handleConfirmReject = () => {
    if (!rejectionReason || rejectionReason.trim().length < 3) {
      setRejectionError("Alasan penolakan harus diisi minimal 3 karakter.");
      return;
    }
    if (rejectionId) {
      if (rejectionType === "leave") {
        rejectLeaveMutation.mutate({ id: rejectionId, reason: rejectionReason });
      } else {
        rejectWorkHourPermissionMutation.mutate({ id: rejectionId, reason: rejectionReason });
      }
    }
  };

  // Geofence Modal Handlers
  const openGeofenceAddModal = () => {
    setGeofenceEditId(null);
    setGeofenceName("");
    setGeofenceLat("");
    setGeofenceLng("");
    setGeofenceRadius(100);
    setIsGeofenceModalOpen(true);
  };

  const openGeofenceEditModal = (g: any) => {
    setGeofenceEditId(g.id);
    setGeofenceName(g.name);
    setGeofenceLat(g.latitude.toString());
    setGeofenceLng(g.longitude.toString());
    setGeofenceRadius(g.radius);
    setIsGeofenceModalOpen(true);
  };

  const handleGetAdminGPSForForm = () => {
    if (!navigator.geolocation) {
      showAlert("Geolocation tidak didukung oleh browser ini.", "warning", "GPS Tidak Didukung");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeofenceLat(pos.coords.latitude.toFixed(6));
        setGeofenceLng(pos.coords.longitude.toFixed(6));
      },
      (err) => {
        showAlert("Gagal mendeteksi lokasi GPS Anda: " + err.message, "error", "Deteksi Lokasi Gagal");
      }
    );
  };

  const handleConfirmSaveGeofence = () => {
    if (!geofenceName || geofenceName.trim() === "") {
      showAlert("Nama area wajib diisi.", "warning", "Form Tidak Valid");
      return;
    }
    if (!geofenceLat || isNaN(Number(geofenceLat))) {
      showAlert("Garis lintang (Latitude) harus diisi angka.", "warning", "Form Tidak Valid");
      return;
    }
    if (!geofenceLng || isNaN(Number(geofenceLng))) {
      showAlert("Garis bujur (Longitude) harus diisi angka.", "warning", "Form Tidak Valid");
      return;
    }
    if (!geofenceRadius || geofenceRadius <= 0) {
      showAlert("Radius harus berupa angka di atas 0.", "warning", "Form Tidak Valid");
      return;
    }

    const payload: any = {
      name: geofenceName,
      latitude: Number(geofenceLat),
      longitude: Number(geofenceLng),
      radius: geofenceRadius,
    };

    if (geofenceEditId) {
      payload.id = geofenceEditId;
    }

    saveGeofenceMutation.mutate(payload);
  };

  const handleDeleteGeofence = (id: number) => {
    showConfirm(
      "Apakah Anda yakin ingin menghapus lokasi absensi ini?",
      () => {
        deleteGeofenceMutation.mutate(id);
      },
      "danger",
      "Hapus Lokasi Absen"
    );
  };

  const handleDeleteAttendance = (id: number) => {
    showConfirm(
      "Apakah Anda yakin ingin menghapus/reset data absensi karyawan ini pada hari tersebut?",
      () => {
        deleteAttendanceMutation.mutate(id);
      },
      "danger",
      "Hapus/Reset Absensi"
    );
  };

  const handleDeleteLeave = (id: number) => {
    showConfirm(
      "Apakah Anda yakin ingin menghapus/reset pengajuan cuti/izin karyawan ini pada hari tersebut?",
      () => {
        deleteLeaveMutation.mutate(id);
      },
      "danger",
      "Hapus/Reset Cuti"
    );
  };

  // Helper: Generate all days of selected month and map them to their statuses
  const generateMonthlyGrid = (monthStr: string, attendances: any[], leaves: any[], whPermissions: any[] = []) => {
    if (!monthStr) return [];
    const [year, month] = monthStr.split("-").map(Number);
    const date = new Date(year, month - 1, 1);
    const days = [];
    
    // Generate dates
    while (date.getMonth() === month - 1) {
      days.push(new Date(date));
      date.setDate(date.getDate() + 1);
    }

    const formattedHolidays = (holidays || []).map((h: any) => h.date);

    return days.map((day) => {
      const dayStr = toLocalDateString(day); // YYYY-MM-DD
      const dayOfWeek = day.getDay();
      
      const attendance = (attendances || []).find((a: any) => a.date === dayStr);
      
      // Check leaves matching this day
      const leave = (leaves || []).find((l: any) => {
        return dayStr >= l.start_date && dayStr <= l.end_date && l.status === "approved";
      });

      // Check approved work hour permissions matching this day
      const whPermission = (whPermissions || []).find((w: any) => {
        return w.date === dayStr && w.status === "approved";
      });

      let status = "-";
      let checkIn = "-";
      let checkOut = "-";
      let breakStart = "-";
      let breakEnd = "-";
      let isEarliest = false;
      let colorClass = "text-zinc-400 bg-zinc-50 border-zinc-100";
      let statusLabel = "Belum Berjalan";

      // Date comparison helper
      const todayString = new Date().toLocaleDateString("en-CA");
      const isToday = dayStr === todayString;
      const isPast = dayStr < todayString;
      const isSunday = dayOfWeek === 0;
      const isHoliday = formattedHolidays.includes(dayStr);

      if (attendance) {
        checkIn = attendance.check_in ? attendance.check_in.substring(0, 5) : "-";
        checkOut = attendance.check_out ? attendance.check_out.substring(0, 5) : "-";
        breakStart = attendance.break_start ? attendance.break_start.substring(0, 5) : "-";
        breakEnd = attendance.break_end ? attendance.break_end.substring(0, 5) : "-";
        isEarliest = !!attendance.is_earliest;
        
        if (attendance.status === "present") {
          status = "present";
          statusLabel = "Hadir";
          colorClass = "text-emerald-700 bg-emerald-50 border-emerald-100";
        } else if (attendance.status === "late") {
          status = "late";
          statusLabel = "Terlambat";
          colorClass = "text-amber-700 bg-amber-50 border-amber-100";
        }

        // Apply work hour permission labels if approved
        if (whPermission) {
          if (whPermission.type === "arrive_late" && attendance.status === "late") {
            statusLabel = "Terlambat (Izin Disetujui)";
            colorClass = "text-amber-800 bg-amber-50/70 border-amber-200";
          } else if (whPermission.type === "leave_early") {
            statusLabel = "Pulang Cepat (Izin Disetujui)";
            colorClass = "text-indigo-700 bg-indigo-50 border-indigo-100";
          } else if (whPermission.type === "out_temporary") {
            statusLabel = `${statusLabel} (Keluar Sementara)`;
            colorClass = "text-purple-700 bg-purple-50 border-purple-100";
          }
        }
      } else if (leave) {
        status = leave.type;
        statusLabel = leave.type === "annual_leave" ? "Cuti" : leave.type === "sick_leave" ? "Sakit" : "Izin";
        colorClass = leave.type === "sick_leave" ? "text-red-750 bg-red-50 border-red-100" : "text-blue-700 bg-blue-50 border-blue-100";
      } else if (whPermission && whPermission.type === "leave_early") {
        status = "leave_early";
        statusLabel = "Pulang Cepat (Izin Disetujui)";
        colorClass = "text-indigo-700 bg-indigo-50 border-indigo-100";
      } else if (whPermission && whPermission.type === "arrive_late") {
        status = "arrive_late";
        statusLabel = "Terlambat (Izin Disetujui)";
        colorClass = "text-amber-800 bg-amber-50/70 border-amber-200";
      } else if (whPermission && whPermission.type === "out_temporary") {
        status = "out_temporary";
        statusLabel = "Hadir (Keluar Sementara)";
        colorClass = "text-purple-700 bg-purple-50 border-purple-100";
      } else if (isSunday) {
        status = "weekend";
        statusLabel = "Libur Akhir Pekan";
        colorClass = "text-zinc-500 bg-zinc-100/50 border-zinc-200";
      } else if (isHoliday) {
        const hName = holidays.find((h: any) => h.date === dayStr)?.name || "Hari Libur";
        status = "holiday";
        statusLabel = `Libur: ${hName}`;
        colorClass = "text-rose-600 bg-rose-50/50 border-rose-150";
      } else if (isToday) {
        status = "not_yet";
        statusLabel = "Belum Absen";
        colorClass = "text-zinc-500 bg-zinc-100 border-zinc-200";
      } else if (isPast) {
        status = "absent";
        statusLabel = "Tidak Hadir";
        colorClass = "text-rose-700 bg-rose-50 border-rose-100";
      } else {
        status = "future";
        statusLabel = "-";
        colorClass = "text-zinc-300 font-semibold";
      }

      return {
        dateString: dayStr,
        formattedDay: formatIndonesianDate(dayStr),
        dayName: day.toLocaleDateString("id-ID", { weekday: "long" }),
        checkIn,
        checkOut,
        breakStart,
        breakEnd,
        isEarliest,
        status,
        statusLabel,
        colorClass,
        attendanceId: attendance ? attendance.id : null,
        leaveId: leave ? leave.id : null,
        whPermissionId: whPermission ? whPermission.id : null,
        isPast,
        isToday,
      };
    });
  };

  // Generate grid for Employee
  const employeeGrid = isEmployee 
    ? generateMonthlyGrid(selectedMonth, attendanceHistory?.data || [], leaveHistory?.data || [], workHourPermissions?.data || []) 
    : [];

  const totalPresent = employeeGrid.filter((d: any) => 
    d.status === "present" || 
    d.status === "leave_early" || 
    d.status === "out_temporary" || 
    d.statusLabel.startsWith("Hadir") || 
    d.statusLabel.startsWith("Pulang Cepat")
  ).length;

  const totalLate = employeeGrid.filter((d: any) => 
    d.status === "late" || 
    d.status === "arrive_late" || 
    d.statusLabel.startsWith("Terlambat")
  ).length;

  const totalLeave = employeeGrid.filter((d: any) => 
    ["annual_leave", "sick_leave", "permission"].includes(d.status)
  ).length;

  const totalWhPermissions = employeeGrid.filter((d: any) => d.whPermissionId !== null).length;

  const totalAbsent = employeeGrid.filter((d: any) => d.status === "absent").length;

  const totalTrophies = employeeGrid.filter((d: any) => d.isEarliest).length;

  // Generate grid for admin report view
  const adminSelectedGrid = (isAdmin || isOwner) && adminSelectedEmpAttendance
    ? generateMonthlyGrid(selectedMonth, adminSelectedEmpAttendance.employee?.attendances || [], adminSelectedEmpAttendance.employee?.leave_requests || [], adminSelectedEmpAttendance.employee?.work_hour_permissions || [])
    : [];

  const adminTotalPresent = adminSelectedGrid.filter((d: any) => 
    d.status === "present" || 
    d.status === "leave_early" || 
    d.status === "out_temporary" || 
    d.statusLabel.startsWith("Hadir") || 
    d.statusLabel.startsWith("Pulang Cepat")
  ).length;

  const adminTotalLate = adminSelectedGrid.filter((d: any) => 
    d.status === "late" || 
    d.status === "arrive_late" || 
    d.statusLabel.startsWith("Terlambat")
  ).length;

  const adminTotalLeave = adminSelectedGrid.filter((d: any) => 
    ["annual_leave", "sick_leave", "permission"].includes(d.status)
  ).length;

  const adminTotalWhPermissions = adminSelectedGrid.filter((d: any) => d.whPermissionId !== null).length;

  const adminTotalAbsent = adminSelectedGrid.filter((d: any) => d.status === "absent").length;

  const adminTotalTrophies = adminSelectedGrid.filter((d: any) => d.isEarliest).length;

  const filterGrid = (grid: any[]) => {
    if (!attendanceFilter) return grid;
    return grid.filter((d: any) => {
      switch (attendanceFilter) {
        case "present":
          return (
            d.status === "present" || 
            d.status === "leave_early" || 
            d.status === "out_temporary" || 
            d.statusLabel.startsWith("Hadir") || 
            d.statusLabel.startsWith("Pulang Cepat")
          );
        case "late":
          return (
            d.status === "late" || 
            d.status === "arrive_late" || 
            d.statusLabel.startsWith("Terlambat")
          );
        case "leave":
          return ["annual_leave", "sick_leave", "permission"].includes(d.status);
        case "wh_permission":
          return d.whPermissionId !== null;
        case "absent":
          return d.status === "absent";
        case "earliest":
          return d.isEarliest === true;
        default:
          return true;
      }
    });
  };

  const filteredEmployeeGrid = filterGrid(employeeGrid);
  const filteredAdminSelectedGrid = filterGrid(adminSelectedGrid);

  const totalAdminOvertimeMinutes = React.useMemo(() => {
    return (adminSelectedEmpActivities || []).reduce((acc: number, act: any) => {
      return acc + calculateOvertimeMinutes(act.created_at, act.completed_at, act.logs, holidaySet, act.hold_reason);
    }, 0);
  }, [adminSelectedEmpActivities, holidaySet]);

  const adminOvertimeHours = Math.floor(totalAdminOvertimeMinutes / 60);
  const adminOvertimeMins = totalAdminOvertimeMinutes % 60;
  const adminOvertimeFormatted = totalAdminOvertimeMinutes > 0
    ? (adminOvertimeHours > 0 ? `${adminOvertimeHours} jam ${adminOvertimeMins} menit` : `${adminOvertimeMins} menit`)
    : "0 menit";

  // Check today's check-in status for the widget
  const todayAttendance = cachedState.attendance;
  const isTodayOnLeave = cachedState.isLeave;
  const showLoading = !cachedState.hasLoaded && (attendanceLoading || leaveLoading);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h2 className="text-xl font-bold text-zinc-950">Modul Absensi & Pengajuan Cuti</h2>
          <p className="text-xs text-zinc-400 font-medium mt-1">
            {isEmployee 
              ? "Catat kehadiran harian, pantau status rekap bulanan Anda, dan ajukan perizinan." 
              : "Pantau absensi karyawan secara real-time dan kelola pengajuan perizinan cuti."}
          </p>
        </div>

        {/* ----------------- TAMPILAN KARYAWAN (EMPLOYEE) ----------------- */}
        {isEmployee && (
          <div className="space-y-6">
            
            {/* Widget Absen - Melintang Penuh */}
            <div className="bg-white rounded-2xl border border-zinc-150 shadow-sm p-4 md:p-6 space-y-6">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-zinc-950 flex items-center gap-2">
                    <Clock className="h-4 w-4 text-[#FF8200]" />
                    Absen Masuk & Pulang
                  </h3>
                  <p className="text-[11px] text-zinc-400 font-semibold">
                    Pastikan GPS Anda aktif dan berada di dalam radius kantor untuk merekam kehadiran.
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
                      onClick={() => breakMutation.mutate()}
                      disabled={breakMutation.isPending || (!todayAttendance?.break_start && isBefore12) || (todayAttendance?.break_start && todayAttendance?.break_end)}
                      className="w-full bg-violet-600 hover:bg-violet-700 disabled:bg-zinc-100 disabled:text-zinc-400 disabled:shadow-none text-white font-bold py-2.5 px-4 rounded-xl shadow-md shadow-violet-500/10 hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer text-xs whitespace-nowrap"
                    >
                      {breakMutation.isPending ? (
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

            {/* Rekap Absensi Bulanan - Melintang Penuh */}
            <div className="bg-white rounded-2xl border border-zinc-150 shadow-sm p-6 space-y-6">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                <h3 className="text-sm font-bold text-zinc-950 flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-[#FF8200]" />
                  Rekap Absensi Bulanan
                </h3>
                
                {/* Actions & Filters */}
                <div className="flex flex-wrap items-center gap-3">
                  {/* Filter Bulan */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-zinc-400 font-bold uppercase tracking-wider">Periode:</span>
                    <input
                      type="month"
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(e.target.value)}
                      className="border border-zinc-200 rounded-lg px-2.5 py-1.5 text-xs text-zinc-700 focus:outline-none focus:ring-2 focus:ring-orange-500/10 focus:border-[#FF8200] bg-white cursor-pointer font-semibold"
                    />
                  </div>

                  {/* Tombol Ajukan Izin Jam Kerja */}
                  <button
                    onClick={() => {
                      const todayString = new Date().toLocaleDateString("en-CA");
                      setWorkHourDate(todayString);
                      setWorkHourStartTime("");
                      setWorkHourEndTime("");
                      setWorkHourReason("");
                      setWorkHourAttachment(null);
                      setIsWorkHourModalOpen(true);
                    }}
                    className="bg-white hover:bg-zinc-50 text-zinc-700 text-xs font-bold px-3.5 py-2 rounded-lg border border-zinc-200 cursor-pointer transition-all flex items-center gap-1.5"
                  >
                    <Clock className="h-3.5 w-3.5 text-[#FF8200]" />
                    Izin Jam Kerja
                  </button>

                  {/* Tombol Riwayat Cuti */}
                  <button
                    onClick={() => {
                      setHistoryActiveTab("leave");
                      setIsLeaveHistoryModalOpen(true);
                    }}
                    className="bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs font-bold px-3.5 py-2 rounded-lg border border-zinc-200 cursor-pointer transition-all flex items-center gap-1.5"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    Riwayat Cuti / Izin
                  </button>
                </div>
              </div>

              {/* Rekap Absensi Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 pb-2">
                <div
                  onClick={() => setAttendanceFilter(attendanceFilter === "present" ? null : "present")}
                  className={`transition-all duration-200 cursor-pointer rounded-xl border p-4 flex items-center justify-between shadow-sm hover:shadow-md hover:scale-[1.01] hover:border-zinc-300 ${
                    attendanceFilter === "present"
                      ? "border-emerald-500 ring-2 ring-emerald-500/10 bg-emerald-50/30"
                      : attendanceFilter
                      ? "opacity-50 border-zinc-100 bg-zinc-50/50"
                      : "border-zinc-100 bg-zinc-50/50"
                  }`}
                >
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Tepat Waktu</span>
                    <div className="text-xl font-extrabold text-emerald-600">{totalPresent} Hari</div>
                  </div>
                  <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
                    <UserCheck className="h-4 w-4" />
                  </div>
                </div>

                <div
                  onClick={() => setAttendanceFilter(attendanceFilter === "late" ? null : "late")}
                  className={`transition-all duration-200 cursor-pointer rounded-xl border p-4 flex items-center justify-between shadow-sm hover:shadow-md hover:scale-[1.01] hover:border-zinc-300 ${
                    attendanceFilter === "late"
                      ? "border-amber-500 ring-2 ring-amber-500/10 bg-amber-50/30"
                      : attendanceFilter
                      ? "opacity-50 border-zinc-100 bg-zinc-50/50"
                      : "border-zinc-100 bg-zinc-50/50"
                  }`}
                >
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Terlambat</span>
                    <div className="text-xl font-extrabold text-amber-600">{totalLate} Hari</div>
                  </div>
                  <div className="p-2 rounded-lg bg-amber-50 text-amber-600">
                    <Clock className="h-4 w-4" />
                  </div>
                </div>

                <div
                  onClick={() => setAttendanceFilter(attendanceFilter === "leave" ? null : "leave")}
                  className={`transition-all duration-200 cursor-pointer rounded-xl border p-4 flex items-center justify-between shadow-sm hover:shadow-md hover:scale-[1.01] hover:border-zinc-300 ${
                    attendanceFilter === "leave"
                      ? "border-blue-500 ring-2 ring-blue-500/10 bg-blue-50/30"
                      : attendanceFilter
                      ? "opacity-50 border-zinc-100 bg-zinc-50/50"
                      : "border-zinc-100 bg-zinc-50/50"
                  }`}
                >
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Izin & Cuti</span>
                    <div className="text-xl font-extrabold text-blue-600">{totalLeave} Hari</div>
                  </div>
                  <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
                    <FileText className="h-4 w-4" />
                  </div>
                </div>

                <div
                  onClick={() => setAttendanceFilter(attendanceFilter === "wh_permission" ? null : "wh_permission")}
                  className={`transition-all duration-200 cursor-pointer rounded-xl border p-4 flex items-center justify-between shadow-sm hover:shadow-md hover:scale-[1.01] hover:border-zinc-300 ${
                    attendanceFilter === "wh_permission"
                      ? "border-purple-500 ring-2 ring-purple-500/10 bg-purple-50/30"
                      : attendanceFilter
                      ? "opacity-50 border-zinc-100 bg-zinc-50/50"
                      : "border-zinc-100 bg-zinc-50/50"
                  }`}
                >
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Izin Jam Kerja</span>
                    <div className="text-xl font-extrabold text-purple-600">{totalWhPermissions} Hari</div>
                  </div>
                  <div className="p-2 rounded-lg bg-purple-50 text-purple-600">
                    <Timer className="h-4 w-4" />
                  </div>
                </div>

                <div
                  onClick={() => setAttendanceFilter(attendanceFilter === "absent" ? null : "absent")}
                  className={`transition-all duration-200 cursor-pointer rounded-xl border p-4 flex items-center justify-between shadow-sm hover:shadow-md hover:scale-[1.01] hover:border-zinc-300 ${
                    attendanceFilter === "absent"
                      ? "border-rose-500 ring-2 ring-rose-500/10 bg-rose-50/30"
                      : attendanceFilter
                      ? "opacity-50 border-zinc-100 bg-zinc-50/50"
                      : "border-zinc-100 bg-zinc-50/50"
                  }`}
                >
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Tidak Hadir</span>
                    <div className="text-xl font-extrabold text-rose-600">{totalAbsent} Hari</div>
                  </div>
                  <div className="p-2 rounded-lg bg-rose-50 text-rose-600">
                    <CalendarX className="h-4 w-4" />
                  </div>
                </div>

                {/* Card Piala Tercepat */}
                <div
                  onClick={() => setAttendanceFilter(attendanceFilter === "earliest" ? null : "earliest")}
                  className={`transition-all duration-200 cursor-pointer rounded-xl border p-4 flex items-center justify-between shadow-sm hover:shadow-md hover:scale-[1.01] hover:border-zinc-300 ${
                    attendanceFilter === "earliest"
                      ? "border-amber-500 ring-2 ring-amber-500/10 bg-emerald-50/20"
                      : attendanceFilter
                      ? "opacity-50 border-zinc-100 bg-zinc-50/50"
                      : "border-zinc-100 bg-zinc-50/50"
                  }`}
                >
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Piala Tercepat</span>
                    <div className="text-xl font-extrabold text-amber-600">{totalTrophies} Piala</div>
                  </div>
                  <div className="p-2 rounded-lg bg-amber-50 text-amber-500">
                    <Trophy className="h-4 w-4 text-yellow-500 fill-yellow-400 shrink-0" />
                  </div>
                </div>
              </div>

              {/* Filter Alert Message */}
              {attendanceFilter && (
                <div className="bg-zinc-50 border border-zinc-150 rounded-xl p-2.5 px-4 flex items-center justify-between text-xs text-zinc-700 shadow-sm transition-all duration-250">
                  <div className="flex items-center gap-2 font-semibold">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#FF8200] animate-pulse"></span>
                    Menampilkan hasil filter: <span className="font-bold text-[#FF8200] capitalize">{attendanceFilter === "wh_permission" ? "Izin Jam Kerja" : attendanceFilter === "leave" ? "Izin & Cuti" : attendanceFilter === "earliest" ? "Piala Tercepat" : attendanceFilter.replace("_", " ")}</span> ({filteredEmployeeGrid.length} Hari)
                  </div>
                  <button
                    onClick={() => setAttendanceFilter(null)}
                    className="text-[10px] bg-zinc-200 hover:bg-zinc-300 text-zinc-700 px-2.5 py-1 rounded-lg font-bold cursor-pointer transition-all border border-zinc-300"
                  >
                    Clear Filter
                  </button>
                </div>
              )}

              {/* Grid Bulanan */}
              <div className="border border-zinc-150 rounded-xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto max-h-[480px]">
                  {attendanceLoading ? (
                    <div className="p-12 flex justify-center">
                      <Loader2 className="h-8 w-8 animate-spin text-[#FF8200]" />
                    </div>
                  ) : (
                     <table className="w-full divide-y divide-zinc-150 text-left text-xs">
                      <thead className="bg-zinc-50/70 font-bold text-zinc-400 uppercase tracking-wider sticky top-0 backdrop-blur-sm z-10">
                        <tr>
                          <th className="p-3.5">Hari & Tanggal</th>
                          <th className="p-3.5">Absen Masuk</th>
                          <th className="p-3.5">Jam Istirahat</th>
                          <th className="p-3.5">Absen Pulang</th>
                          <th className="p-3.5 text-center">Status</th>
                          <th className="p-3.5 text-center">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100 font-medium text-zinc-700">
                        {filteredEmployeeGrid.map((day: any) => {
                          const showLeaveButton = day.checkIn === "-" && !day.isPast && !["annual_leave", "sick_leave", "permission", "weekend", "holiday"].includes(day.status);
                          
                          return (
                            <tr key={day.dateString} className="hover:bg-zinc-50/30">
                              <td className="p-3.5">
                                <div className="font-bold text-zinc-900">{day.formattedDay}</div>
                                <div className="text-[10px] text-zinc-400 font-semibold capitalize">{day.dayName}</div>
                              </td>
                              <td className="p-3.5 font-mono text-zinc-800 font-bold">
                                <div className="flex items-center gap-1">
                                  {day.checkIn}
                                  {day.isEarliest && (
                                    <span title="Datang Tercepat!">
                                      <Trophy className="h-3.5 w-3.5 text-yellow-500 fill-yellow-400 shrink-0" />
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="p-3.5 font-mono text-zinc-850 font-bold">
                                {day.breakStart !== "-" 
                                  ? `${day.breakStart} - ${day.breakEnd !== "-" ? day.breakEnd : "..."}` 
                                  : "-"}
                              </td>
                              <td className="p-3.5 font-mono text-zinc-800 font-bold">{day.checkOut}</td>
                              <td className="p-3.5 text-center">
                                {day.status === "future" ? (
                                  <span className="text-zinc-300 font-bold">-</span>
                                ) : (
                                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${day.colorClass}`}>
                                    {day.statusLabel}
                                  </span>
                                )}
                              </td>
                              <td className="p-3.5 text-center">
                                {showLeaveButton ? (
                                  <button
                                    onClick={() => handleOpenLeaveModalWithDate(day.dateString)}
                                    className="bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-100 px-2.5 py-1 rounded-md cursor-pointer transition-all text-[11px] font-bold"
                                  >
                                    Ajukan Cuti
                                  </button>
                                ) : (
                                  <span className="text-zinc-300">-</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>

          </div>
        )}


        {/* ----------------- TAMPILAN OWNER / ADMIN (PENGELOLA) ----------------- */}
        {(isAdmin || isOwner) && (
          <div className="space-y-6">
            
            {/* Panel Approval Cuti (Leave Approval) */}
            <div className="bg-white rounded-2xl border border-zinc-150 shadow-sm p-6 space-y-4">
              <h3 className="text-sm font-bold text-zinc-950 flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-blue-600" />
                Persetujuan Cuti & Izin Karyawan (Pending)
              </h3>
              <div className="overflow-x-auto">
                {allLeavesLoading ? (
                  <div className="p-8 flex justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                  </div>
                ) : !allLeaveRequests || allLeaveRequests.filter((r: any) => r.status === "pending").length === 0 ? (
                  <div className="text-center py-8 text-zinc-400 text-xs">
                    Tidak ada pengajuan cuti/izin pending saat ini.
                  </div>
                ) : (
                  <table className="w-full divide-y divide-zinc-150 text-left text-xs">
                    <thead className="bg-zinc-50/70 font-bold text-zinc-400 uppercase tracking-wider">
                      <tr>
                        <th className="p-3.5">Karyawan (ID)</th>
                        <th className="p-3.5">Tipe</th>
                        <th className="p-3.5">Periode Tanggal</th>
                        <th className="p-3.5">Alasan</th>
                        <th className="p-3.5 text-center">Lampiran</th>
                        <th className="p-3.5 text-center">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 font-medium">
                      {allLeaveRequests
                        .filter((r: any) => r.status === "pending")
                        .map((item: any) => {
                          const typeLabel = item.type === "annual_leave" ? "Cuti Tahunan" : item.type === "sick_leave" ? "Sakit" : "Izin";
                          return (
                            <tr key={item.id} className="text-zinc-700 hover:bg-zinc-50/50">
                              <td className="p-3.5">
                                <div className="text-zinc-900 font-bold">{item.employee?.name}</div>
                                <div className="text-[10px] text-zinc-400 font-mono font-bold mt-0.5">{item.employee?.employee_code}</div>
                              </td>
                              <td className="p-3.5 text-zinc-800 font-bold">{typeLabel}</td>
                              <td className="p-3.5 text-zinc-500 font-semibold">
                                {formatIndonesianDate(item.start_date)} s/d {formatIndonesianDate(item.end_date)}
                              </td>
                              <td className="p-3.5 text-zinc-650 max-w-[200px]" title={item.reason}>
                                {item.reason}
                              </td>
                              <td className="p-3.5 text-center">
                                {item.attachment ? (
                                  <a
                                    href={api.defaults.baseURL + "/../storage/" + item.attachment}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 font-bold border border-blue-100 bg-blue-50 px-2 py-1 rounded-md"
                                  >
                                    <FileText className="h-3 w-3" />
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
                                    className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-100 px-3 py-1.5 rounded-lg flex items-center gap-1 font-bold cursor-pointer transition-all"
                                  >
                                    <Check className="h-3 w-3" />
                                    Setujui
                                  </button>
                                  <button
                                    onClick={() => handleOpenRejectModal(item.id)}
                                    className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-100 px-3 py-1.5 rounded-lg flex items-center gap-1 font-bold cursor-pointer transition-all"
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
                )}
              </div>
            </div>

            {/* Panel Approval Izin Jam Kerja (Work Hour Permission Approval) */}
            <div className="bg-white rounded-2xl border border-zinc-150 shadow-sm p-6 space-y-4">
              <h3 className="text-sm font-bold text-zinc-950 flex items-center gap-2">
                <Clock className="h-4 w-4 text-blue-600" />
                Persetujuan Izin Jam Kerja Karyawan (Pending)
              </h3>
              <div className="overflow-x-auto">
                {allWorkHourPermissionsLoading ? (
                  <div className="p-8 flex justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                  </div>
                ) : !allWorkHourPermissions || allWorkHourPermissions.filter((r: any) => r.status === "pending").length === 0 ? (
                  <div className="text-center py-8 text-zinc-400 text-xs">
                    Tidak ada pengajuan izin jam kerja pending saat ini.
                  </div>
                ) : (
                  <table className="w-full divide-y divide-zinc-150 text-left text-xs">
                    <thead className="bg-zinc-50/70 font-bold text-zinc-400 uppercase tracking-wider">
                      <tr>
                        <th className="p-3.5">Karyawan (ID)</th>
                        <th className="p-3.5">Tipe Izin</th>
                        <th className="p-3.5">Tanggal & Jam</th>
                        <th className="p-3.5">Alasan</th>
                        <th className="p-3.5 text-center">Lampiran</th>
                        <th className="p-3.5 text-center">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 font-medium">
                      {allWorkHourPermissions
                        .filter((r: any) => r.status === "pending")
                        .map((item: any) => {
                          const typeLabel = item.type === "out_temporary" ? "Izin Keluar Sementara" : item.type === "arrive_late" ? "Izin Datang Terlambat" : "Izin Pulang Lebih Awal";
                          const timeRange = (item.type === "leave_early") 
                            ? `Mulai ${item.start_time ? item.start_time.substring(0, 5) : "--:--"}`
                            : `${item.start_time ? item.start_time.substring(0, 5) : "--:--"} s/d ${item.end_time ? item.end_time.substring(0, 5) : "--:--"}`;
                          return (
                            <tr key={item.id} className="text-zinc-700 hover:bg-zinc-50/50">
                              <td className="p-3.5">
                                <div className="text-zinc-900 font-bold">{item.employee?.name}</div>
                                <div className="text-[10px] text-zinc-400 font-mono font-bold mt-0.5">{item.employee?.employee_code}</div>
                              </td>
                              <td className="p-3.5 text-zinc-800 font-bold">{typeLabel}</td>
                              <td className="p-3.5 text-zinc-500 font-semibold">
                                <div className="text-zinc-700 font-bold">{formatIndonesianDate(item.date)}</div>
                                <div className="text-[10px] text-zinc-400 mt-0.5">{timeRange}</div>
                              </td>
                              <td className="p-3.5 text-zinc-650 max-w-[200px]" title={item.reason}>
                                {item.reason}
                              </td>
                              <td className="p-3.5 text-center">
                                {item.attachment ? (
                                  <a
                                    href={api.defaults.baseURL + "/../storage/" + item.attachment}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 font-bold border border-blue-100 bg-blue-50 px-2 py-1 rounded-md"
                                  >
                                    <FileText className="h-3 w-3" />
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
                                    className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-100 px-3 py-1.5 rounded-lg flex items-center gap-1 font-bold cursor-pointer transition-all"
                                  >
                                    <Check className="h-3 w-3" />
                                    Setujui
                                  </button>
                                  <button
                                    onClick={() => handleOpenRejectModal(item.id, "work_hour")}
                                    className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-100 px-3 py-1.5 rounded-lg flex items-center gap-1 font-bold cursor-pointer transition-all"
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
                )}
              </div>
            </div>

            {/* Rekap Absensi Bulanan Karyawan Terpilih */}
            <div className="bg-white rounded-2xl border border-zinc-150 shadow-sm p-6 space-y-6">
              <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                <h3 className="text-sm font-bold text-zinc-950 flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-[#FF8200]" />
                  Pemantauan Absensi Bulanan Karyawan
                </h3>
                
                {/* Filters */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                  {/* Select Karyawan */}
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <span className="text-xs text-zinc-400 font-bold uppercase tracking-wider shrink-0">Karyawan:</span>
                    <select
                      value={selectedEmployeeId}
                      onChange={(e) => setSelectedEmployeeId(e.target.value)}
                      className="border border-zinc-200 rounded-lg px-2.5 py-1.5 text-xs text-zinc-700 focus:outline-none focus:ring-2 focus:ring-[#FF8200] bg-white cursor-pointer font-bold w-full sm:w-48"
                    >
                      {employees && employees.map((emp: any) => (
                        <option key={emp.id} value={emp.id}>
                          {emp.name} ({emp.employee.employee_code})
                        </option>
                      ))}
                    </select>
                  </div>
                  {/* Select Bulan */}
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <span className="text-xs text-zinc-400 font-bold uppercase tracking-wider shrink-0">Periode:</span>
                    <input
                      type="month"
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(e.target.value)}
                      className="border border-zinc-200 rounded-lg px-2.5 py-1.5 text-xs text-zinc-700 focus:outline-none focus:ring-2 focus:ring-orange-500/10 focus:border-[#FF8200] bg-white cursor-pointer font-semibold w-full sm:w-auto"
                    />
                  </div>
                </div>
              </div>

              {/* Rekap Absensi Stats Grid Admin */}
              {selectedEmployeeId && !adminSelectedEmpLoading && (
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
                  <div
                    onClick={() => setAttendanceFilter(attendanceFilter === "present" ? null : "present")}
                    className={`transition-all duration-200 cursor-pointer overflow-hidden rounded-2xl border p-4.5 flex items-center justify-between shadow-sm hover:shadow-md hover:scale-[1.01] hover:border-zinc-300 ${
                      attendanceFilter === "present"
                        ? "border-emerald-500 ring-2 ring-emerald-500/10 bg-emerald-50/20"
                        : attendanceFilter
                        ? "opacity-50 border-zinc-150 bg-zinc-50/30"
                        : "border-zinc-150 bg-zinc-50/30"
                    }`}
                  >
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Tepat Waktu</span>
                      <div className="text-xl font-extrabold text-emerald-600">{adminTotalPresent} Hari</div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600">
                      <UserCheck className="h-5 w-5" />
                    </div>
                  </div>

                  <div
                    onClick={() => setAttendanceFilter(attendanceFilter === "late" ? null : "late")}
                    className={`transition-all duration-200 cursor-pointer overflow-hidden rounded-2xl border p-4.5 flex items-center justify-between shadow-sm hover:shadow-md hover:scale-[1.01] hover:border-zinc-300 ${
                      attendanceFilter === "late"
                        ? "border-amber-500 ring-2 ring-amber-500/10 bg-amber-50/20"
                        : attendanceFilter
                        ? "opacity-50 border-zinc-150 bg-zinc-50/30"
                        : "border-zinc-150 bg-zinc-50/30"
                    }`}
                  >
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Terlambat</span>
                      <div className="text-xl font-extrabold text-amber-600">{adminTotalLate} Hari</div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600">
                      <Clock className="h-5 w-5" />
                    </div>
                  </div>

                  <div
                    onClick={() => setAttendanceFilter(attendanceFilter === "leave" ? null : "leave")}
                    className={`transition-all duration-200 cursor-pointer overflow-hidden rounded-2xl border p-4.5 flex items-center justify-between shadow-sm hover:shadow-md hover:scale-[1.01] hover:border-zinc-300 ${
                      attendanceFilter === "leave"
                        ? "border-blue-500 ring-2 ring-blue-500/10 bg-blue-50/20"
                        : attendanceFilter
                        ? "opacity-50 border-zinc-150 bg-zinc-50/30"
                        : "border-zinc-150 bg-zinc-50/30"
                    }`}
                  >
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Izin & Cuti</span>
                      <div className="text-xl font-extrabold text-blue-600">{adminTotalLeave} Hari</div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600">
                      <FileText className="h-5 w-5" />
                    </div>
                  </div>

                  <div
                    onClick={() => setAttendanceFilter(attendanceFilter === "wh_permission" ? null : "wh_permission")}
                    className={`transition-all duration-200 cursor-pointer overflow-hidden rounded-2xl border p-4.5 flex items-center justify-between shadow-sm hover:shadow-md hover:scale-[1.01] hover:border-zinc-300 ${
                      attendanceFilter === "wh_permission"
                        ? "border-purple-500 ring-2 ring-purple-500/10 bg-purple-50/20"
                        : attendanceFilter
                        ? "opacity-50 border-zinc-150 bg-zinc-50/30"
                        : "border-zinc-150 bg-zinc-50/30"
                    }`}
                  >
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Izin Jam Kerja</span>
                      <div className="text-xl font-extrabold text-purple-600">{adminTotalWhPermissions} Hari</div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-purple-50 text-purple-600">
                      <Timer className="h-5 w-5" />
                    </div>
                  </div>

                  <div
                    onClick={() => setAttendanceFilter(attendanceFilter === "absent" ? null : "absent")}
                    className={`transition-all duration-200 cursor-pointer overflow-hidden rounded-2xl border p-4.5 flex items-center justify-between shadow-sm hover:shadow-md hover:scale-[1.01] hover:border-zinc-300 ${
                      attendanceFilter === "absent"
                        ? "border-rose-500 ring-2 ring-rose-500/10 bg-rose-50/20"
                        : attendanceFilter
                        ? "opacity-50 border-zinc-150 bg-zinc-50/30"
                        : "border-zinc-150 bg-zinc-50/30"
                    }`}
                  >
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Tidak Hadir</span>
                      <div className="text-xl font-extrabold text-rose-600">{adminTotalAbsent} Hari</div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-rose-50 text-rose-600">
                      <CalendarX className="h-5 w-5" />
                    </div>
                  </div>

                  <div
                    className={`transition-all duration-200 overflow-hidden rounded-2xl border border-zinc-150 p-4.5 flex items-center justify-between shadow-sm ${
                      attendanceFilter ? "opacity-50" : ""
                    }`}
                  >
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Total Lembur</span>
                      <div className="text-xl font-extrabold text-amber-600">
                        {adminSelectedEmpActivitiesLoading ? (
                          <Loader2 className="h-4.5 w-4.5 animate-spin text-amber-600 inline" />
                        ) : (
                          adminOvertimeFormatted
                        )}
                      </div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600">
                      <Moon className="h-5 w-5" />
                    </div>
                  </div>

                  {/* Card Piala Tercepat Admin */}
                  <div
                    onClick={() => setAttendanceFilter(attendanceFilter === "earliest" ? null : "earliest")}
                    className={`transition-all duration-200 cursor-pointer overflow-hidden rounded-2xl border p-4.5 flex items-center justify-between shadow-sm hover:shadow-md hover:scale-[1.01] hover:border-zinc-300 ${
                      attendanceFilter === "earliest"
                        ? "border-amber-500 ring-2 ring-amber-500/10 bg-amber-50/20"
                        : attendanceFilter
                        ? "opacity-50 border-zinc-150 bg-zinc-50/30"
                        : "border-zinc-150 bg-zinc-50/30"
                    }`}
                  >
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Piala Tercepat</span>
                      <div className="text-xl font-extrabold text-amber-600">{adminTotalTrophies} Piala</div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-amber-50 text-amber-500">
                      <Trophy className="h-5 w-5 text-yellow-500 fill-yellow-400 shrink-0" />
                    </div>
                  </div>
                </div>
              )}

              {/* Filter Alert Message Admin */}
              {attendanceFilter && (
                <div className="bg-zinc-50 border border-zinc-150 rounded-xl p-2.5 px-4 flex items-center justify-between text-xs text-zinc-700 shadow-sm transition-all duration-250 mb-4">
                  <div className="flex items-center gap-2 font-semibold">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#FF8200] animate-pulse"></span>
                    Menampilkan hasil filter: <span className="font-bold text-[#FF8200] capitalize">{attendanceFilter === "wh_permission" ? "Izin Jam Kerja" : attendanceFilter === "leave" ? "Izin & Cuti" : attendanceFilter === "earliest" ? "Piala Tercepat" : attendanceFilter.replace("_", " ")}</span> ({filteredAdminSelectedGrid.length} Hari)
                  </div>
                  <button
                    onClick={() => setAttendanceFilter(null)}
                    className="text-[10px] bg-zinc-200 hover:bg-zinc-300 text-zinc-700 px-2.5 py-1 rounded-lg font-bold cursor-pointer transition-all border border-zinc-300"
                  >
                    Clear Filter
                  </button>
                </div>
              )}

              {/* Grid Bulanan Admin */}
              <div className="border border-zinc-150 rounded-xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto max-h-[480px]">
                  {adminSelectedEmpLoading ? (
                    <div className="p-12 flex justify-center">
                      <Loader2 className="h-8 w-8 animate-spin text-[#FF8200]" />
                    </div>
                  ) : !selectedEmployeeId ? (
                    <div className="p-12 text-center text-zinc-400 text-xs">Silakan pilih karyawan terlebih dahulu.</div>
                  ) : (
                    <table className="w-full divide-y divide-zinc-150 text-left text-xs">
                      <thead className="bg-zinc-50/70 font-bold text-zinc-400 uppercase tracking-wider sticky top-0 backdrop-blur-sm z-10">
                        <tr>
                          <th className="p-3.5">Hari & Tanggal</th>
                          <th className="p-3.5">Absen Masuk</th>
                          <th className="p-3.5">Jam Istirahat</th>
                          <th className="p-3.5">Absen Pulang</th>
                          <th className="p-3.5 text-center">Status</th>
                          <th className="p-3.5 text-center">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100 font-medium text-zinc-700">
                        {filteredAdminSelectedGrid.map((day: any) => (
                          <tr key={day.dateString} className="hover:bg-zinc-50/30">
                            <td className="p-3.5">
                              <div className="font-bold text-zinc-900">{day.formattedDay}</div>
                              <div className="text-[10px] text-zinc-400 font-semibold capitalize">{day.dayName}</div>
                            </td>
                            <td className="p-3.5 font-mono text-zinc-800 font-bold">
                              <div className="flex items-center gap-1">
                                {day.checkIn}
                                {day.isEarliest && (
                                  <span title="Datang Tercepat!">
                                    <Trophy className="h-3.5 w-3.5 text-yellow-500 fill-yellow-400 shrink-0" />
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="p-3.5 font-mono text-zinc-850 font-bold">
                              {day.breakStart !== "-" 
                                ? `${day.breakStart} - ${day.breakEnd !== "-" ? day.breakEnd : "..."}` 
                                : "-"}
                            </td>
                            <td className="p-3.5 font-mono text-zinc-800 font-bold">{day.checkOut}</td>
                            <td className="p-3.5 text-center">
                              {day.status === "future" ? (
                                <span className="text-zinc-300 font-bold">-</span>
                              ) : (
                                <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${day.colorClass}`}>
                                  {day.statusLabel}
                                </span>
                              )}
                            </td>
                            <td className="p-3.5 text-center">
                              {day.attendanceId && isAdmin ? (
                                <button
                                  onClick={() => handleDeleteAttendance(day.attendanceId)}
                                  disabled={deleteAttendanceMutation.isPending}
                                  className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-150 px-2.5 py-1 rounded-md cursor-pointer transition-all text-[11px] font-bold disabled:bg-zinc-100 disabled:text-zinc-400 disabled:border-zinc-200"
                                >
                                  Reset/Hapus
                                </button>
                              ) : day.leaveId && isAdmin ? (
                                <button
                                  onClick={() => handleDeleteLeave(day.leaveId)}
                                  disabled={deleteLeaveMutation.isPending}
                                  className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-150 px-2.5 py-1 rounded-md cursor-pointer transition-all text-[11px] font-bold disabled:bg-zinc-100 disabled:text-zinc-400 disabled:border-zinc-200"
                                >
                                  Reset/Hapus
                                </button>
                              ) : (
                                <span className="text-zinc-300">-</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>

            {/* Pengaturan Area Absensi Kantor (Geofence Settings) */}
            {isAdmin && (
              <div className="bg-white rounded-2xl border border-zinc-150 shadow-sm p-6 space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-sm font-bold text-zinc-950 flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-[#FF8200]" />
                    Pengaturan Area Absensi Kantor (Geofence)
                  </h3>
                  <button
                    onClick={openGeofenceAddModal}
                    className="bg-[#FF8200] hover:bg-[#e07200] text-white text-xs font-bold px-3.5 py-2 rounded-lg shadow-sm cursor-pointer transition-all flex items-center gap-1"
                  >
                    Tambah Lokasi Absen
                  </button>
                </div>

                <div className="overflow-x-auto">
                  {!geofences || geofences.length === 0 ? (
                    <div className="text-center py-6 text-zinc-400 text-xs">
                      Belum ada area kantor yang dikonfigurasi. Klik tombol di atas untuk menambahkannya.
                    </div>
                  ) : (
                    <table className="w-full divide-y divide-zinc-150 text-left text-xs">
                      <thead className="bg-zinc-50/70 font-bold text-zinc-400 uppercase tracking-wider">
                        <tr>
                          <th className="p-3">Nama Lokasi</th>
                          <th className="p-3">Garis Lintang (Lat)</th>
                          <th className="p-3">Garis Bujur (Lng)</th>
                          <th className="p-3">Radius Absen</th>
                          <th className="p-3 text-center">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100 font-medium text-zinc-700">
                        {geofences.map((g: any) => (
                          <tr key={g.id} className="hover:bg-zinc-50/50">
                            <td className="p-3 text-zinc-900 font-bold">{g.name}</td>
                            <td className="p-3 font-mono text-zinc-500">{g.latitude}</td>
                            <td className="p-3 font-mono text-zinc-500">{g.longitude}</td>
                            <td className="p-3 font-semibold text-zinc-800">{g.radius} meter</td>
                            <td className="p-3 text-center">
                              <div className="flex justify-center gap-2">
                                <button
                                  onClick={() => openGeofenceEditModal(g)}
                                  className="bg-zinc-50 hover:bg-zinc-100 text-zinc-700 border border-zinc-200 px-2.5 py-1 rounded-md cursor-pointer transition-all text-[11px] font-bold"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => handleDeleteGeofence(g.id)}
                                  className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-150 px-2.5 py-1 rounded-md cursor-pointer transition-all text-[11px] font-bold"
                                >
                                  Hapus
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}

          </div>
        )}

        {/* Modal Alasan Penolakan Cuti */}
        {isRejectionModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/80 backdrop-blur-sm px-4">
            <div className="bg-white rounded-2xl border border-zinc-100 shadow-2xl w-full max-w-sm p-6 overflow-hidden">
              <div className="flex items-center justify-between border-b border-zinc-100 pb-3 mb-5">
                <h3 className="text-sm font-bold text-zinc-950">Masukkan Alasan Penolakan</h3>
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
                    disabled={rejectLeaveMutation.isPending}
                    className="flex-1 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold py-2.5 rounded-lg transition-all cursor-pointer flex justify-center items-center"
                  >
                    {rejectLeaveMutation.isPending ? (
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

        {/* Modal Form Geofence */}
        {isGeofenceModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/80 backdrop-blur-sm px-4">
            <div className="bg-white rounded-2xl border border-zinc-100 shadow-2xl w-full max-w-sm p-6 overflow-hidden">
              <div className="flex items-center justify-between border-b border-zinc-100 pb-3 mb-5">
                <h3 className="text-sm font-bold text-zinc-950">
                  {geofenceEditId ? "Ubah Lokasi Absen" : "Tambah Lokasi Absen Baru"}
                </h3>
                <button
                  onClick={() => setIsGeofenceModalOpen(false)}
                  className="p-1 text-zinc-400 hover:text-zinc-700 rounded-lg cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-4">
                {/* Nama Lokasi */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1">
                    Nama Area / Kantor
                  </label>
                  <input
                    type="text"
                    value={geofenceName}
                    onChange={(e) => setGeofenceName(e.target.value)}
                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-xs text-zinc-950 focus:outline-none focus:ring-2 focus:ring-[#FF8200]"
                    placeholder="Contoh: Kantor Pusat Omfai"
                  />
                </div>

                {/* GPS Coordinates & Helper Button */}
                <div className="flex justify-between items-center pt-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Koordinat GPS</span>
                  <button
                    onClick={handleGetAdminGPSForForm}
                    className="text-[#FF8200] hover:text-[#e07200] font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                  >
                    <MapPin className="h-3.5 w-3.5" />
                    Gunakan GPS Saat Ini
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[9px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                      Latitude
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={geofenceLat}
                      onChange={(e) => setGeofenceLat(e.target.value)}
                      className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-xs text-zinc-950 focus:outline-none focus:ring-2 focus:ring-[#FF8200]"
                      placeholder="-6.200000"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                      Longitude
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={geofenceLng}
                      onChange={(e) => setGeofenceLng(e.target.value)}
                      className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-xs text-zinc-950 focus:outline-none focus:ring-2 focus:ring-[#FF8200]"
                      placeholder="106.800000"
                    />
                  </div>
                </div>

                {/* Radius */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1">
                    Radius Absensi (Meter)
                  </label>
                  <input
                    type="number"
                    value={geofenceRadius}
                    onChange={(e) => setGeofenceRadius(Number(e.target.value))}
                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-xs text-zinc-950 focus:outline-none focus:ring-2 focus:ring-[#FF8200]"
                    placeholder="Contoh: 100"
                  />
                  <p className="text-[9px] text-zinc-400 mt-1">Jarak maksimum toleransi absensi karyawan (dalam meter).</p>
                </div>

                {/* Action Buttons */}
                <div className="pt-4 flex gap-3 border-t border-zinc-100">
                  <button
                    type="button"
                    onClick={() => setIsGeofenceModalOpen(false)}
                    className="flex-1 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs font-bold py-2.5 rounded-lg transition-all cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    onClick={handleConfirmSaveGeofence}
                    disabled={saveGeofenceMutation.isPending}
                    className="flex-1 bg-[#FF8200] hover:bg-[#e07200] text-white text-xs font-bold py-2.5 rounded-lg transition-all cursor-pointer flex justify-center items-center"
                  >
                    {saveGeofenceMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Menyimpan...
                      </>
                    ) : (
                      "Simpan Lokasi"
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal Pengajuan Cuti / Izin */}
        {isLeaveModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/80 backdrop-blur-sm px-4">
            <div className="bg-white rounded-2xl border border-zinc-100 shadow-2xl w-full max-w-md flex flex-col max-h-[90vh] overflow-hidden">
              <div className="flex items-center justify-between border-b border-zinc-100 p-6 pb-4">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-blue-605" />
                  <h3 className="text-sm font-bold text-zinc-950">Ajukan Cuti / Izin Karyawan</h3>
                </div>
                <button
                  onClick={() => setIsLeaveModalOpen(false)}
                  className="p-1 text-zinc-400 hover:text-zinc-700 rounded-lg cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit(onSubmitLeave)} className="flex flex-col flex-1 overflow-hidden">
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                  {leaveHistory && (
                    <div className="bg-blue-50 text-blue-800 border border-blue-100 p-2.5 px-4 rounded-xl text-xs font-bold flex justify-between items-center">
                      <span>Sisa Kuota Cuti Tahunan:</span>
                      <span className="bg-blue-100 px-2 py-0.5 rounded-full">
                        {leaveHistory.is_eligible ? `${leaveHistory.leave_balance} Hari` : "0 Hari (Belum 1 Tahun Kerja)"}
                      </span>
                    </div>
                  )}

                  {/* Tipe Cuti */}
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1">
                      Tipe Pengajuan
                    </label>
                    <select
                      {...register("type")}
                      className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-xs text-zinc-700 focus:outline-none focus:ring-2 focus:ring-[#FF8200] focus:border-transparent bg-white"
                    >
                      <option value="annual_leave">Cuti Tahunan</option>
                      <option value="sick_leave">Cuti Sakit (Wajib Surat Dokter)</option>
                      <option value="permission">Izin</option>
                    </select>
                  </div>

                  {/* Tanggal */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1">
                        Tgl Mulai
                      </label>
                      <input
                        {...register("start_date")}
                        type="date"
                        min={new Date().toLocaleDateString("en-CA")}
                        className={`w-full rounded-lg border px-3 py-2 text-xs text-zinc-950 focus:outline-none focus:ring-2 focus:ring-[#FF8200] focus:border-transparent ${
                          errors.start_date ? "border-red-300" : "border-zinc-200"
                        }`}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1">
                        Tgl Selesai
                      </label>
                      <input
                        {...register("end_date")}
                        type="date"
                        min={watch("start_date") || new Date().toLocaleDateString("en-CA")}
                        className={`w-full rounded-lg border px-3 py-2 text-xs text-zinc-950 focus:outline-none focus:ring-2 focus:ring-[#FF8200] focus:border-transparent ${
                          errors.end_date ? "border-red-300" : "border-zinc-200"
                        }`}
                      />
                    </div>
                  </div>
                  {(errors.start_date || errors.end_date) && (
                    <p className="text-[11px] text-red-600 font-semibold">
                      {errors.start_date?.message || errors.end_date?.message}
                    </p>
                  )}

                  {/* Alasan */}
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1">
                      Alasan / Keterangan
                    </label>
                    <textarea
                      {...register("reason")}
                      rows={3}
                      className={`w-full rounded-lg border px-3 py-2 text-xs text-zinc-950 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#FF8200] focus:border-transparent ${
                        errors.reason ? "border-red-300" : "border-zinc-200"
                      }`}
                      placeholder="Masukkan alasan pengajuan secara jelas..."
                    />
                    {errors.reason && (
                      <p className="mt-1 text-[11px] text-red-600 font-semibold">{errors.reason.message}</p>
                    )}
                  </div>

                  {/* Lampiran (Wajib untuk Sakit) */}
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1">
                      Dokumen Lampiran {leaveType === "sick_leave" && <span className="text-red-500">* (Wajib)</span>}
                    </label>
                    <input
                      {...register("attachment")}
                      type="file"
                      accept=".jpg,.jpeg,.png,.pdf"
                      className="w-full border border-zinc-200 rounded-lg text-xs text-zinc-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-l-lg file:border-0 file:text-[11px] file:font-bold file:bg-zinc-150 file:text-zinc-700 hover:file:bg-zinc-200 file:cursor-pointer"
                    />
                    <p className="text-[9px] text-zinc-400 mt-1">Format: JPG, PNG, PDF (Maks. 2MB)</p>
                  </div>
                </div>

                {/* Submit / Batal buttons */}
                <div className="p-6 bg-zinc-50/50 border-t border-zinc-100 flex gap-3 rounded-b-2xl">
                  <button
                    type="button"
                    onClick={() => setIsLeaveModalOpen(false)}
                    className="flex-1 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs font-bold py-2.5 rounded-lg transition-all cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={submitLeaveMutation.isPending}
                    className="flex-1 flex justify-center items-center gap-2 bg-[#FF8200] hover:bg-[#e07200] text-white font-bold py-2.5 rounded-lg shadow-sm text-xs cursor-pointer disabled:bg-zinc-200 disabled:text-zinc-400"
                  >
                    {submitLeaveMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Mengirim...
                      </>
                    ) : (
                      <>
                        <Upload className="h-3.5 w-3.5" />
                        Kirim Pengajuan
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
        {/* Modal Pengajuan Izin Jam Kerja */}
        {isWorkHourModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/80 backdrop-blur-sm px-4">
            <div className="bg-white rounded-2xl border border-zinc-100 shadow-2xl w-full max-w-md flex flex-col max-h-[90vh] overflow-hidden">
              <div className="flex items-center justify-between border-b border-zinc-100 p-6 pb-4">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-blue-605" />
                  <h3 className="text-sm font-bold text-zinc-950">Ajukan Izin Jam Kerja</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsWorkHourModalOpen(false)}
                  className="p-1 text-zinc-400 hover:text-zinc-700 rounded-lg cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!workHourDate) {
                    showAlert("Tanggal wajib diisi", "warning");
                    return;
                  }
                  if (!workHourReason || workHourReason.trim() === "") {
                    showAlert("Alasan wajib diisi", "warning");
                    return;
                  }
                  submitWorkHourPermissionMutation.mutate({
                    type: workHourType,
                    date: workHourDate,
                    start_time: workHourStartTime,
                    end_time: workHourEndTime,
                    reason: workHourReason,
                    attachment: workHourAttachment,
                  });
                }}
                className="flex flex-col flex-1 overflow-hidden"
              >
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                  {/* Tipe Izin */}
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1">
                      Tipe Izin Jam Kerja
                    </label>
                    <select
                      value={workHourType}
                      onChange={(e) => {
                        const val = e.target.value as any;
                        setWorkHourType(val);
                        setWorkHourStartTime("");
                        setWorkHourEndTime("");
                      }}
                      className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-xs text-zinc-700 focus:outline-none focus:ring-2 focus:ring-[#FF8200] focus:border-transparent bg-white font-semibold"
                    >
                      <option value="out_temporary">Izin Keluar Sementara</option>
                      <option value="arrive_late">Izin Datang Terlambat</option>
                      <option value="leave_early">Izin Pulang Lebih Awal</option>
                    </select>
                  </div>

                  {/* Tanggal */}
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1">
                      Tanggal Izin
                    </label>
                    <input
                      type="date"
                      value={workHourDate}
                      onChange={(e) => setWorkHourDate(e.target.value)}
                      className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-xs text-zinc-950 focus:outline-none focus:ring-2 focus:ring-[#FF8200] focus:border-transparent bg-white"
                    />
                  </div>

                  {/* Jam Mulai & Jam Selesai Dinamis */}
                  <div className="grid grid-cols-2 gap-3">
                    {/* Input Jam Mulai / Jam Keluar */}
                    {workHourType !== "arrive_late" && (
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1">
                          {workHourType === "leave_early" ? "Jam Keluar" : "Jam Mulai Keluar"}
                        </label>
                        <input
                          type="time"
                          value={workHourStartTime}
                          onChange={(e) => setWorkHourStartTime(e.target.value)}
                          className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-xs text-zinc-950 focus:outline-none focus:ring-2 focus:ring-[#FF8200] focus:border-transparent bg-white"
                        />
                      </div>
                    )}

                    {/* Input Jam Selesai / Estimasi Kembali */}
                    {workHourType !== "leave_early" && (
                      <div className={workHourType === "arrive_late" ? "col-span-2" : ""}>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1">
                          {workHourType === "arrive_late" ? "Estimasi Jam Tiba di Kantor" : "Estimasi Jam Kembali"}
                        </label>
                        <input
                          type="time"
                          value={workHourEndTime}
                          onChange={(e) => setWorkHourEndTime(e.target.value)}
                          className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-xs text-zinc-950 focus:outline-none focus:ring-2 focus:ring-[#FF8200] focus:border-transparent bg-white"
                        />
                      </div>
                    )}
                  </div>

                  {/* Alasan */}
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1">
                      Alasan / Keterangan Izin
                    </label>
                    <textarea
                      rows={3}
                      value={workHourReason}
                      onChange={(e) => setWorkHourReason(e.target.value)}
                      className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-xs text-zinc-950 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#FF8200] focus:border-transparent"
                      placeholder="Jelaskan alasan izin secara detail..."
                    />
                  </div>

                  {/* Lampiran */}
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1">
                      Dokumen Lampiran (Opsional)
                    </label>
                    <input
                      type="file"
                      accept=".jpg,.jpeg,.png,.pdf"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          setWorkHourAttachment(e.target.files[0]);
                        }
                      }}
                      className="w-full border border-zinc-200 rounded-lg text-xs text-zinc-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-l-lg file:border-0 file:text-[11px] file:font-bold file:bg-zinc-150 file:text-zinc-700 hover:file:bg-zinc-200 file:cursor-pointer"
                    />
                    <p className="text-[9px] text-zinc-400 mt-1">Format: JPG, PNG, PDF (Maks. 2MB)</p>
                  </div>
                </div>

                {/* Submit / Batal buttons */}
                <div className="p-6 bg-zinc-50/50 border-t border-zinc-100 flex gap-3 rounded-b-2xl">
                  <button
                    type="button"
                    onClick={() => setIsWorkHourModalOpen(false)}
                    className="flex-1 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs font-bold py-2.5 rounded-lg transition-all cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={submitWorkHourPermissionMutation.isPending}
                    className="flex-1 flex justify-center items-center gap-2 bg-[#FF8200] hover:bg-[#e07200] text-white font-bold py-2.5 rounded-lg shadow-sm text-xs cursor-pointer disabled:bg-zinc-200 disabled:text-zinc-400"
                  >
                    {submitWorkHourPermissionMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Mengirim...
                      </>
                    ) : (
                      <>
                        <Upload className="h-3.5 w-3.5" />
                        Kirim Pengajuan
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}


        {/* Modal Riwayat Pengajuan Cuti / Izin */}
        {isLeaveHistoryModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/80 backdrop-blur-sm px-4">
            <div className="bg-white rounded-2xl border border-zinc-100 shadow-2xl w-full max-w-4xl p-6 overflow-hidden flex flex-col max-h-[85vh]">
              <div className="flex items-center justify-between border-b border-zinc-100 pb-3 mb-5 shrink-0">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-blue-600" />
                  <h3 className="text-sm font-bold text-zinc-950">Status Pengajuan Cuti & Izin Anda</h3>
                </div>
                <button
                  onClick={() => setIsLeaveHistoryModalOpen(false)}
                  className="p-1 text-zinc-400 hover:text-zinc-700 rounded-lg cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-zinc-150 mb-4 shrink-0">
                <button
                  onClick={() => setHistoryActiveTab("leave")}
                  className={`px-4 py-2 text-xs font-bold border-b-2 cursor-pointer transition-all ${
                    historyActiveTab === "leave"
                      ? "border-[#FF8200] text-[#FF8200]"
                      : "border-transparent text-zinc-400 hover:text-zinc-600"
                  }`}
                >
                  Cuti & Izin Harian
                </button>
                <button
                  onClick={() => setHistoryActiveTab("work_hour")}
                  className={`px-4 py-2 text-xs font-bold border-b-2 cursor-pointer transition-all ${
                    historyActiveTab === "work_hour"
                      ? "border-[#FF8200] text-[#FF8200]"
                      : "border-transparent text-zinc-400 hover:text-zinc-600"
                  }`}
                >
                  Izin Jam Kerja
                </button>
              </div>

              <div className="overflow-y-auto flex-1">
                {historyActiveTab === "leave" ? (
                  leaveLoading ? (
                    <div className="p-12 flex justify-center">
                      <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                    </div>
                  ) : !leaveHistory?.data || leaveHistory.data.length === 0 ? (
                    <p className="text-xs text-zinc-400 py-12 text-center">Belum ada riwayat pengajuan cuti/izin.</p>
                  ) : (
                    <table className="w-full divide-y divide-zinc-150 text-left text-xs">
                      <thead className="bg-zinc-50/70 font-bold text-zinc-400 uppercase tracking-wider sticky top-0 z-10">
                        <tr>
                          <th className="p-3">Tipe</th>
                          <th className="p-3">Durasi Tanggal</th>
                          <th className="p-3">Alasan</th>
                          <th className="p-3 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100 font-medium">
                        {leaveHistory.data.map((item: any) => {
                          const start = formatIndonesianDate(item.start_date);
                          const end = formatIndonesianDate(item.end_date);
                          const typeLabel = item.type === "annual_leave" ? "Cuti Tahunan" : item.type === "sick_leave" ? "Sakit" : "Izin";
                          return (
                            <tr key={item.id} className="text-zinc-700 hover:bg-zinc-50/50">
                              <td className="p-3 text-zinc-900 font-bold">{typeLabel}</td>
                              <td className="p-3 text-zinc-500 font-semibold">{start} s/d {end}</td>
                              <td className="p-3 text-zinc-650 max-w-[300px] truncate" title={item.reason}>{item.reason}</td>
                               <td className="p-3 text-center">
                                 <div className="flex flex-col items-center gap-1.5 justify-center">
                                   <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
                                     item.status === "approved"
                                       ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                                       : item.status === "rejected"
                                       ? "bg-rose-50 text-rose-700 border border-rose-100"
                                       : item.status === "cancelled"
                                       ? "bg-zinc-100 text-zinc-600 border border-zinc-200"
                                       : "bg-amber-50 text-amber-700 border border-amber-100"
                                   }`}>
                                     {item.status === "approved"
                                       ? "DISETUJUI"
                                       : item.status === "rejected"
                                       ? "DITOLAK"
                                       : item.status === "cancelled"
                                       ? "DIBATALKAN"
                                       : "DIPROSES"}
                                   </span>
                                   {item.status === "pending" && (
                                     <button
                                       onClick={() => showConfirm(
                                         "Apakah Anda yakin ingin membatalkan pengajuan ini?",
                                         () => cancelLeaveMutation.mutate(item.id),
                                         "danger",
                                         "Konfirmasi Pembatalan"
                                       )}
                                       disabled={cancelLeaveMutation.isPending}
                                       className="text-[9px] font-bold text-rose-650 hover:text-rose-800 border border-rose-150 bg-rose-50 hover:bg-rose-100 px-2 py-0.5 rounded cursor-pointer transition-all"
                                     >
                                       Batalkan
                                     </button>
                                   )}
                                 </div>
                                {item.rejection_reason && (
                                  <p className="text-[9px] text-rose-600 mt-1 font-semibold">Alasan: {item.rejection_reason}</p>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )
                ) : (
                  workHourPermissionsLoading ? (
                    <div className="p-12 flex justify-center">
                      <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                    </div>
                  ) : !workHourPermissions?.data || workHourPermissions.data.length === 0 ? (
                    <p className="text-xs text-zinc-400 py-12 text-center">Belum ada riwayat pengajuan izin jam kerja.</p>
                  ) : (
                    <table className="w-full divide-y divide-zinc-150 text-left text-xs">
                      <thead className="bg-zinc-50/70 font-bold text-zinc-400 uppercase tracking-wider sticky top-0 z-10">
                        <tr>
                          <th className="p-3">Tipe Izin</th>
                          <th className="p-3">Tanggal & Jam</th>
                          <th className="p-3">Alasan</th>
                          <th className="p-3 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100 font-medium">
                        {workHourPermissions.data.map((item: any) => {
                          const dateStr = formatIndonesianDate(item.date);
                          const typeLabel = item.type === "out_temporary" ? "Izin Keluar Sementara" : item.type === "arrive_late" ? "Izin Datang Terlambat" : "Izin Pulang Lebih Awal";
                          const timeRange = (item.type === "leave_early") 
                            ? `Mulai ${item.start_time ? item.start_time.substring(0, 5) : "--:--"}`
                            : `${item.start_time ? item.start_time.substring(0, 5) : "--:--"} s/d ${item.end_time ? item.end_time.substring(0, 5) : "--:--"}`;
                          return (
                            <tr key={item.id} className="text-zinc-700 hover:bg-zinc-50/50">
                              <td className="p-3 text-zinc-900 font-bold">{typeLabel}</td>
                              <td className="p-3 text-zinc-500 font-semibold">
                                <div className="text-zinc-700 font-bold">{dateStr}</div>
                                <div className="text-[10px] text-zinc-400 mt-0.5">{timeRange}</div>
                              </td>
                              <td className="p-3 text-zinc-650 max-w-[300px] truncate" title={item.reason}>{item.reason}</td>
                              <td className="p-3 text-center">
                                <div className="flex flex-col items-center gap-1.5 justify-center">
                                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
                                    item.status === "approved"
                                      ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                                      : item.status === "rejected"
                                      ? "bg-rose-50 text-rose-700 border border-rose-100"
                                      : item.status === "cancelled"
                                      ? "bg-zinc-100 text-zinc-600 border border-zinc-200"
                                      : "bg-amber-50 text-amber-700 border border-amber-100"
                                  }`}>
                                    {item.status === "approved"
                                      ? "DISETUJUI"
                                      : item.status === "rejected"
                                      ? "DITOLAK"
                                      : item.status === "cancelled"
                                      ? "DIBATALKAN"
                                      : "DIPROSES"}
                                  </span>
                                  {item.status === "pending" && (
                                    <button
                                      onClick={() => showConfirm(
                                        "Apakah Anda yakin ingin membatalkan pengajuan izin ini?",
                                        () => cancelWorkHourPermissionMutation.mutate(item.id),
                                        "danger",
                                        "Konfirmasi Pembatalan"
                                      )}
                                      disabled={cancelWorkHourPermissionMutation.isPending}
                                      className="text-[9px] font-bold text-rose-650 hover:text-rose-800 border border-rose-150 bg-rose-50 hover:bg-rose-100 px-2 py-0.5 rounded cursor-pointer transition-all"
                                    >
                                      Batalkan
                                    </button>
                                  )}
                                </div>
                                {item.rejection_reason && (
                                  <p className="text-[9px] text-rose-600 mt-1 font-semibold">Alasan: {item.rejection_reason}</p>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )
                )}
              </div>

              <div className="pt-4 border-t border-zinc-100 flex justify-end shrink-0 mt-4">
                <button
                  type="button"
                  onClick={() => setIsLeaveHistoryModalOpen(false)}
                  className="bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs font-bold px-5 py-2.5 rounded-lg transition-all cursor-pointer"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        )}

      </div>

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
        confirmText="Ya, Lanjutkan"
        cancelText="Batal"
      />
    </DashboardLayout>
  );
}
