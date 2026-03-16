import { BorisTable } from "@/components/ui/boris-table";

interface Column<T> {
  key: string;
  header: string;
  render?: (item: T) => React.ReactNode;
  className?: string;
  sortable?: boolean;
  sortValue?: (item: T) => string | number | boolean | Date | null | undefined;
  sortComparator?: (a: T, b: T) => number;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (item: T) => string;
  onRowClick?: (item: T) => void;
  page?: number;
  pageSize?: number;
  totalCount?: number;
  onPageChange?: (page: number) => void;
  className?: string;
}

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  onRowClick,
  page = 1,
  pageSize = 10,
  totalCount,
  onPageChange,
  className,
}: DataTableProps<T>) {
  return (
    <BorisTable
      columns={columns}
      data={data}
      keyExtractor={keyExtractor}
      onRowClick={onRowClick}
      page={page}
      pageSize={pageSize}
      totalCount={totalCount}
      onPageChange={onPageChange}
      className={className}
    />
  );
}
