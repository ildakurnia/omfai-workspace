"use client";

import React, { useEffect, useState } from "react";
import Cookies from "js-cookie";
import Link from "next/link";
import { User as UserIcon, Lock, Key, Loader2, CheckCircle2, ShieldAlert, Camera, Calendar, Eye, EyeOff, ArrowLeft } from "lucide-react";
import DashboardLayout from "@/components/dashboard-layout";
import api from "@/lib/api";
import { formatIndonesianDate } from "@/lib/utils";

export default function ProfilePage() {
  const [user, setUser] = useState<any>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [isPasswordSaving, setIsPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);

  // Password visibility states
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showNewPasswordConfirm, setShowNewPasswordConfirm] = useState(false);

  // Avatar upload states
  const [isAvatarUploading, setIsAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  useEffect(() => {
    const userCookie = Cookies.get("omfai_user");
    if (userCookie) {
      try {
        setUser(JSON.parse(userCookie));
      } catch (e) {
        // Abaikan error parsing
      }
    }
  }, []);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validasi ukuran file (maksimal 2MB)
    if (file.size > 2 * 1024 * 1024) {
      setAvatarError("Ukuran foto maksimal adalah 2MB.");
      return;
    }

    setAvatarError(null);
    setIsAvatarUploading(true);

    const formData = new FormData();
    formData.append("avatar", file);

    try {
      const response = await api.post("/upload-avatar", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      const updatedUser = {
        ...user,
        avatar: response.data.data.avatar,
        avatar_url: response.data.data.avatar_url,
      };

      setUser(updatedUser);
      Cookies.set("omfai_user", JSON.stringify(updatedUser), { expires: 7 });
      
      // Segarkan halaman agar avatar terupdate di sidebar/header dropdown
      window.location.reload();
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || "Gagal mengunggah foto profil.";
      setAvatarError(errorMsg);
    } finally {
      setIsAvatarUploading(false);
    }
  };

  const handleChangePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    if (newPassword.length < 8) {
      setPasswordError("Password baru minimal harus 8 karakter.");
      return;
    }

    if (newPassword !== newPasswordConfirm) {
      setPasswordError("Konfirmasi password baru tidak cocok.");
      return;
    }

    setIsPasswordSaving(true);
    try {
      await api.post("/change-password", {
        current_password: currentPassword,
        new_password: newPassword,
        new_password_confirmation: newPasswordConfirm,
      });

      setPasswordSuccess("Password Anda berhasil diubah!");
      setCurrentPassword("");
      setNewPassword("");
      setNewPasswordConfirm("");
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || 
                       err.response?.data?.errors?.current_password?.[0] ||
                       err.response?.data?.errors?.new_password?.[0] ||
                       "Gagal mengubah password. Silakan coba lagi.";
      setPasswordError(errorMsg);
    } finally {
      setIsPasswordSaving(false);
    }
  };

  if (!user) {
    return (
      <DashboardLayout>
        <div className="flex h-64 items-center justify-center">
          <div className="text-zinc-500 animate-pulse text-sm font-medium">Memuat data profil...</div>
        </div>
      </DashboardLayout>
    );
  }

  const roleName = user.roles?.[0] || "User";

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex flex-col gap-2">
          <Link 
            href="/dashboard" 
            className="inline-flex items-center gap-1.5 text-sm font-bold text-zinc-500 hover:text-zinc-800 transition-colors w-fit group"
          >
            <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
            Kembali ke Dashboard
          </Link>
          <div className="flex flex-col mt-1">
            <h2 className="text-xl font-bold text-zinc-950">Profil Pengguna</h2>
            <p className="text-sm text-zinc-400 font-semibold mt-1">
              Lihat informasi personal akun Anda dan perbarui password keamanan di sini.
            </p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-zinc-150 p-6 md:p-8 shadow-sm">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            {/* Sisi Kiri: Informasi Personal */}
            <div className="lg:col-span-1 flex flex-col items-center lg:border-r lg:border-zinc-100 lg:pr-8 pb-8 lg:pb-0">
              <div className="relative mb-5">
                <div className="flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-tr from-orange-400 to-[#FF8200] text-white font-extrabold text-3xl shadow-md overflow-hidden select-none">
                  {isAvatarUploading ? (
                    <Loader2 className="h-8 w-8 animate-spin text-white" />
                  ) : user.avatar_url ? (
                    <img src={user.avatar_url} className="h-full w-full object-cover" alt="Foto Profil" />
                  ) : (
                    user.name.charAt(0).toUpperCase()
                  )}
                </div>
                {/* Floating Camera Button (Sangat Mobile-Friendly) */}
                <label className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center bg-white border border-zinc-200 text-zinc-650 rounded-full shadow-md hover:bg-zinc-50 cursor-pointer transition-all hover:scale-105 active:scale-95" title="Unggah Foto Baru">
                  <Camera className="h-4 w-4 text-zinc-600" />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarChange}
                    disabled={isAvatarUploading}
                    className="hidden"
                  />
                </label>
              </div>
              
              {avatarError && (
                <p className="text-xs text-red-650 font-bold text-center mb-3 max-w-xs">{avatarError}</p>
              )}

              <h3 className="text-lg font-bold text-zinc-950 text-center leading-snug">{user.name}</h3>
              <p className="text-sm font-semibold text-zinc-500 text-center mt-0.5 break-all max-w-full">{user.email}</p>
              
              <span className={`mt-3 text-[10.5px] font-bold px-3 py-1 rounded-full uppercase tracking-wider ${
                roleName === "Admin"
                  ? "bg-red-50 text-red-700 border border-red-100"
                  : roleName === "Owner"
                  ? "bg-purple-50 text-purple-700 border border-purple-100"
                  : "bg-blue-50 text-blue-700 border border-blue-100"
              }`}>
                {roleName}
              </span>

              {user.created_at && (
                <div className="flex items-center gap-1.5 mt-4 text-xs text-zinc-450 font-bold tracking-wide select-none">
                  <Calendar className="h-3.5 w-3.5 text-zinc-400" />
                  <span>Bergabung {formatIndonesianDate(user.created_at, { month: "long", showYear: true })}</span>
                </div>
              )}
            </div>

            {/* Sisi Kanan: Ubah Password */}
            <div className="lg:col-span-2 flex flex-col">
              <div className="border-b border-zinc-100 pb-3 mb-5">
                <h3 className="text-base font-bold text-zinc-950 flex items-center gap-2">
                  <Lock className="h-4.5 w-4.5 text-[#FF8200]" />
                  Pengaturan Keamanan & Ganti Password
                </h3>
                <p className="text-xs text-zinc-400 font-semibold mt-1">
                  Demi keamanan akun Anda, ganti password secara berkala menggunakan kombinasi yang rumit.
                </p>
              </div>

              <form onSubmit={handleChangePasswordSubmit} className="space-y-4 max-w-md">
                {passwordError && (
                  <div className="rounded-lg bg-red-50 p-3 text-xs font-semibold text-red-600 border border-red-100 flex items-center gap-2 flex-wrap">
                    <ShieldAlert className="h-4 w-4 text-red-500 shrink-0" />
                    <span>{passwordError}</span>
                  </div>
                )}

                {passwordSuccess && (
                  <div className="rounded-lg bg-green-50 p-3 text-xs font-semibold text-green-600 border border-green-100 flex items-center gap-2 flex-wrap">
                    <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                    <span>{passwordSuccess}</span>
                  </div>
                )}
                <div>
                  <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5">
                    Password Saat Ini
                  </label>
                  <div className="relative">
                    <input
                      type={showCurrentPassword ? "text" : "password"}
                      required
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="w-full rounded-lg border border-zinc-200 pl-3 pr-10 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-[#FF8200]"
                      placeholder="Masukkan password lama Anda"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 focus:outline-none cursor-pointer"
                    >
                      {showCurrentPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5">
                    Password Baru
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? "text" : "password"}
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full rounded-lg border border-zinc-200 pl-3 pr-10 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-[#FF8200]"
                      placeholder="Minimal 8 karakter"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 focus:outline-none cursor-pointer"
                    >
                      {showNewPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5">
                    Konfirmasi Password Baru
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPasswordConfirm ? "text" : "password"}
                      required
                      value={newPasswordConfirm}
                      onChange={(e) => setNewPasswordConfirm(e.target.value)}
                      className="w-full rounded-lg border border-zinc-200 pl-3 pr-10 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-[#FF8200]"
                      placeholder="Ulangi password baru Anda"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPasswordConfirm(!showNewPasswordConfirm)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 focus:outline-none cursor-pointer"
                    >
                      {showNewPasswordConfirm ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="pt-4 flex justify-end">
                  <button
                    type="submit"
                    disabled={isPasswordSaving}
                    className="flex items-center gap-2 bg-[#FF8200] hover:bg-[#e07200] text-white text-sm font-bold px-5 py-2.5 rounded-lg shadow-sm transition-all cursor-pointer disabled:bg-zinc-300"
                  >
                    {isPasswordSaving ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Menyimpan...
                      </>
                    ) : (
                      <>
                        <Key className="h-4 w-4" />
                        Perbarui Password
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
