"use client";

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import axios from "axios";
import Cookies from "js-cookie";
import { useRouter } from "next/navigation";
import { Loader2, AlertCircle, Eye, EyeOff } from "lucide-react";
import api from "@/lib/api";

const loginSchema = z.object({
  email: z.string().min(1, "Email wajib diisi").email("Format email tidak valid"),
  password: z.string().min(8, "Password minimal harus 8 karakter"),
});

type LoginFormValues = z.infer<typeof loginSchema>;  

export default function LoginPage() {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormValues) => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await api.post("/login", data);
      const { access_token, user } = response.data.data;

      // Simpan token di cookie (tahan 1 hari, secure: true hanya di production agar bisa diuji di http)
      const isSecure = process.env.NODE_ENV === "production";
      Cookies.set("omfai_token", access_token, { expires: 1, secure: isSecure, sameSite: "strict" });
      
      // Simpan detail user di cookie
      Cookies.set("omfai_user", JSON.stringify(user), { expires: 1, secure: isSecure, sameSite: "strict" });

      router.push("/dashboard");
      router.refresh();
    } catch (error: any) {
      if (axios.isAxiosError(error) && error.response) {
        setErrorMessage(
          error.response.data.message || 
          error.response.data.errors?.email?.[0] || 
          "Terjadi kesalahan saat masuk. Silakan coba lagi."
        );
      } else {
        setErrorMessage("Tidak dapat terhubung. Silakan periksa koneksi internet Anda dan coba lagi nanti.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div suppressHydrationWarning className="grid grid-cols-1 md:grid-cols-2 h-screen w-full bg-white font-sans md:overflow-hidden overflow-y-auto">
      
      {/* Sisi Kiri: Hero & Value Proposition */}
      <div 
        className="hidden md:flex flex-col justify-center items-center py-6 md:py-8 lg:py-10 px-8 md:px-10 lg:px-14 relative overflow-hidden"
        style={{ 
          background: "linear-gradient(135deg, #FFF7ED 0%, #FEF3E2 100%)",
          borderRight: "1px solid #E5E7EB"
        }}
      >
        {/* Soft Blurry Glowing Auras */}
        <div className="absolute top-[-10%] left-[-10%] w-[320px] h-[320px] rounded-full bg-orange-100/40 blur-3xl pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[320px] h-[320px] rounded-full bg-[#FF8200]/5 blur-3xl pointer-events-none" />
        
        {/* Subtle Dot Pattern Overlay */}
        <div 
          className="absolute inset-0 opacity-[0.04] pointer-events-none" 
          style={{ 
            backgroundImage: `radial-gradient(#FF8200 1.5px, transparent 1.5px)`, 
            backgroundSize: '20px 20px' 
          }} 
        />
        
        <div className="relative z-10 flex flex-col items-center max-w-sm w-full text-center">
          
          {/* Ilustrasi berbentuk Mockup Browser agar terlihat seperti dashboard nyata, bukan tempelan */}
          <div className="bg-white rounded-xl shadow-[0_16px_36px_rgba(255,130,0,0.06)] border border-orange-100/30 overflow-hidden mb-5 max-w-[320px] w-full transform transition-all duration-500 hover:scale-[1.02] mx-auto">
            {/* Header Mockup Window */}
            <div className="bg-zinc-50 px-3.5 py-2 flex items-center gap-1.5 border-b border-zinc-100 select-none">
              <span className="w-2.5 h-2.5 rounded-full bg-[#FF5F56]" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#FFBD2E]" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#27C93F]" />
              <div className="h-3.5 bg-zinc-200/50 rounded-md w-32 ml-3" />
            </div>
            {/* Gambar Dashboard */}
            <img 
              src="/workspace-dashboard.png" 
              className="w-full object-contain select-none" 
              alt="Workspace Illustration" 
            />
          </div>
          
          {/* Headline Lebih Kuat & Lebih Besar */}
          <h2 className="text-2xl lg:text-3xl font-extrabold text-zinc-900 tracking-tight leading-tight mb-2.5">
            One Workspace for<br />Your Daily Work
          </h2>
          
          {/* Deskripsi Menjelaskan Sistem */}
          <p className="text-sm text-zinc-500 font-medium leading-relaxed mb-5 max-w-sm">
            Manage activities, attendance, and work progress in one integrated platform.
          </p>
          
          {/* Feature List dengan Checklist Professional */}
          <div className="w-full flex flex-col items-center">
            <div className="space-y-2.5 flex flex-col items-start">
              <div className="flex items-center gap-2.5 text-sm font-bold text-zinc-700">
                <span className="text-emerald-600 text-base">✓</span>
                <span>Daily Activities</span>
              </div>
              <div className="flex items-center gap-2.5 text-sm font-bold text-zinc-700">
                <span className="text-emerald-600 text-base">✓</span>
                <span>Attendance Management</span>
              </div>
              <div className="flex items-center gap-2.5 text-sm font-bold text-zinc-700">
                <span className="text-emerald-600 text-base">✓</span>
                <span>Work Progress Monitoring</span>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Sisi Kanan: Form Login (Latar Belakang Putih Bersih #FFFFFF, Seimbang 50%) */}
      <div className="flex flex-col justify-center items-center py-6 md:py-8 lg:py-10 px-8 md:px-10 lg:px-14 bg-white w-full h-full">
        
        {/* Container Form (Lebar dibatasi 400px agar terlihat Premium) */}
        <div className="w-full max-w-[400px] space-y-6">
          
          {/* Header Branding (Logo disatukan di atas judul form login) */}
          <div className="flex flex-col items-center text-center">
            <img 
              src="/omfai-logo-v2.png" 
              className="h-16 w-16 rounded-full mb-3 shadow-sm shrink-0" 
              alt="OMFAI Logo" 
            />
            <h1 className="text-2xl font-extrabold text-zinc-900 tracking-tight mb-1">OMFAI Workspace</h1>
            <p className="text-xs text-zinc-400 font-semibold leading-relaxed max-w-[300px]">Sistem Pemantauan Aktivitas Karyawan Terpusat</p>
          </div>

          {/* Login Form */}
          <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
            {errorMessage && (
              <div className="rounded-xl bg-red-50 p-3.5 text-xs font-semibold text-red-600 border border-red-100 flex items-start gap-2 mb-2">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-500" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Email Input */}
            <div className="space-y-2">
              <label htmlFor="email" className="block text-xs font-semibold text-zinc-600">
                Alamat Email
              </label>
              <input
                {...register("email")}
                id="email"
                type="email"
                suppressHydrationWarning
                className={`block w-full rounded-xl border bg-zinc-50/50 px-3.5 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 transition-all focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/10 focus:border-[#FF8200] ${
                  errors.email ? "border-red-300 focus:ring-red-500/20" : "border-zinc-200"
                }`}
                placeholder="nama@omfai.com"  
              />
              {errors.email && (
                <p className="mt-1 text-xs text-red-600 font-semibold">{errors.email.message}</p>
              )}
            </div>

            {/* Password Input */}
            <div className="space-y-2">
              <label htmlFor="password" className="block text-xs font-semibold text-zinc-600">
                Kata Sandi
              </label>
              <div className="relative">
                <input
                  {...register("password")}
                  id="password"
                  type={showPassword ? "text" : "password"}
                  suppressHydrationWarning
                  className={`block w-full rounded-xl border bg-zinc-50/50 pl-3.5 pr-10 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 transition-all focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/10 focus:border-[#FF8200] ${
                    errors.password ? "border-red-300 focus:ring-red-500/20" : "border-zinc-200"
                  }`}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 transition-colors focus:outline-none cursor-pointer"
                  title={showPassword ? "Sembunyikan Kata Sandi" : "Tampilkan Kata Sandi"}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1 text-xs text-red-600 font-semibold">{errors.password.message}</p>
              )}
            </div>

            {/* Remember Me Checkbox */}
            <div className="flex items-center pt-1">
              <input
                id="remember_me"
                name="remember_me"
                type="checkbox"
                className="h-4 w-4 rounded border-zinc-300 text-[#FF8200] focus:ring-[#FF8200] cursor-pointer"
              />
              <label htmlFor="remember_me" className="ml-2 block text-xs text-zinc-500 font-bold cursor-pointer select-none">
                Ingat Saya
              </label>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="flex w-full justify-center items-center rounded-xl bg-[#FF8200] hover:bg-[#e07200] active:scale-[0.98] px-4 py-3 text-sm font-bold text-white shadow-md shadow-orange-500/10 hover:shadow-lg hover:shadow-orange-500/20 transition-all cursor-pointer mt-3"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Menghubungkan...
                </>
              ) : (
                "Masuk ke Workspace"
              )}
            </button>
          </form>

          {/* Footer (Pindah lebih dekat ke form login di bawah) */}
          <div suppressHydrationWarning className="text-center text-[9px] font-bold text-zinc-400 uppercase tracking-wider pt-4 border-t border-zinc-100/50">
            © {new Date().getFullYear()} OMFAI Workspace
          </div>

        </div>
      </div>
    </div>
  );
}
