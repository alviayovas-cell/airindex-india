import { http, request } from "./client";
import type { ApiResponse } from "@/types/api";
import type { IndexConfig } from "@/types/models";

export function fetchConfig(): Promise<IndexConfig> {
  return request<IndexConfig>(http.get<ApiResponse<IndexConfig>>("/config"));
}

export function updateWeights(
  weights: Record<string, number>,
): Promise<IndexConfig> {
  return request<IndexConfig>(
    http.put<ApiResponse<IndexConfig>>("/config/weights", { weights }),
  );
}

export interface IndexConfigPatch {
  base_period?: string;
  methodology_version?: string;
  outlier_method?: string;
}

export function updateIndexConfig(
  patch: IndexConfigPatch,
): Promise<IndexConfig> {
  return request<IndexConfig>(
    http.put<ApiResponse<IndexConfig>>("/config/index", patch),
  );
}
