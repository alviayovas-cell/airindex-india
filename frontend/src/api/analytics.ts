import { http, request } from "./client";
import type { ApiResponse } from "@/types/api";
import type {
  AirlineStat,
  LeadTimeAnalysis,
  RouteHeatmap,
} from "@/types/models";

export function fetchLeadTime(route?: string): Promise<LeadTimeAnalysis> {
  return request<LeadTimeAnalysis>(
    http.get<ApiResponse<LeadTimeAnalysis>>("/analytics/lead-time", {
      params: route ? { route } : undefined,
    }),
  );
}

export function fetchRouteHeatmap(): Promise<RouteHeatmap> {
  return request<RouteHeatmap>(
    http.get<ApiResponse<RouteHeatmap>>("/analytics/routes"),
  );
}

export function fetchAirlineComparison(): Promise<{ airlines: AirlineStat[] }> {
  return request<{ airlines: AirlineStat[] }>(
    http.get<ApiResponse<{ airlines: AirlineStat[] }>>("/analytics/airlines"),
  );
}
