"use client";

import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Users, Plus, X, Edit2, Trash2, Loader2, Key } from "lucide-react";
import DashboardLayout from "@/components/dashboard-layout";
import api from "@/lib/api";
import { formatIndonesianDate } from "@/lib/utils";
import ConfirmModal from "@/components/confirm-modal";

const userSchema = z.object({
  name: z.string().min(3, "Nama lengkap minimal harus 3 karakter"),
  email: z.string().min(1, "Email wajib diisi").email("Format email tidak valid"),
  password: z.string().optional(),
  role: z.enum(["Owner", "Admin", "Employee"]),
  joined_at: z.string().optional(),
  whatsapp_number: z.string().optional(),
  leave_balance: z.any().optional(),
}).refine((data) => {
  if (data.role === "Employee") {
    return !!data.joined_at && data.joined_at.trim() !== "";
  }
  return true;
}, {
  message: "Tanggal masuk wajib diisi untuk karyawan",
  path: ["joined_at"],
}).refine((data) => {
  if (data.role === "Employee") {
    return !!data.whatsapp_number && data.whatsapp_number.trim() !== "";
  }
  return true;
}, {
  message: "Nomor WhatsApp wajib diisi untuk karyawan",
  path: ["whatsapp_number"],
});

type UserFormValues = z.infer<typeof userSchema>;

