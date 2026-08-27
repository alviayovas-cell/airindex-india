/** Domain types mirroring the backend API payloads. */

export type Frequency = "daily" | "weekly" | "monthly";

export type QuoteStatus =
  | "valid"
  | "missing"
  | "outlier"
  | "duplicate"
  | "cancelled"
  | "sold_out";

export interface CurrentIndex {
  index_value: number;
  base_period: string;
  current_period: string;
  methodology_version: string;
  change_1d: number | null;
  change_7d: number | null;
  change_30d: number | null;
  observation_count: number;
  routes_covered: number;
  sparkline: number[];
  status_label: string;
  is_experimental: boolean;
}

export interface IndexHistoryPoint {
  date: string;
  index_value: number;
  change_pct: number | null;
  observation_count: number;
  routes_covered: number;
}

export interface IndexHistory {
  frequency: Frequency;
  base_period: string | null;
  methodology_version: string | null;
  points: IndexHistoryPoint[];
}

export interface Overview {
  index: CurrentIndex | null;
  routes_tracked: number;
  airlines_covered: number;
  observations: number;
  data_quality_pct: number | null;
  last_updated: string | null;
  source: string | null;
  is_synthetic: boolean;
}

export interface RouteStat {
  route_id: string;
  origin: string;
  destination: string;
  label: string;
  weight: number;
  average_fare: number | null;
  observation_count: number;
  current_index: number | null;
  change_7d: number | null;
  change_30d: number | null;
  sparkline: number[];
}

export interface RoutesResponse {
  routes: RouteStat[];
  count: number;
  weights_sum: number;
}

export interface LeadTimeWindow {
  window: string;
  advance_days: number;
  average_fare: number | null;
  median_fare: number | null;
  observation_count: number;
}

export interface LeadTimeAnalysis {
  route_id: string | null;
  windows: LeadTimeWindow[];
  filters?: {
    airline: string | null;
    fare_type: string | null;
    date_from: string | null;
    date_to: string | null;
  };
  filter_options?: { airlines: string[]; fare_types: string[] };
}

export interface AirlineStat {
  airline: string;
  name: string;
  observation_count: number;
  average_fare: number;
  routes_served: number;
}

export interface RouteDetail {
  route: {
    route_id: string;
    origin: string;
    destination: string;
    origin_city: string | null;
    destination_city: string | null;
    weight: number;
  };
  label: string;
  stats: RouteStat;
  index_history: { date: string; index_value: number }[];
  lead_time: LeadTimeAnalysis;
  airlines: { airline: string; average_fare: number; observation_count: number }[];
  volatility: RouteVolatility | null;
}

export interface HeatmapRow {
  route_id: string;
  label: string;
  change_7d: number | null;
  change_30d: number | null;
  current_index: number | null;
}

export interface RouteHeatmap {
  routes: HeatmapRow[];
  range: { min: number | null; max: number | null };
}

export interface FlightRow {
  id: string;
  collected_at: string;
  collection_date: string;
  origin: string;
  destination: string;
  route_id: string;
  airline: string;
  flight_number: string | null;
  travel_date: string;
  advance_days: number;
  advance_window: string;
  fare_class: string;
  cabin: string;
  base_fare: number | null;
  taxes: number | null;
  fees: number | null;
  total_fare: number | null;
  currency: string;
  source: string;
  status: QuoteStatus;
  quality_flags: string[];
  is_synthetic: boolean;
}

export interface Pagination {
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
}

export interface FilterOptions {
  origins: string[];
  destinations: string[];
  routes: string[];
  airlines: string[];
  sources: string[];
  advance_windows: string[];
  statuses: string[];
}

export interface FlightsResponse {
  items: FlightRow[];
  pagination: Pagination;
  filter_options: FilterOptions;
}

export interface DataQualityBreakdown {
  total: number;
  valid: number;
  missing: number;
  duplicate: number;
  outlier: number;
  cancelled: number;
  sold_out: number;
}

export interface DataQualityDay {
  date: string;
  total: number;
  valid_count: number;
  missing_count: number;
  duplicate_count: number;
  outlier_count: number;
  cancelled_count: number;
  sold_out_count: number;
  quality_pct: number;
}

export interface SourceHealth {
  name: string;
  status: "healthy" | "partial" | "failed" | "unknown";
  last_collection: string | null;
  records_collected: number;
  errors: string[];
  duration_seconds?: number | null;
  is_synthetic: boolean;
}

