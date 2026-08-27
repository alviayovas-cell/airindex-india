import { http, request } from "./client";
import type { ApiResponse } from "@/types/api";
import type {
  CurrentIndex,
  Frequency,
  IndexHistory,
  Overview,
} from "@/types/models";

export function fetchOverview(): Promise<Overview> {
  return request<Overview>(http.get<ApiResponse<Overview>>("/overview"));
}

export function fetchCurrentIndex(): Promise<CurrentIndex> {
  return request<CurrentIndex>(
    http.get<ApiResponse<CurrentIndex>>("/index/current"),
  );
}

export function fetchIndexHistory(
  frequency: Frequency = "daily",
): Promise<IndexHistory> {
  return request<IndexHistory>(
    http.get<ApiResponse<IndexHistory>>("/index/history", {
      params: { frequency },
    }),
  );
}
