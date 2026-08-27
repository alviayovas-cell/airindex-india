import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchAirlineComparison,
  fetchFareSpikes,
  fetchLeadTime,
  fetchRouteHeatmap,
  fetchVolatility,
  type FareSpikeQuery,
  type LeadTimeQuery,
} from "@/api/analytics";
import {
  fetchConfig,
  updateIndexConfig,
  updateWeights,
  type IndexConfigPatch,
} from "@/api/config";
import { fetchIndexCalculation, fetchIndexExplain } from "@/api/explain";
import { askAi, fetchAiStatus, type AiTurn } from "@/api/ai";
import { fetchFlights, type FlightQuery } from "@/api/flights";
import { fetchCurrentIndex, fetchIndexHistory, fetchOverview } from "@/api/index";
import { fetchMethodology } from "@/api/methodology";
import { fetchDataQuality, fetchCollectionStatus, runCollection } from "@/api/quality";
import type { DataQualityQuery } from "@/types/models";
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

export const useLeadTime = (query: LeadTimeQuery = {}) =>
  useQuery({
    queryKey: ["analytics", "lead-time", query],
    queryFn: () => fetchLeadTime(query),
    placeholderData: keepPreviousData,
  });

export const useRouteHeatmap = () =>
  useQuery({ queryKey: ["analytics", "routes"], queryFn: fetchRouteHeatmap });

export const useVolatility = (windowDays = 14) =>
  useQuery({
    queryKey: ["analytics", "volatility", windowDays],
    queryFn: () => fetchVolatility(windowDays),
    placeholderData: keepPreviousData,
  });

export const useFareSpikes = (query: FareSpikeQuery = {}) =>
  useQuery({
    queryKey: ["alerts", "fare-spikes", query],
    queryFn: () => fetchFareSpikes(query),
    placeholderData: keepPreviousData,
  });

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

export const useDataQuality = (query: DataQualityQuery = {}) =>
  useQuery({
    queryKey: ["data-quality", query],
    queryFn: () => fetchDataQuality(query),
    placeholderData: keepPreviousData,
  });

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

export const useConfig = () =>
  useQuery({ queryKey: ["config"], queryFn: fetchConfig });

export const useIndexCalculation = (date?: string) =>
  useQuery({
    queryKey: ["index", "calculation", date ?? "latest"],
    queryFn: () => fetchIndexCalculation(date),
    placeholderData: keepPreviousData,
  });

export const useIndexExplain = (date?: string, compare?: string) =>
  useQuery({
    queryKey: ["index", "explain", date ?? "latest", compare ?? "prev"],
    queryFn: () => fetchIndexExplain(date, compare),
    placeholderData: keepPreviousData,
  });

export const useUpdateWeights = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (weights: Record<string, number>) => updateWeights(weights),
    onSuccess: () => qc.invalidateQueries(),
  });
};

export const useUpdateIndexConfig = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: IndexConfigPatch) => updateIndexConfig(patch),
    onSuccess: () => qc.invalidateQueries(),
  });
};

export const useAiStatus = () =>
  useQuery({ queryKey: ["ai", "status"], queryFn: fetchAiStatus, staleTime: 5 * 60_000 });

export const useAskAi = () =>
  useMutation({
    mutationFn: ({ question, history }: { question: string; history: AiTurn[] }) =>
      askAi(question, history),
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
