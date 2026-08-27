import { http, request } from "./client";
import type { ApiResponse, HealthData } from "@/types/api";

export function fetchHealth(): Promise<HealthData> {
  return request<HealthData>(http.get<ApiResponse<HealthData>>("/health"));
}
