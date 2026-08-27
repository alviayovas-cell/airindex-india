import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchAirlineComparison, fetchLeadTime, fetchRouteHeatmap } from "@/api/analytics";
import { fetchFlights, type FlightQuery } from "@/api/flights";
import { fetchCurrentIndex, fetchIndexHistory, fetchOverview } from "@/api/index";
import { fetchMethodology } from "@/api/methodology";
import { fetchDataQuality, fetchCollectionStatus, runCollection } from "@/api/quality";
import { fetchRouteDetail, fetchRoutes } from "@/api/routes";
import { fetchBacktest, fetchReport, type ReportQuery } from "@/api/validation";
import type { Frequency } from "@/types/models";

export const useOverview = () =>
  useQuery({ queryKey: ["overview"], queryFn: fetchOverview });

export const useCurrentIndex = () =>
  useQuery({ queryKey: ["index", "current"], queryFn: fetchCurrentIndex });

export const useIndexHistory = (frequency: Frequency) =>
  useQuery({
    queryKey: ["index", "history", frequency],
    queryFn: () => fetchIndexHistory(frequency),
    placeholderData: keepPreviousData,
  });

export const useRoutes = () =>
  useQuery({ queryKey: ["routes"], queryFn: fetchRoutes });

export const useRouteDetail = (routeId: string | undefined) =>
  useQuery({
    queryKey: ["routes", routeId],
    queryFn: () => fetchRouteDetail(routeId as string),
    enabled: !!routeId,
  });

export const useLeadTime = (route?: string) =>
  useQuery({
    queryKey: ["analytics", "lead-time", route ?? "all"],
    queryFn: () => fetchLeadTime(route),
    placeholderData: keepPreviousData,
  });

export const useRouteHeatmap = () =>
  useQuery({ queryKey: ["analytics", "routes"], queryFn: fetchRouteHeatmap });

export const useAirlineComparison = () =>
  useQuery({
    queryKey: ["analytics", "airlines"],
    queryFn: fetchAirlineComparison,
  });

export const useFlights = (query: FlightQuery) =>
  useQuery({
    queryKey: ["flights", query],
    queryFn: () => fetchFlights(query),
    placeholderData: keepPreviousData,
  });

export const useDataQuality = () =>
  useQuery({ queryKey: ["data-quality"], queryFn: fetchDataQuality });

export const useCollectionStatus = () =>
  useQuery({ queryKey: ["collection", "status"], queryFn: fetchCollectionStatus });

export const useMethodology = () =>
  useQuery({
    queryKey: ["methodology"],
    queryFn: fetchMethodology,
    staleTime: 10 * 60_000,
  });

export const useBacktest = () =>
  useQuery({ queryKey: ["backtest"], queryFn: fetchBacktest });

export const useReport = (query: ReportQuery, enabled = true) =>
  useQuery({
    queryKey: ["report", query],
    queryFn: () => fetchReport(query),
    enabled,
    placeholderData: keepPreviousData,
  });

export const useRunCollection = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: runCollection,
    onSuccess: () => {
      qc.invalidateQueries();
    },
  });
};
