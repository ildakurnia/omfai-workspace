import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function toLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatIndonesianDate(
  dateInput: string | Date | null | undefined,
  options: { month?: "short" | "long"; showYear?: boolean } = {}
): string {
  if (!dateInput) return "-";
  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime())) return "-";

  const { month = "short", showYear = true } = options;

  const shortMonths = [
    "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
    "Jul", "Agu", "Sep", "Okt", "Nov", "Des"
  ];

  const longMonths = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
  ];

  const day = date.getDate();
  const monthList = month === "long" ? longMonths : shortMonths;
  const monthStr = monthList[date.getMonth()];
  const year = date.getFullYear();

  if (showYear) {
    return `${day} ${monthStr} ${year}`;
  }
  return `${day} ${monthStr}`;
}

export function getDateRange(rangeType: string): { startDate: string; endDate: string } {
  const today = new Date();
  const endDate = toLocalDateString(today);
  let startDate = "";

  if (rangeType === "today") {
    startDate = endDate;
  } else if (rangeType === "week") {
    const currentDay = today.getDay(); // 0 is Sunday, 1 is Monday
    const distanceToMonday = currentDay === 0 ? 6 : currentDay - 1;
    const monday = new Date(today);
    monday.setDate(today.getDate() - distanceToMonday);
    startDate = toLocalDateString(monday);
  } else if (rangeType === "month") {
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    startDate = toLocalDateString(firstDay);
  }

  return { startDate, endDate };
}

