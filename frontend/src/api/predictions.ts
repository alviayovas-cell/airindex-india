import { http, request } from "./client";
import type { ApiResponse } from "@/types/api";
import type { FarePrediction, ModelInfo } from "@/types/models";

export function fetchModelInfo(): Promise<ModelInfo> {
  return request<ModelInfo>(
    http.get<ApiResponse<ModelInfo>>("/predictions/status"),
  );
}

export interface FarePredictionQuery {
  route_id: string;
  airline?: string;
  advance_days?: number;
  travel_date?: string;
  fare_type?: string;
}

export function fetchFarePrediction(
  q: FarePredictionQuery,
): Promise<FarePrediction> {
  const params = Object.fromEntries(
    Object.entries(q).filter(([, v]) => v !== undefined && v !== ""),
  );
  return request<FarePrediction>(
    http.get<ApiResponse<FarePrediction>>("/predictions/fare", { params }),
  );
}
