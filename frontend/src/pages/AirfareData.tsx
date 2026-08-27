import { useMemo, useState } from "react";
import { Download, Search, SlidersHorizontal } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardBody } from "@/components/common/Card";
import { Button } from "@/components/common/Button";
import { Select } from "@/components/common/Select";
import { Badge } from "@/components/common/Badge";
import { StatusBadge } from "@/components/common/StatusBadge";
import { EmptyState } from "@/components/common/EmptyState";
import { DataTable, type Column, type SortState } from "@/components/tables/DataTable";
import { Pagination } from "@/components/tables/Pagination";
import { FilterChip } from "@/components/tables/FilterBar";
import { useFlights } from "@/hooks/queries";
import { fetchFlights, type FlightQuery } from "@/api/flights";
import { downloadCsv } from "@/utils/csv";
import {
  formatCurrency,
  formatDate,
  formatDateShort,
} from "@/utils/format";
import type { FlightRow } from "@/types/models";

const PAGE_SIZE = 20;

interface Filters {
  route_id: string;
  airline: string;
  source: string;
  advance_window: string;
  status: string;
  search: string;
}

const EMPTY: Filters = {
  route_id: "",
  airline: "",
  source: "",
  advance_window: "",
  status: "",
  search: "",
};

export default function AirfareData() {
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const [draftSearch, setDraftSearch] = useState("");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<SortState>({ key: "collected_at", order: "desc" });
  const [exporting, setExporting] = useState(false);

  const query: FlightQuery = useMemo(
    () => ({
      page,
      page_size: PAGE_SIZE,
      sort: sort.key,
      order: sort.order,
      ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)),
    }),
    [page, sort, filters],
  );

  const flights = useFlights(query);
  const opts = flights.data?.filter_options;

  const setFilter = (key: keyof Filters, value: string) => {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
  };

  const activeChips = (Object.entries(filters) as [keyof Filters, string][])
    .filter(([, v]) => v)
    .map(([k, v]) => ({ key: k, label: `${k.replace("_", " ")}: ${v}` }));

  const columns: Column<FlightRow>[] = [
    {
      key: "collected_at",
      header: "Collected",
      sortable: true,
      render: (r) => <span className="text-muted-foreground">{formatDate(r.collected_at)}</span>,
    },
    { key: "route_id", header: "Route", sortable: true, render: (r) => (
      <span className="font-medium">{r.origin} → {r.destination}</span>
    ) },
    { key: "airline", header: "Airline", sortable: true, render: (r) => r.airline },
    {
      key: "travel_date",
      header: "Travel",
      sortable: true,
      render: (r) => formatDateShort(r.travel_date),
    },
    {
      key: "advance_window",
      header: "Window",
      render: (r) => <Badge>{r.advance_window}</Badge>,
    },
    { key: "fare_class", header: "Class", render: (r) => <span className="capitalize">{r.fare_class}</span> },
    {
      key: "base_fare",
      header: "Base",
      align: "right",
      render: (r) => formatCurrency(r.base_fare),
    },
    { key: "taxes", header: "Taxes", align: "right", render: (r) => formatCurrency(r.taxes) },
    { key: "fees", header: "Fees", align: "right", render: (r) => formatCurrency(r.fees) },
    {
      key: "total_fare",
      header: "Total",
      align: "right",
      sortable: true,
      render: (r) => <span className="font-semibold">{formatCurrency(r.total_fare)}</span>,
    },
    { key: "source", header: "Source", render: (r) => (
      <span className="inline-flex items-center gap-1">
        {r.source}
        {r.is_synthetic && <span className="text-warning" title="synthetic">•</span>}
      </span>
    ) },
    { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
  ];

  async function handleExport() {
    setExporting(true);
    try {
      const res = await fetchFlights({ ...query, page: 1, page_size: 2000 });
      downloadCsv(
        `airindex-observations-${new Date().toISOString().slice(0, 10)}.csv`,
        [
          { key: "collected_at", header: "collected_at" },
          { key: "route_id", header: "route" },
          { key: "origin", header: "origin" },
          { key: "destination", header: "destination" },
          { key: "airline", header: "airline" },
          { key: "travel_date", header: "travel_date" },
          { key: "advance_window", header: "advance_window" },
          { key: "fare_class", header: "fare_class" },
          { key: "base_fare", header: "base_fare" },
          { key: "taxes", header: "taxes" },
          { key: "fees", header: "fees" },
          { key: "total_fare", header: "total_fare" },
          { key: "currency", header: "currency" },
          { key: "source", header: "source" },
          { key: "status", header: "status" },
        ],
        res.items as unknown as Record<string, unknown>[],
      );
    } finally {
      setExporting(false);
    }
  }

  const toOpts = (arr?: string[]) =>
    (arr ?? []).map((v) => ({ value: v, label: v }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Airfare Observations"
        description="Explore normalized flight-fare observations collected from authorized data sources."
        actions={
          <Button variant="secondary" onClick={handleExport} loading={exporting}>
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        }
      />

      <Card>
        <CardBody className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <form
              className="space-y-1.5 sm:col-span-2 lg:col-span-1"
              onSubmit={(e) => {
                e.preventDefault();
                setFilter("search", draftSearch.trim());
              }}
            >
              <label
                htmlFor="airfare-search"
                className="block text-xs font-medium text-muted-foreground"
              >
                Search
              </label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  id="airfare-search"
                  className="h-9 w-full rounded-lg border border-input bg-card pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground/70 focus:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
                  placeholder="Route, airline, flight no."
                  value={draftSearch}
                  onChange={(e) => setDraftSearch(e.target.value)}
                />
              </div>
            </form>
            <Select
              label="Route"
              placeholder="All routes"
              options={toOpts(opts?.routes)}
              value={filters.route_id}
              onChange={(e) => setFilter("route_id", e.target.value)}
            />
            <Select
              label="Airline"
              placeholder="All airlines"
              options={toOpts(opts?.airlines)}
              value={filters.airline}
              onChange={(e) => setFilter("airline", e.target.value)}
            />
            <Select
              label="Window"
              placeholder="All windows"
              options={toOpts(opts?.advance_windows)}
              value={filters.advance_window}
              onChange={(e) => setFilter("advance_window", e.target.value)}
            />
            <Select
              label="Source"
              placeholder="All sources"
              options={toOpts(opts?.sources)}
              value={filters.source}
              onChange={(e) => setFilter("source", e.target.value)}
            />
            <Select
              label="Status"
              placeholder="All statuses"
              options={toOpts(opts?.statuses)}
              value={filters.status}
              onChange={(e) => setFilter("status", e.target.value)}
            />
          </div>

          {activeChips.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
              <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
              {activeChips.map((c) => (
                <FilterChip
                  key={c.key}
                  label={c.label}
                  onRemove={() => setFilter(c.key, "")}
                />
              ))}
              <button
                onClick={() => {
                  setFilters(EMPTY);
                  setDraftSearch("");
                  setPage(1);
                }}
                className="text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                Clear all
              </button>
            </div>
          )}
        </CardBody>
      </Card>

      <Card>
        <DataTable
          columns={columns}
          rows={flights.data?.items ?? []}
          rowKey={(r) => r.id}
          sort={sort}
          onSortChange={(s) => {
            setSort(s);
            setPage(1);
          }}
          loading={flights.isPending}
          skeletonRows={10}
          empty={
            <EmptyState
              title="No airfare observations found"
              description="Try changing your route, window or status filters."
            />
          }
        />
        {flights.data && flights.data.pagination.total > 0 && (
          <div className="border-t border-border">
            <Pagination
              page={flights.data.pagination.page}
              totalPages={flights.data.pagination.total_pages}
              total={flights.data.pagination.total}
              pageSize={PAGE_SIZE}
              onPage={setPage}
            />
          </div>
        )}
      </Card>
    </div>
  );
}
