import { http, request } from "./client";
import type { ApiResponse } from "@/types/api";
import type { Backtest, Frequency, Report } from "@/types/models";

export function fetchBacktest(): Promise<Backtest> {
  return request<Backtest>(http.get<ApiResponse<Backtest>>("/backtest"));
}

export interface ReportQuery {
  date_from?: string;
  date_to?: string;
  route_id?: string;
  frequency?: Frequency;
}

export function fetchReport(query: ReportQuery): Promise<Report> {
  const params = Object.fromEntries(
    Object.entries(query).filter(([, v]) => v !== undefined && v !== ""),
  );
  return request<Report>(http.get<ApiResponse<Report>>("/reports", { params }));
}
