import { http, request } from "./client";
import type { ApiResponse } from "@/types/api";
import type { CollectionRun, DataQuality, DataQualityQuery } from "@/types/models";

export function fetchDataQuality(
  query: DataQualityQuery = {},
): Promise<DataQuality> {
  const params = Object.fromEntries(
    Object.entries(query).filter(([, v]) => v),
  );
  return request<DataQuality>(
    http.get<ApiResponse<DataQuality>>("/data-quality", {
      params: Object.keys(params).length ? params : undefined,
    }),
  );
}

export function fetchCollectionStatus(): Promise<{ latest_run: CollectionRun | null }> {
  return request<{ latest_run: CollectionRun | null }>(
    http.get<ApiResponse<{ latest_run: CollectionRun | null }>>(
      "/collection/status",
    ),
  );
}

export function runCollection(
  mode: "auto" | "amadeus" | "synthetic" = "auto",
): Promise<CollectionRun> {
  return request<CollectionRun>(
    http.post<ApiResponse<CollectionRun>>("/collection/run", null, {
      params: { mode },
    }),
  );
}
