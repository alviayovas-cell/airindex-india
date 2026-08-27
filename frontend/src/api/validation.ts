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

/** Download a report as a CSV / PDF / JSON file (needs the auth header, so we
 *  fetch a blob rather than using a plain link). */
export async function downloadReportFile(
  query: ReportQuery,
  format: "csv" | "pdf" | "json",
): Promise<void> {
  const params = Object.fromEntries(
    Object.entries(query).filter(([, v]) => v !== undefined && v !== ""),
  );
  const stamp = new Date().toISOString().slice(0, 10);
  const name = `airindex-${query.frequency ?? "daily"}-report-${stamp}.${format}`;

  let blob: Blob;
  if (format === "json") {
    const data = await fetchReport(query);
    blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
  } else {
    const res = await http.get(`/reports`, {
      params: { ...params, format },
      responseType: "blob",
    });
    blob = res.data as Blob;
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
