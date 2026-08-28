import axios from "axios";
import Cookies from "js-cookie";

// Deteksi URL API secara dinamis berdasarkan lingkungan (lokal vs produksi)
let apiBaseURL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

if (typeof window !== "undefined") {
  const hostname = window.location.hostname;
  if (process.env.NEXT_PUBLIC_API_URL) {
    apiBaseURL = process.env.NEXT_PUBLIC_API_URL;
  } else if (hostname !== "localhost" && hostname !== "127.0.0.1") {
    // Saat di-deploy ke produksi (domain online), arahkan ke domain aktif + /api
    apiBaseURL = window.location.origin + "/api";
  }
}

const api = axios.create({
  baseURL: apiBaseURL,
  headers: {
    "Content-Type": "application/json", 
    Accept: "application/json",
  },
});

// Axios Request Interceptor untuk menyisipkan token secara otomatis
api.interceptors.request.use(
  (config) => {
    const token = Cookies.get("omfai_token");
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Axios Response Interceptor untuk menangani unauthorized error (401) secara terpusat
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Hapus token yang tidak valid secara menyeluruh
      Cookies.remove("omfai_token", { path: "/" });
      Cookies.remove("omfai_user", { path: "/" });
      if (typeof document !== "undefined") {
        document.cookie = "omfai_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
        document.cookie = "omfai_user=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
      }
      if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

export default api;
