import { http, request } from "./client";
import type { ApiResponse } from "@/types/api";
import type { Methodology } from "@/types/models";

export function fetchMethodology(): Promise<Methodology> {
  return request<Methodology>(
    http.get<ApiResponse<Methodology>>("/methodology"),
  );
}
