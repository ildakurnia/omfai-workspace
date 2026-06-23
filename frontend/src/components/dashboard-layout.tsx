"use client";

import React, { useEffect, useState } from "react";
import Cookies from "js-cookie";
import { useRouter, usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ClipboardList,
  FolderTree,
  Users,
  FileBarChart2,
  LogOut,
  Menu,
  X,
  User as UserIcon,
  ChevronDown,
  Calendar,
  Key,
  Loader2,
} from "lucide-react";
import api from "@/lib/api";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<any>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [desktopSidebarCollapsed, setDesktopSidebarCollapsed] = useState(false);
  
  useEffect(() => {
    const collapsed = localStorage.getItem("desktop_sidebar_collapsed") === "true";
    setDesktopSidebarCollapsed(collapsed);
  }, []);

  const toggleDesktopSidebar = () => {
    const nextState = !desktopSidebarCollapsed;
    setDesktopSidebarCollapsed(nextState);
    localStorage.setItem("desktop_sidebar_collapsed", String(nextState));
  };

  useEffect(() => {
    const userCookie = Cookies.get("omfai_user");
    if (userCookie) {
      try {
        setUser(JSON.parse(userCookie));
      } catch (e) {
        // Abaikan error parsing
      }
    }

    // Sinkronisasi data user dari backend untuk mendapatkan informasi terbaru (seperti avatar_url)
    api.get("/me")
      .then((res) => {
        if (res.data?.data) {
          const latestUser = res.data.data;
          setUser(latestUser);
          Cookies.set("omfai_user", JSON.stringify(latestUser), { expires: 7 });
        }
      })
      .catch((err) => {
        console.error("Gagal sinkronisasi data user:", err);
      });
  }, []);

  const roles = user?.roles || [];
  const isAdmin = roles.includes("Admin");
  const isOwner = roles.includes("Owner");
  const isEmployee = roles.includes("Employee");

  const handleLogout = async () => {
    try {
      // Panggil logout API di Laravel
      await api.post("/logout");
    } catch (e) {
      // Abaikan error koneksi saat logout, tetap hapus cookie lokal
    } finally {
      // Hapus token dan data user dari browser
      Cookies.remove("omfai_token");
      Cookies.remove("omfai_user");
      router.push("/login");
      router.refresh();
    }
  };

  // Navigasi menu dinamis berdasarkan role user
  const navigationItems = [
    {
      name: "Dashboard",
      href: "/dashboard",
      icon: LayoutDashboard,
      show: true, // Semua role bisa melihat dashboard
    },
    {
      name: "Aktivitas Pekerjaan",
      href: "/activities",
      icon: ClipboardList,
      show: true, // Semua role bisa melihat / mengelola list aktivitas (sesuai filter)
    },
    {
      name: "Kelola Kategori",
      href: "/categories",
      icon: FolderTree,
      show: isAdmin, // Hidden for presentation (originally: isAdmin)
    },
    {
      name: "Kelola Karyawan",
      href: "/users",
      icon: Users,
      show: isAdmin, // Hanya Admin
    },
    {
      name: "Laporan Aktivitas",
      href: "/reports",
      icon: FileBarChart2,
      show: isOwner || isAdmin, // Owner dan Admin
    },
    {
      name: "Kalender Libur",
      href: "/holidays",
      icon: Calendar,
      show: isAdmin, // Hidden for presentation (originally: isAdmin)
    },
  ];

  const activeItem = navigationItems.find(
    (item) => pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href + "/"))
  );

  return (
    <div className="flex h-screen bg-zinc-50 overflow-hidden font-sans">
      {/* 1. Sidebar untuk Layar Desktop */}
      <aside className={`hidden md:flex md:flex-col bg-white border-r border-zinc-200 transition-all duration-300 ${desktopSidebarCollapsed ? "w-20" : "w-64"}`}>
        <div className="flex flex-col h-full min-h-0">
          {/* Logo Brand Header */}
          <div className={`flex items-center gap-3 py-5 border-b border-zinc-100 transition-all duration-300 ${desktopSidebarCollapsed ? "justify-center px-4" : "px-6"}`}>
            <img 
              src="/omfai-logo-v2.png" 
              className="h-11 w-11 rounded-full shrink-0" 
              style={{ imageRendering: "-webkit-optimize-contrast" }}
              alt="OMFAI Logo" 
            />
            {!desktopSidebarCollapsed && (
              <div className="transition-all duration-300">
                <h1 className="text-sm font-bold text-zinc-900 leading-none">OMFAI</h1>
                <span className="text-[10px] text-zinc-400 font-bold tracking-wider uppercase">Workspace</span>
              </div>
            )}
          </div>

          {/* Menu Link Navigasi */}
          <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
            {navigationItems
              .filter((item) => item.show)
              .map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                  <a
                    key={item.name}
                    href={item.href}
                    title={desktopSidebarCollapsed ? item.name : undefined}
                    className={`flex items-center gap-3 py-2.5 text-sm font-medium rounded-lg transition-all ${
                      desktopSidebarCollapsed 
                        ? "justify-center px-0 h-10 w-10 mx-auto" 
                        : "px-3"
                    } ${
                      isActive
                        ? "bg-orange-50/50 text-[#FF8200]"
                        : "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100/60"
                    }`}
                  >
                    <item.icon className={`h-4 w-4 shrink-0 ${isActive ? "text-[#FF8200]" : "text-zinc-400"}`} />
                    {!desktopSidebarCollapsed && <span className="truncate">{item.name}</span>}
                  </a>
                );
              })}
          </nav>


        </div>
      </aside>

      {/* 2. Sidebar Mobile View (Slide-over) */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 z-50 flex md:hidden bg-zinc-900/40 backdrop-blur-sm"
          onClick={() => setMobileMenuOpen(false)}
        >
          <div 
            className="relative flex w-full max-w-xs flex-col bg-white h-full shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header Mobile Menu dengan Tombol Tutup */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-100">
              <div className="flex items-center gap-3">
                <img 
                  src="/omfai-logo-v2.png" 
                  className="h-11 w-11 rounded-full shrink-0" 
                  style={{ imageRendering: "-webkit-optimize-contrast" }}
                  alt="OMFAI Logo" 
                />
                <div>
                  <h1 className="text-sm font-bold text-zinc-900 leading-none">OMFAI</h1>
                  <span className="text-[10px] text-zinc-400 font-bold tracking-wider uppercase">Workspace</span>
                </div>
              </div>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition-all focus:outline-none"
                title="Tutup Menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
              {navigationItems
                .filter((item) => item.show)
                .map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <a
                      key={item.name}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-all ${
                        isActive
                          ? "bg-orange-50/50 text-[#FF8200]"
                          : "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100"
                      }`}
                    >
                      <item.icon className="h-4 w-4" />
                      {item.name}
                    </a>
                  );
                })}
            </nav>


          </div>
        </div>
      )}

      {/* 3. Area Konten Utama */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header Atas */}
        <header className="flex h-16 bg-white border-b border-zinc-200 justify-between items-center px-4 md:px-8 shrink-0 z-10">
          <div className="flex items-center gap-4">
            {/* Tombol Menu untuk Desktop & Mobile */}
            <button
              onClick={() => {
                if (window.innerWidth >= 768) {
                  toggleDesktopSidebar();
                } else {
                  setMobileMenuOpen(true);
                }
              }}
              className="p-2 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100/60 rounded-lg transition-all focus:outline-none cursor-pointer"
              title={desktopSidebarCollapsed ? "Buka Sidebar" : "Tutup Sidebar"}
            >
              <Menu className="h-6 w-6" />
            </button>

            {/* Judul Halaman Dinamis */}
            <div className="hidden sm:block">
              <span className="text-xs font-bold text-zinc-400 tracking-wider uppercase">
                {activeItem && activeItem.href === "/dashboard"
                  ? "DASHBOARD"
                  : `DASHBOARD / ${activeItem ? activeItem.name : pathname.replace("/", "")}`}
              </span>
            </div>
          </div>

          {/* Profil User Dropdown */}
          <div className="relative">
            <button
              onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
              className="flex items-center gap-2 text-zinc-700 hover:text-zinc-900 focus:outline-none p-1.5 rounded-lg hover:bg-zinc-100/60 transition-all cursor-pointer"
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-orange-100 text-[#FF8200] font-bold text-xs overflow-hidden shrink-0">
                {user?.avatar_url ? (
                  <img src={user.avatar_url} className="h-full w-full object-cover" alt="Avatar" />
                ) : user?.name ? (
                  user.name.charAt(0).toUpperCase()
                ) : (
                  <UserIcon className="h-3.5 w-3.5" />
                )}
              </div>
              <span className="text-sm font-medium hidden sm:inline">{user?.name || "Memuat..."}</span>
              <ChevronDown className="h-3.5 w-3.5 text-zinc-400 hidden sm:inline" />
            </button>

            {profileDropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-20"
                  onClick={() => setProfileDropdownOpen(false)}
                ></div>
                <div className="absolute right-0 mt-2 w-48 rounded-lg bg-white border border-zinc-200 py-1 shadow-lg z-30">
                  <div className="px-4 py-2 border-b border-zinc-100">
                    <p className="text-xs font-bold text-zinc-900 leading-none">{user?.name}</p>
                    <span className="text-[10px] text-zinc-400 font-bold tracking-wider uppercase block mt-1">
                      {user?.roles?.[0] || "User"}
                    </span>
                  </div>
                  <a
                    href="/profile"
                    onClick={() => setProfileDropdownOpen(false)}
                    className="flex w-full items-center gap-2 px-4 py-2 text-xs font-bold text-zinc-700 hover:bg-zinc-50 text-left transition-all cursor-pointer border-b border-zinc-50"
                  >
                    <UserIcon className="h-3 w-3 text-zinc-400" />
                    Lihat Profil
                  </a>
                  <button
                    onClick={handleLogout}
                    className="flex w-full items-center gap-2 px-4 py-2 text-xs font-bold text-red-600 hover:bg-red-50 text-left transition-all cursor-pointer"
                  >
                    <LogOut className="h-3 w-3" />
                    Keluar Aplikasi
                  </button>
                </div>
              </>
            )}
          </div>
        </header>

        {/* Content Body Container */}
        <main className="flex-1 overflow-y-auto px-4 py-6 md:px-8 md:py-8">
          <div className="max-w-7xl mx-auto space-y-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
