import axios, { AxiosError } from "axios";
import type { ApiResponse } from "@/types/api";

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/api";
const TOKEN_KEY = "airindex.token";

export const tokenStore = {
  get(): string | null {
    try {
      return window.localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set(token: string) {
    try {
      window.localStorage.setItem(TOKEN_KEY, token);
    } catch {
      /* ignore */
    }
  },
  clear() {
    try {
      window.localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* ignore */
    }
  },
};

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export const http = axios.create({
  baseURL: BASE_URL,
  timeout: 20_000,
  headers: { "Content-Type": "application/json" },
});

http.interceptors.request.use((config) => {
  const token = tokenStore.get();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

http.interceptors.response.use(
  (res) => res,
  (error: AxiosError<ApiResponse<unknown>>) => {
    if (error.response?.status === 401 && tokenStore.get()) {
      tokenStore.clear();
      if (!window.location.pathname.startsWith("/login")) {
        window.location.assign("/login?expired=1");
      }
    }
    return Promise.reject(error);
  },
);

/** Unwrap the standard envelope, throwing ApiError on failure. */
export async function request<T>(
  promise: Promise<{ data: ApiResponse<T> }>,
): Promise<T> {
  try {
    const { data } = await promise;
    if (!data.success || data.data === null) {
      throw new ApiError(data.message || "Request failed", 200);
    }
    return data.data;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    const ax = err as AxiosError<ApiResponse<unknown>>;
    const message =
      ax.response?.data?.message ||
      (ax.code === "ECONNABORTED"
        ? "The request timed out"
        : ax.message === "Network Error"
          ? "Cannot reach the AIRINDEX API"
          : "Something went wrong");
    throw new ApiError(message, ax.response?.status ?? 0);
  }
}
