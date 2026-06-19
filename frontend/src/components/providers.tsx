"use client";

import React, { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

interface ProvidersProps {
  children: React.ReactNode;
}

export default function Providers({ children }: ProvidersProps) {
  // Menginisialisasi QueryClient di dalam useState agar tidak di-instansiasi ulang pada setiap render
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 60 * 5, // Data dianggap segar selama 5 menit
            refetchOnWindowFocus: false, // Menghindari refetch berlebihan saat berpindah tab
            retry: 1, // Mencoba memanggil ulang API maksimal 1 kali jika gagal
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
