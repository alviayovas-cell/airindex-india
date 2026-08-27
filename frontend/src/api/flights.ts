import { http, request } from "./client";
import type { ApiResponse } from "@/types/api";
import type { FlightsResponse } from "@/types/models";

export interface FlightQuery {
  page?: number;
  page_size?: number;
  sort?: string;
  order?: "asc" | "desc";
  origin?: string;
  destination?: string;
  route_id?: string;
  airline?: string;
  source?: string;
  advance_window?: string;
  status?: string;
  date_from?: string;
  date_to?: string;
  search?: string;
}

export function fetchFlights(query: FlightQuery): Promise<FlightsResponse> {
  const params = Object.fromEntries(
    Object.entries(query).filter(([, v]) => v !== undefined && v !== ""),
  );
  return request<FlightsResponse>(
    http.get<ApiResponse<FlightsResponse>>("/flights", { params }),
  );
}
