import type { ReactNode } from "react";
import type { UseQueryResult } from "@tanstack/react-query";
import { ApiError } from "@/api/client";
import { ErrorState } from "./ErrorState";

/**
 * Standard loading / error / empty handling for a single query (§35).
 * Renders `children(data)` only once data is available.
 */
export function QueryBoundary<T>({
  query,
  skeleton,
  isEmpty,
  emptyState,
  children,
}: {
  query: UseQueryResult<T>;
  skeleton: ReactNode;
  isEmpty?: (data: T) => boolean;
  emptyState?: ReactNode;
  children: (data: T) => ReactNode;
}) {
  if (query.isPending) return <>{skeleton}</>;
  if (query.isError) {
    const msg =
      query.error instanceof ApiError
        ? query.error.message
        : "We couldn't load this data.";
    return <ErrorState message={msg} onRetry={() => query.refetch()} />;
  }
  if (isEmpty?.(query.data) && emptyState) return <>{emptyState}</>;
  return <>{children(query.data)}</>;
}