export function calculateWorkingMinutes(startDate: Date, endDate: Date, holidayDates?: Set<string>): number {
  if (endDate.getTime() <= startDate.getTime()) {
    return 0;
  }
  
  let totalMinutes = 0;
  let current = new Date(startDate.getTime());
  
  while (true) {
    const year = current.getFullYear();
    const month = current.getMonth();
    const date = current.getDate();
    const dayOfWeek = current.getDay(); // 0: Minggu, 1: Senin, ..., 6: Sabtu
    
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(date).padStart(2, '0')}`;
    
    // Lewati hari Minggu (0) dan tanggal merah (holidayDates)
    if (dayOfWeek !== 0 && (!holidayDates || !holidayDates.has(dateStr))) {
      const isSaturday = dayOfWeek === 6;
      const workStartHour = 8;
      const workEndHour = isSaturday ? 12 : 17; // Sabtu pulang jam 12, Senin-Jumat pulang jam 17
      
      const workStart = new Date(year, month, date, workStartHour, 0, 0, 0);
      const workEnd = new Date(year, month, date, workEndHour, 0, 0, 0);
      
      // Tentukan waktu mulai tugas hari ini
      let taskStart = new Date(current.getTime());
      if (taskStart.getTime() < workStart.getTime()) {
        taskStart = workStart; // Mulai hitung dari jam masuk kerja jika tugas dibuat sebelumnya
      }
      
      // Tentukan waktu selesai tugas hari ini
      let taskEnd = new Date(year, month, date, 23, 59, 59, 999);
      if (current.toDateString() === endDate.toDateString()) {
        taskEnd = endDate; // Jika hari terakhir pengerjaan
      }
      if (taskEnd.getTime() > workEnd.getTime()) {
        taskEnd = workEnd; // Batasi hitungan sampai jam pulang kerja
      }
      
      // Tambahkan akumulasi menit jika taskStart masih sebelum taskEnd
      if (taskStart.getTime() < taskEnd.getTime()) {
        const diffMs = taskEnd.getTime() - taskStart.getTime();
        totalMinutes += Math.floor(diffMs / (1000 * 60));
      }
    }
    
    // Keluar jika sudah mencapai hari terakhir
    if (current.toDateString() === endDate.toDateString()) {
      break;
    }
    
    // Pindah ke hari berikutnya jam 00:00
    current = new Date(year, month, date + 1, 0, 0, 0, 0);
  }
  
  return totalMinutes;
}

export function formatDuration(createdAtStr: string, completedAtStr?: string | null, holidayDates?: Set<string>): string {
  if (!createdAtStr) return "-";
  
  const startDate = new Date(createdAtStr);
  const endDate = completedAtStr ? new Date(completedAtStr) : new Date();
  
  const totalMinutes = calculateWorkingMinutes(startDate, endDate, holidayDates);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  
  if (hours > 0) {
    return `${hours} jam ${minutes} menit`;
  }
  return `${minutes} menit`;
}

export function formatActiveDuration(
  createdAtStr: string, 
  completedAtStr?: string | null, 
  currentStatus?: string, 
  logs?: Array<{ status: string; createdAt?: string; created_at?: string }> | null,
  holidayDates?: Set<string>
): string {
  if (!createdAtStr) return "-";
  
  // Jika tidak ada logs, gunakan fallback formatDuration standar.
  if (!logs || logs.length === 0) {
    return formatDuration(createdAtStr, completedAtStr, holidayDates);
  }
  
  // Sort logs secara ascending berdasarkan waktu dibuatnya
  const sortedLogs = [...logs].sort((a, b) => {
    const timeA = new Date(a.createdAt || a.created_at || 0).getTime();
    const timeB = new Date(b.createdAt || b.created_at || 0).getTime();
    return timeA - timeB;
  });
  
  let totalMinutes = 0;
  
  for (let i = 0; i < sortedLogs.length; i++) {
    const log = sortedLogs[i];
    const logStatus = log.status;
    const startTime = new Date(log.createdAt || log.created_at || 0);
    
    // Cari waktu selesai untuk interval ini
    let endTime: Date;
    if (i < sortedLogs.length - 1) {
      // End time adalah awal log berikutnya
      const nextLog = sortedLogs[i + 1];
      endTime = new Date(nextLog.createdAt || nextLog.created_at || 0);
    } else {
      // End time untuk log terakhir:
      // Jika status log terakhir/saat ini adalah done, gunakan completedAtStr (atau timestamp log)
      // Jika statusnya on_hold, maka durasi aktif terhenti pada saat status diubah ke on_hold (yaitu startTime)
      // Jika statusnya in_progress, maka durasi aktif berjalan sampai sekarang (new Date())
      if (logStatus === "done") {
        endTime = completedAtStr ? new Date(completedAtStr) : startTime;
      } else if (logStatus === "on_hold") {
        endTime = startTime; // Waktu aktif tidak bertambah selama on_hold
      } else {
        endTime = new Date(); // Masih berjalan
      }
    }
    
    // Hanya hitung durasi kerja jika status pada interval ini adalah 'in_progress'
    if (logStatus === "in_progress" && endTime.getTime() > startTime.getTime()) {
      totalMinutes += calculateWorkingMinutes(startTime, endTime, holidayDates);
    }
  }
  
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  
  if (hours > 0) {
    return `${hours} jam ${minutes} menit`;
  }
  return `${minutes} menit`;
}

export function getCategoryStyles(name: string): React.CSSProperties {
  if (!name) {
    return {
      backgroundColor: "rgb(244, 244, 245)", // bg-zinc-100
      color: "rgb(63, 63, 70)",   // text-zinc-700
      borderColor: "rgb(228, 228, 231)" // border-zinc-200
    };
  }

  const normalized = name.toLowerCase();

  // Curated presets for common categories
  if (normalized.includes("development")) {
    return {
      backgroundColor: "rgb(239, 246, 255)", // bg-blue-50
      color: "rgb(29, 78, 216)",  // text-blue-700
      borderColor: "rgb(191, 219, 254)" // border-blue-200
    };
  }
  if (normalized.includes("meeting")) {
    return {
      backgroundColor: "rgb(250, 245, 255)", // bg-purple-50
      color: "rgb(109, 40, 217)",  // text-purple-700
      borderColor: "rgb(233, 213, 252)" // border-purple-200
    };
  }
  if (normalized.includes("design") || normalized.includes("ui") || normalized.includes("ux")) {
    return {
      backgroundColor: "rgb(253, 242, 248)", // bg-pink-50
      color: "rgb(190, 24, 93)",   // text-pink-700
      borderColor: "rgb(251, 207, 232)" // border-pink-200
    };
  }
  if (normalized.includes("analyst") || normalized.includes("business") || normalized.includes("ba")) {
    return {
      backgroundColor: "rgb(236, 253, 245)", // bg-emerald-50
      color: "rgb(4, 120, 87)",    // text-emerald-700
      borderColor: "rgb(167, 243, 208)" // border-emerald-200
    };
  }

  // Dynamic generator fallback
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  const saturation = 75;

  return {
    backgroundColor: `hsl(${hue}, ${saturation}%, 94%)`,
    color: `hsl(${hue}, ${saturation}%, 38%)`,
    borderColor: `hsl(${hue}, ${saturation}%, 88%)`
  };
}
