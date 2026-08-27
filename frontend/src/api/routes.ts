import { http, request } from "./client";
import type { ApiResponse } from "@/types/api";
import type { RouteDetail, RoutesResponse } from "@/types/models";

export function fetchRoutes(): Promise<RoutesResponse> {
  return request<RoutesResponse>(
    http.get<ApiResponse<RoutesResponse>>("/routes"),
  );
}

export function fetchRouteDetail(routeId: string): Promise<RouteDetail> {
  return request<RouteDetail>(
    http.get<ApiResponse<RouteDetail>>(`/routes/${encodeURIComponent(routeId)}`),
  );
}
