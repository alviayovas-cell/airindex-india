import { http, request } from "./client";
import type { ApiResponse } from "@/types/api";
import type { IndexCalculation, IndexExplain } from "@/types/models";

export function fetchIndexCalculation(date?: string): Promise<IndexCalculation> {
  return request<IndexCalculation>(
    http.get<ApiResponse<IndexCalculation>>("/index/calculation", {
      params: date ? { date } : undefined,
    }),
  );
}

export function fetchIndexExplain(
  date?: string,
  compare?: string,
): Promise<IndexExplain> {
  return request<IndexExplain>(
    http.get<ApiResponse<IndexExplain>>("/index/explain", {
      params: { ...(date ? { date } : {}), ...(compare ? { compare } : {}) },
    }),
  );
}
