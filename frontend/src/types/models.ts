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

export interface DataQuality {
  overall_quality_pct: number | null;
  breakdown: DataQualityBreakdown;
  latest_day: DataQualityDay | null;
  daily: DataQualityDay[];
  sources: SourceHealth[];
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
