import { http, request } from "./client";
import type { ApiResponse } from "@/types/api";
import type {
  AirlineStat,
  FareSpikesResponse,
  FestivalAnalysis,
  LeadTimeAnalysis,
  RouteHeatmap,
  VolatilityResponse,
} from "@/types/models";

export interface LeadTimeQuery {
  route?: string;
  airline?: string;
  fare_type?: string;
  date_from?: string;
  date_to?: string;
}

export function fetchLeadTime(
  q: LeadTimeQuery = {},
): Promise<LeadTimeAnalysis> {
  const params = Object.fromEntries(
    Object.entries(q).filter(([, v]) => v),
  );
  return request<LeadTimeAnalysis>(
    http.get<ApiResponse<LeadTimeAnalysis>>("/analytics/lead-time", {
      params: Object.keys(params).length ? params : undefined,
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

export function fetchVolatility(windowDays = 14): Promise<VolatilityResponse> {
  return request<VolatilityResponse>(
    http.get<ApiResponse<VolatilityResponse>>("/analytics/volatility", {
      params: { window_days: windowDays },
    }),
  );
}

export interface FareSpikeQuery {
  window_days?: number;
  by_airline?: boolean;
  route_id?: string;
  airline?: string;
  severity?: string;
}

export function fetchFareSpikes(
  q: FareSpikeQuery = {},
): Promise<FareSpikesResponse> {
  return request<FareSpikesResponse>(
    http.get<ApiResponse<FareSpikesResponse>>("/alerts/fare-spikes", {
      params: q,
    }),
  );
}

export interface FestivalQuery {
  event?: string;
  route_id?: string;
  airline?: string;
}

export function fetchFestivals(q: FestivalQuery = {}): Promise<FestivalAnalysis> {
  const params = Object.fromEntries(Object.entries(q).filter(([, v]) => v));
  return request<FestivalAnalysis>(
    http.get<ApiResponse<FestivalAnalysis>>("/analytics/festivals", {
      params: Object.keys(params).length ? params : undefined,
    }),
  );
}