export interface QualityGroupRow {
  key: string;
  label?: string;
  total: number;
  valid: number;
  missing: number;
  outlier: number;
  duplicate: number;
  cancelled: number;
  sold_out: number;
  quality_pct: number;
}

export interface DataQuality {
  overall_quality_pct: number | null;
  breakdown: DataQualityBreakdown;
  latest_day: DataQualityDay | null;
  daily: DataQualityDay[];
  by_route: QualityGroupRow[];
  by_airline: QualityGroupRow[];
  sources: SourceHealth[];
  filters: {
    date_from: string | null;
    date_to: string | null;
    route_id: string | null;
    airline: string | null;
    source: string | null;
  };
  filter_options: { routes: string[]; airlines: string[]; sources: string[] };
}

export interface DataQualityQuery {
  date_from?: string;
  date_to?: string;
  route_id?: string;
  airline?: string;
  source?: string;
}

export interface CollectionRun {
  source: string;
  mode: string;
  started_at: string;
  completed_at: string;
  duration_seconds: number;
  records_found: number;
  records_stored: number;
  status: "success" | "partial" | "failed";
  errors: string[];
  is_synthetic: boolean;
  note?: string;
}

export interface BacktestPoint {
  date: string;
  our_index: number;
  reference_index: number;
  difference: number;
  pct_deviation: number | null;
}

export interface Backtest {
  available: boolean;
  message?: string;
  data_status: string;
  data_status_label: string;
  methodology_version: string | null;
  base_period: string;
  days: number;
  series: BacktestPoint[];
  metrics: {
    mae: number;
    rmse: number;
    correlation: number | null;
    mape_pct: number;
    max_abs_deviation_pct: number;
  };
  notes: string[];
  limitations: string[];
  reference_dataset: { available: boolean; name: string; reason: string };
}

export interface ReportRow {
  period: string;
  average_fare: number | null;
  index_value: number | null;
  observations: number;
  valid_observations: number;
  quality_pct: number;
}

export interface Report {
  summary: {
    route_id: string | null;
    frequency: Frequency;
    date_from: string | null;
    date_to: string | null;
    average_fare: number | null;
    index_start: number | null;
    index_end: number | null;
    index_change_pct: number | null;
    observations: number;
    valid_observations: number;
    quality_pct: number | null;
    period_count: number;
  };
  rows: ReportRow[];
  generated_at?: string;
  frequency?: Frequency;
  disclaimer?: string;
  index?: {
    value: number;
    base_period: string;
    current_period: string;
    change_1d: number | null;
    change_7d: number | null;
    change_30d: number | null;
  } | null;
  route_indexes?: {
    route_id: string;
    label: string;
    current_index: number | null;
    change_7d: number | null;
    change_30d: number | null;
    average_fare: number | null;
    weight: number;
  }[];
  observed_contributors?: ObservedContributor[];
  largest_observed_movement?: {
    route_id: string;
    label: string;
    route_index_change: number;
  } | null;
  most_affected_window?: { window: string; abs_change_pct: number } | null;
  volatility?: RouteVolatility[];
  fare_spikes?: {
    summary: Record<string, number>;
    window_days: number;
    top: FareSpike[];
  };
  data_quality?: {
    overall_quality_pct: number | null;
    breakdown: DataQualityBreakdown;
  };
  lead_time?: LeadTimeWindow[];
  methodology?: {
    version: string;
    base_period: string;
    formula: string;
    advance_windows: number[];
    weights: Record<string, number>;
    disclaimer: string;
  };
  data_source?: {
    source: string | null;
    is_synthetic: boolean;
    last_updated: string | null;
  };
}

export interface RouteVolatility {
  route_id: string;
  label: string;
  volatility_score: number;
  category: "Low" | "Moderate" | "High" | "Very High";
  daily_return_std_pct: number;
  coefficient_of_variation_pct: number | null;
  trend_pct: number | null;
  observations: number;
  sparkline: number[];
}

export interface VolatilityResponse {
  window_days: number;
  method: string;
  categories: Record<string, string>;
  disclaimer: string;
  routes: RouteVolatility[];
}

export type SpikeSeverity =
  | "Normal"
  | "Moderate Increase"
  | "High Increase"
  | "Critical Increase";

