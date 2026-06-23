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

const userSchema = z.object({
  name: z.string().min(3, "Nama lengkap minimal harus 3 karakter"),
  email: z.string().min(1, "Email wajib diisi").email("Format email tidak valid"),
  password: z.string().optional(),
  role: z.enum(["Owner", "Admin", "Employee"]),
});

type UserFormValues = z.infer<typeof userSchema>;

export default function UsersPage() {
  const queryClient = useQueryClient();
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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
    formState: { errors },
  } = useForm<UserFormValues>({
    resolver: zodResolver(userSchema),
  });

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

      if (selectedUser) {
        const response = await api.put(`/users/${selectedUser.id}`, data);
        return response.data;
      } else {
        const response = await api.post("/users", data);
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
    reset({ name: "", email: "", password: "", role: "Employee" });
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
    if (confirm("Apakah Anda yakin ingin menghapus akun karyawan ini? Semua data aktivitas terkait juga akan terhapus.")) {
      deleteMutation.mutate(id);
    }
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
                  <th className="p-4">Alamat Email</th>
                  <th className="p-4">Role / Hak Akses</th>
                  <th className="p-4">Tanggal Bergabung</th>
                  <th className="p-4 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 font-medium">
                {users.map((item: any) => (
                  <tr key={item.id} className="text-zinc-700 hover:bg-zinc-50/50">
                    <td className="p-4 text-zinc-900 font-bold text-sm">{item.name}</td>
                    <td className="p-4 text-zinc-650 font-semibold">{item.email}</td>
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
                      {formatIndonesianDate(item.created_at)}
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
          <div className="bg-white rounded-2xl border border-zinc-100 shadow-2xl w-full max-w-sm p-6 overflow-hidden">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3 mb-5">
              <h3 className="text-sm font-bold text-zinc-950">
                {selectedUser ? "Ubah Akun Karyawan" : "Tambah Akun Karyawan Baru"}
              </h3>
              <button onClick={closeModal} className="p-1 text-zinc-400 hover:text-zinc-700 rounded-lg cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>

            {errorMsg && (
              <div className="rounded-lg bg-red-50 p-3 text-xs font-semibold text-red-600 border border-red-100 mb-4">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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

              {/* Tombol Aksi */}
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
    </DashboardLayout>
  );
}