export default function UsersPage() {
  const queryClient = useQueryClient();
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Custom Confirm Modal State
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

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    watch,
    formState: { errors },
  } = useForm<UserFormValues>({
    resolver: zodResolver(userSchema),
  });

  const selectedRole = watch("role");

  // Query Daftar User beserta Role Spatie
  const { data: users, isLoading } = useQuery({
    queryKey: ["allUsers"],
    queryFn: async () => {
      const response = await api.get("/users");
      return response.data.data;
    },
  });

  // Mutation: Simpan / Edit User
  const saveMutation = useMutation({
    mutationFn: async (data: UserFormValues) => {
      // Validasi khusus password di client side
      if (!selectedUser && (!data.password || data.password.trim() === "")) {
        throw new Error("Password wajib diisi untuk karyawan baru.");
      }

      const sanitizedData = {
        ...data,
        leave_balance: data.leave_balance === "" || data.leave_balance === undefined || data.leave_balance === null
          ? undefined
          : Number(data.leave_balance)
      };

      if (selectedUser) {
        const response = await api.put(`/users/${selectedUser.id}`, sanitizedData);
        return response.data;
      } else {
        const response = await api.post("/users", sanitizedData);
        return response.data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["allUsers"] });
      queryClient.invalidateQueries({ queryKey: ["employeesList"] });
      queryClient.invalidateQueries({ queryKey: ["dashboardSummary"] });
      closeModal();
    },
    onError: (err: any) => {
      setErrorMsg(err.message || err.response?.data?.message || "Gagal menyimpan data karyawan.");
    },
  });

  // Mutation: Hapus User
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/users/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["allUsers"] });
      queryClient.invalidateQueries({ queryKey: ["employeesList"] });
      queryClient.invalidateQueries({ queryKey: ["dashboardSummary"] });
    },
  });

  const openAddModal = () => {
    setSelectedUser(null);
    reset({ 
      name: "", 
      email: "", 
      password: "", 
      role: "Employee",
      joined_at: "",
      whatsapp_number: "",
      leave_balance: 12
    });
    setIsModalOpen(true);
    setErrorMsg(null);
  };

  const openEditModal = (userData: any) => {
    setSelectedUser(userData);
    reset({
      name: userData.name,
      email: userData.email,
      password: "", // Kosongkan, hanya diisi jika ingin merubah password
      role: userData.roles?.[0]?.name || "Employee",
      joined_at: userData.employee?.joined_at || "",
      whatsapp_number: userData.employee?.whatsapp_number || "",
      leave_balance: userData.employee?.leave_balance ?? 12,
    });
    setIsModalOpen(true);
    setErrorMsg(null);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedUser(null);
    setErrorMsg(null);
  };

  const onSubmit = (values: UserFormValues) => {
    saveMutation.mutate(values);
  };

  const handleDelete = (id: number) => {
    showConfirm(
      "Apakah Anda yakin ingin menghapus akun karyawan ini? Semua data aktivitas terkait juga akan terhapus.",
      () => {
        deleteMutation.mutate(id);
      },
      "danger",
      "Hapus Akun Karyawan"
    );
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-zinc-950">Manajemen Akun Karyawan</h2>
          <p className="text-xs text-zinc-400 font-medium mt-1">Daftar pengguna terdaftar beserta hak akses / role sistem.</p>
        </div>
        <button
          onClick={openAddModal}
          className="flex items-center gap-2 bg-[#FF8200] hover:bg-[#e07200] text-white text-sm font-bold px-4 py-2.5 rounded-lg shadow-sm transition-all cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          Tambah Akun Karyawan
        </button>
      </div>

      {/* Tabel Karyawan */}
      <div className="bg-white rounded-2xl border border-zinc-150 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="space-y-3 p-6 animate-pulse">
              <div className="h-10 bg-zinc-100 rounded" />
              <div className="h-10 bg-zinc-100 rounded" />
            </div>
          ) : !users || users.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-zinc-400 py-16">
              <Users className="h-12 w-12 mb-2 text-zinc-200" />
              <span className="text-sm">Belum ada akun karyawan yang terdaftar.</span>
            </div>
          ) : (
            <table className="min-w-[800px] md:min-w-full divide-y divide-zinc-150 text-left text-xs">
              <thead className="bg-zinc-50/70">
                <tr className="text-zinc-400 uppercase font-bold tracking-wider">
                  <th className="p-4">Nama Lengkap</th>
                  <th className="p-4">Employee ID</th>
                  <th className="p-4">Alamat Email</th>
                  <th className="p-4">WhatsApp</th>
                  <th className="p-4">Role / Hak Akses</th>
                  <th className="p-4">Tanggal Masuk</th>
                  <th className="p-4 text-center">Sisa Cuti</th>
                  <th className="p-4 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 font-medium">
                {users.map((item: any) => (
                  <tr key={item.id} className="text-zinc-700 hover:bg-zinc-50/50">
                    <td className="p-4 text-zinc-900 font-bold text-sm">{item.name}</td>
                    <td className="p-4 font-mono font-bold text-orange-600">
                      {item.employee?.employee_code || "-"}
                    </td>
                    <td className="p-4 text-zinc-650 font-semibold">{item.email}</td>
                    <td className="p-4 text-zinc-500">{item.employee?.whatsapp_number || "-"}</td>
                    <td className="p-4">
                      <span
                        className={`text-[9px] font-bold px-2.5 py-1 rounded-full uppercase ${
                          item.roles?.[0]?.name === "Admin"
                            ? "bg-red-50 text-red-700 border border-red-100"
                            : item.roles?.[0]?.name === "Owner"
                            ? "bg-purple-50 text-purple-700 border border-purple-100"
                            : "bg-blue-50 text-blue-700 border border-blue-100"
                        }`}
                      >
                        {item.roles?.[0]?.name || "Employee"}
                      </span>
                    </td>
                    <td className="p-4 text-zinc-400">
                      {item.employee?.joined_at 
                        ? formatIndonesianDate(item.employee.joined_at) 
                        : formatIndonesianDate(item.created_at)}
                    </td>
                    <td className="p-4 text-center font-semibold text-zinc-600">
                      {item.employee?.leave_balance !== undefined ? item.employee.leave_balance : "-"}
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex justify-center gap-2">
                        <button
                          onClick={() => openEditModal(item)}
                          className="p-1.5 text-zinc-500 hover:text-zinc-950 hover:bg-zinc-100 rounded-md transition-all cursor-pointer"
                          title="Ubah Akun"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-md transition-all cursor-pointer"
                          title="Hapus Akun"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
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

      {/* Modal Form Karyawan */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/80 backdrop-blur-sm px-4">
          <div className="bg-white rounded-2xl border border-zinc-100 shadow-2xl w-full max-w-md flex flex-col max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between border-b border-zinc-100 p-6 pb-4">
              <h3 className="text-sm font-bold text-zinc-950">
                {selectedUser ? "Ubah Akun Karyawan" : "Tambah Akun Karyawan Baru"}
              </h3>
              <button onClick={closeModal} className="p-1 text-zinc-400 hover:text-zinc-700 rounded-lg cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col flex-1 overflow-hidden">
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {errorMsg && (
                  <div className="rounded-lg bg-red-50 p-3 text-xs font-semibold text-red-600 border border-red-100">
                    {errorMsg}
                  </div>
                )}

                {/* Nama */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1">
                    Nama Lengkap
                  </label>
                  <input
                    {...register("name")}
                    type="text"
                    className={`w-full rounded-lg border px-3 py-2.5 text-xs text-zinc-950 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#FF8200] focus:border-transparent ${
                      errors.name ? "border-red-300" : "border-zinc-200"
                    }`}
                    placeholder="Masukkan nama lengkap..."
                  />
                  {errors.name && (
                    <p className="mt-1 text-xs text-red-600 font-semibold">{errors.name.message}</p>
                  )}
                </div>

                {/* Email */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1">
                    Alamat Email
                  </label>
                  <input
                    {...register("email")}
                    type="email"
                    className={`w-full rounded-lg border px-3 py-2.5 text-xs text-zinc-950 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#FF8200] focus:border-transparent ${
                      errors.email ? "border-red-300" : "border-zinc-200"
                    }`}
                    placeholder="name@company.com"
                  />
                  {errors.email && (
                    <p className="mt-1 text-xs text-red-600 font-semibold">{errors.email.message}</p>
                  )}
                </div>

                {/* Password */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1">
                    Kata Sandi {selectedUser && <span className="text-[10px] text-zinc-450 normal-case">(Kosongkan jika tidak diubah)</span>}
                  </label>
                  <input
                    {...register("password")}
                    type="password"
                    className="w-full rounded-lg border border-zinc-200 px-3 py-2.5 text-xs text-zinc-950 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#FF8200] focus:border-transparent"
                    placeholder="••••••••"
                  />
                </div>

                {/* Role Dropdown */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1">
                    Hak Akses / Role
                  </label>
                  <select
                    {...register("role")}
                    className="w-full rounded-lg border px-3 py-2.5 text-xs text-zinc-700 bg-white focus:outline-none focus:ring-2 focus:ring-[#FF8200] focus:border-transparent border-zinc-200"
                  >
                    <option value="Employee">Employee (Karyawan)</option>
                    <option value="Admin">Admin (Super Admin)</option>
                    <option value="Owner">Owner (Pemilik Perusahaan)</option>
                  </select>
                </div>

                {/* Employee ID (Tampil Hanya Saat Edit & Jika Role = Employee) */}
                {selectedRole === "Employee" && selectedUser && (
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1">
                      Employee ID
                    </label>
                    <input
                      type="text"
                      disabled
                      value={selectedUser.employee?.employee_code || "-"}
                      className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-xs text-zinc-450 focus:outline-none"
                    />
                  </div>
                )}

                {/* Tanggal Masuk (Tampil Jika Role = Employee) */}
                {selectedRole === "Employee" && (
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1">
                      Tanggal Masuk
                    </label>
                    <input
                      {...register("joined_at")}
                      type="date"
                      className={`w-full rounded-lg border px-3 py-2.5 text-xs text-zinc-950 focus:outline-none focus:ring-2 focus:ring-[#FF8200] focus:border-transparent ${
                        errors.joined_at ? "border-red-300" : "border-zinc-200"
                      }`}
                    />
                    {errors.joined_at && (
                      <p className="mt-1 text-xs text-red-600 font-semibold">{errors.joined_at.message}</p>
                    )}
                  </div>
                )}

                {/* Nomor WhatsApp (Tampil Jika Role = Employee) */}
                {selectedRole === "Employee" && (
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1">
                      Nomor WhatsApp (Aktif)
                    </label>
                    <input
                      {...register("whatsapp_number")}
                      type="text"
                      className={`w-full rounded-lg border px-3 py-2.5 text-xs text-zinc-950 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#FF8200] focus:border-transparent ${
                        errors.whatsapp_number ? "border-red-300" : "border-zinc-200"
                      }`}
                      placeholder="Contoh: 628123456789 (Diawali 62)"
                    />
                    {errors.whatsapp_number && (
                      <p className="mt-1 text-xs text-red-600 font-semibold">{errors.whatsapp_number.message}</p>
                    )}
                  </div>
                )}

                {/* Kuota Cuti Tahunan (Tampil Jika Role = Employee) */}
                {selectedRole === "Employee" && (
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1">
                      Kuota Cuti Tahunan (Hari)
                    </label>
                    <input
                      {...register("leave_balance")}
                      type="number"
                      className={`w-full rounded-lg border px-3 py-2.5 text-xs text-zinc-950 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#FF8200] focus:border-transparent ${
                        errors.leave_balance ? "border-red-300" : "border-zinc-200"
                      }`}
                      placeholder="Default: 12"
                    />
                    {errors.leave_balance && errors.leave_balance.message && (
                      <p className="mt-1 text-xs text-red-600 font-semibold">{String(errors.leave_balance.message)}</p>
                    )}
                  </div>
                )}
              </div>

              {/* Tombol Aksi */}
              <div className="p-6 bg-zinc-50/50 border-t border-zinc-100 flex gap-3 rounded-b-2xl">
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
                    "Simpan Akun"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
        isLoading={deleteMutation.isPending}
      />
    </DashboardLayout>
  );
}