export interface FareSpike {
  route_id: string;
  route_label: string;
  advance_window: string;
  airline: string | null;
  current_avg_fare: number;
  baseline_avg_fare: number;
  pct_change: number;
  severity: SpikeSeverity;
  current_observations: number;
  baseline_observations: number;
  detected_at: string;
}

export interface FareSpikesResponse {
  available: boolean;
  message?: string;
  window_days: number;
  by_airline: boolean;
  current_period: { from: string; to: string };
  baseline_period: { from: string; to: string };
  thresholds: Record<string, number>;
  severities: SpikeSeverity[];
  summary: Record<SpikeSeverity, number>;
  alerts: FareSpike[];
  note: string;
}

export interface IndexCalculationRow {
  route_id: string;
  label: string;
  weight: number;
  effective_weight: number;
  route_index: number;
  contribution: number;
}

export interface IndexCalculation {
  date: string;
  available_dates: string[];
  base_period: string | null;
  methodology_version: string | null;
  formula: string;
  index_value: number;
  recomputed_from_rows: number;
  rows: IndexCalculationRow[];
  routes_missing: string[];
  note: string;
}

export interface ObservedContributor {
  route_id: string;
  label: string;
  weight: number;
  route_index_now: number;
  route_index_prev: number;
  route_index_change: number;
  contribution_now: number;
  contribution_prev: number;
  contribution_delta: number;
  avg_fare_now: number | null;
  avg_fare_prev: number | null;
  avg_fare_change_pct: number | null;
}

export interface IndexExplain {
  available: boolean;
  message?: string;
  date: string;
  compare_date?: string;
  available_dates?: string[];
  index_now?: number;
  index_prev?: number;
  index_change?: number;
  index_change_pct?: number | null;
  observed_contributors?: ObservedContributor[];
  largest_observed_movement?: {
    route_id: string;
    label: string;
    route_index_change: number;
  } | null;
  most_affected_window?: { window: string; abs_change_pct: number } | null;
  disclaimer?: string;
}

export interface ModelMetrics {
  mae: number;
  rmse: number;
  mape_pct: number;
  interval_coverage_pct: number;
  mean_interval_width: number;
}

export interface ModelInfo {
  available: boolean;
  reason?: string;
  version?: string;
  trained_at?: string;
  algorithm?: string;
  metrics?: ModelMetrics;
  n_train?: number;
  n_test?: number;
  data_basis?: string;
  features?: string[];
  disclaimer?: string;
}

export interface FarePrediction {
  available: boolean;
  reason?: string;
  route_id?: string;
  airline?: string;
  fare_type?: string;
  advance_days?: number;
  travel_date?: string;
  prediction_horizon_days?: number;
  predicted_lower_inr?: number;
  predicted_point_inr?: number;
  predicted_upper_inr?: number;
  interval?: string;
  model_version?: string;
  model_metrics?: ModelMetrics;
  data_basis?: string;
  disclaimer?: string;
}

export interface FestivalEvent {
  name: string;
  date: string;
  type: string;
  event_period: { from: string; to: string };
  in_data_range: boolean;
  event_observations: number;
  event_avg_fare: number | null;
  normal_avg_fare: number | null;
  observed_change_pct: number | null;
}

export interface FestivalAnalysis {
  available: boolean;
  message?: string;
  data_range: { from: string; to: string };
  normal_avg_fare: number | null;
  window_days: number;
  filters: { event: string | null; route_id: string | null; airline: string | null };
  disclaimer: string;
  events: FestivalEvent[];
}

export interface IndexConfig {
  base_period: string;
  methodology_version: string;
  advance_windows: number[];
  outlier_method: string;
  outlier_methods: string[];
  spike_thresholds: Record<string, number>;
  weights_raw: Record<string, number>;
  weights: Record<string, number>;
  weights_sum: number;
  routes: {
    route_id: string;
    label: string;
    origin_city: string | null;
    destination_city: string | null;
  }[];
  reindex?: { index_points?: number; days?: number; base_period?: string };
}

export interface Methodology {
  methodology_version: string;
  base_period: string;
  index_formula: string;
  price_standardization: string;
  advance_windows: number[];
  route_basket: {
    route_id: string;
    label: string;
    origin_city: string | null;
    destination_city: string | null;
    weight: number | null;
  }[];
  weights: Record<string, number>;
  weights_sum: number;
  data_quality_rules: string[];
  missing_data_rule: string;
  outlier_rule: string;
  data_sources: string[];
  disclaimer: string;
}
