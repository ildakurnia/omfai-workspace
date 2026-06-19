"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { FolderTree, Plus, X, Edit2, Loader2, CheckCircle2, XCircle } from "lucide-react";
import DashboardLayout from "@/components/dashboard-layout";
import api from "@/lib/api";
import { formatIndonesianDate } from "@/lib/utils";

const categorySchema = z.object({
  name: z.string().min(3, "Nama kategori minimal harus 3 karakter"),
  is_active: z.boolean(),
});

type CategoryFormValues = z.infer<typeof categorySchema>;

export default function CategoriesPage() {
  const queryClient = useQueryClient();
  const [selectedCategory, setSelectedCategory] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors },
  } = useForm<CategoryFormValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: "",
      is_active: true,
    },
  });

  // Query Master Kategori
  const { data: categories, isLoading } = useQuery({
    queryKey: ["allCategories"],
    queryFn: async () => {
      const response = await api.get("/categories");
      return response.data.data;
    },
  });

  // Mutation: Simpan / Edit Kategori
  const saveMutation = useMutation({
    mutationFn: async (data: CategoryFormValues) => {
      if (selectedCategory) {
        const response = await api.put(`/categories/${selectedCategory.id}`, data);
        return response.data;
      } else {
        const response = await api.post("/categories", data);
        return response.data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["allCategories"] });
      queryClient.invalidateQueries({ queryKey: ["activeCategories"] });
      queryClient.invalidateQueries({ queryKey: ["dashboardSummary"] });
      closeModal();
    },
    onError: (err: any) => {
      setErrorMsg(err.response?.data?.message || "Gagal menyimpan kategori.");
    },
  });

  const openAddModal = () => {
    setSelectedCategory(null);
    reset({ name: "", is_active: true });
    setIsModalOpen(true);
    setErrorMsg(null);
  };

  const openEditModal = (category: any) => {
    setSelectedCategory(category);
    reset({
      name: category.name,
      is_active: category.is_active,
    });
    setIsModalOpen(true);
    setErrorMsg(null);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedCategory(null);
    setErrorMsg(null);
  };

  const onSubmit = (values: CategoryFormValues) => {
    saveMutation.mutate(values);
  };

  // Toggle Aktif Kategori secara langsung
  const handleToggleActive = (category: any) => {
    saveMutation.mutate({
      name: category.name,
      is_active: !category.is_active,
    });
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-zinc-950">Master Kategori Aktivitas</h2>
          <p className="text-xs text-zinc-400 font-medium mt-1">Kelola data master pengelompokan aktivitas kerja karyawan.</p>
        </div>
        <button
          onClick={openAddModal}
          className="flex items-center gap-2 bg-[#FF8200] hover:bg-[#e07200] text-white text-sm font-bold px-4 py-2.5 rounded-lg shadow-sm transition-all cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          Tambah Kategori
        </button>
      </div>

      {/* Tabel Kategori */}
      <div className="bg-white rounded-2xl border border-zinc-150 shadow-sm overflow-hidden max-w-4xl">
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="space-y-3 p-6 animate-pulse">
              <div className="h-10 bg-zinc-100 rounded" />
              <div className="h-10 bg-zinc-100 rounded" />
            </div>
          ) : !categories || categories.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-zinc-400 py-16">
              <FolderTree className="h-12 w-12 mb-2 text-zinc-200" />
              <span className="text-sm">Belum ada kategori yang dibuat.</span>
            </div>
          ) : (
            <table className="min-w-[600px] md:min-w-full divide-y divide-zinc-150 text-left text-xs">
              <thead className="bg-zinc-50/70">
                <tr className="text-zinc-400 uppercase font-bold tracking-wider">
                  <th className="p-4">Nama Kategori</th>
                  <th className="p-4">Tanggal Dibuat</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 font-medium">
                {categories.map((cat: any) => (
                  <tr key={cat.id} className="text-zinc-700 hover:bg-zinc-50/50">
                    <td className="p-4 text-zinc-900 font-semibold text-sm">{cat.name}</td>
                    <td className="p-4 text-zinc-400">
                      {formatIndonesianDate(cat.created_at)}
                    </td>
                    <td className="p-4">
                      {cat.is_active ? (
                        <span className="inline-flex items-center gap-1 bg-green-50 text-green-700 px-2.5 py-1 rounded-full font-bold uppercase text-[9px] border border-green-100">
                          <CheckCircle2 className="h-3 w-3 text-green-500" /> Aktif
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 bg-red-50 text-red-700 px-2.5 py-1 rounded-full font-bold uppercase text-[9px] border border-red-100">
                          <XCircle className="h-3 w-3 text-red-400" /> Nonaktif
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex justify-center gap-3">
                        <button
                          onClick={() => openEditModal(cat)}
                          className="p-1.5 text-zinc-500 hover:text-zinc-950 hover:bg-zinc-100 rounded-md transition-all cursor-pointer"
                          title="Ubah Kategori"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleToggleActive(cat)}
                          className={`text-xs font-bold px-3 py-1 rounded-lg border transition-all cursor-pointer ${
                            cat.is_active
                              ? "bg-red-50 text-red-600 hover:bg-red-100 border-red-100"
                              : "bg-green-50 text-green-600 hover:bg-green-100 border-green-150"
                          }`}
                        >
                          {cat.is_active ? "Nonaktifkan" : "Aktifkan"}
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

      {/* Modal Form Kategori */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/40 backdrop-blur-sm px-4">
          <div className="bg-white rounded-2xl border border-zinc-100 shadow-2xl w-full max-w-sm p-6 overflow-hidden">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3 mb-5">
              <h3 className="text-sm font-bold text-zinc-950">
                {selectedCategory ? "Ubah Kategori" : "Tambah Kategori Baru"}
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
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1">
                  Nama Kategori
                </label>
                <input
                  {...register("name")}
                  type="text"
                  className={`w-full rounded-lg border px-3 py-2.5 text-xs text-zinc-950 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#FF8200] focus:border-transparent ${
                    errors.name ? "border-red-300" : "border-zinc-200"
                  }`}
                  placeholder="Contoh: Development, Meeting..."
                />
                {errors.name && (
                  <p className="mt-1 text-xs text-red-600 font-semibold">{errors.name.message}</p>
                )}
              </div>

              <div className="flex items-center gap-2 py-2">
                <input
                  {...register("is_active")}
                  type="checkbox"
                  id="is_active"
                  className="rounded border-zinc-350 text-[#FF8200] focus:ring-[#FF8200] h-4 w-4"
                />
                <label htmlFor="is_active" className="text-xs font-bold text-zinc-700 cursor-pointer">
                  Kategori aktif dan dapat dipilih oleh Karyawan
                </label>
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
                  disabled={saveMutation.isPending}
                  className="flex-1 flex justify-center items-center bg-[#FF8200] hover:bg-[#e07200] text-white text-xs font-bold py-2.5 rounded-lg transition-all cursor-pointer"
                >
                  {saveMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Menyimpan...
                    </>
                  ) : (
                    "Simpan Kategori"
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
