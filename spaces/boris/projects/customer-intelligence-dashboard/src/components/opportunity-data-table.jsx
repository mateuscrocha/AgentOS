import { flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";

import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

function OpportunityDataTable({ data, columns, selectedId, onRowClick, emptyState }) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel()
  });

  if (!data.length) return emptyState;

  return (
    <div className="overflow-hidden rounded-[1.7rem] border border-border/60 bg-white shadow-sm">
      <Table>
        <TableHeader className="bg-muted/25">
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id} className="hover:bg-transparent">
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id} className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                  {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) => {
            const record = row.original;
            const isSelected = selectedId === record.id;

            return (
              <TableRow
                key={row.id}
                data-state={isSelected ? "selected" : undefined}
                className={cn(
                  "cursor-pointer border-b border-border/50 last:border-b-0 hover:bg-accent/20",
                  isSelected && "bg-accent/30"
                )}
                onClick={() => onRowClick(record.id)}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id} className="align-top">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function accountCell(record) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary" className="h-5 rounded-md px-1.5 text-[10px] font-medium uppercase tracking-[0.12em]">
          {record.stage}
        </Badge>
      </div>
      <div className="space-y-1">
        <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Conta</p>
        <p className="text-sm font-bold tracking-tight text-foreground">{record.account}</p>
        <p className="text-xs text-muted-foreground">{record.contact}</p>
      </div>
    </div>
  );
}

function renderInlineText(text) {
  const tokens = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g).filter(Boolean);

  return tokens.map((token, index) => {
    if (token.startsWith("**") && token.endsWith("**")) {
      return (
        <strong key={`${token}-${index}`} className="font-semibold text-foreground">
          {token.slice(2, -2)}
        </strong>
      );
    }

    if (token.startsWith("*") && token.endsWith("*")) {
      return (
        <em key={`${token}-${index}`} className="italic text-foreground/90">
          {token.slice(1, -1)}
        </em>
      );
    }

    if (token.startsWith("`") && token.endsWith("`")) {
      return (
        <code key={`${token}-${index}`} className="rounded bg-muted px-1.5 py-0.5 text-[0.92em] text-foreground">
          {token.slice(1, -1)}
        </code>
      );
    }

    return <span key={`${token}-${index}`}>{token}</span>;
  });
}

function compactTextParts(value) {
  const lines = String(value)
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);

  if (lines.length > 1) return lines.slice(0, 2);

  return String(value)
    .split(/(?<=[.!?])\s+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 2);
}

function richCell(value, { emptyFallback }) {
  const parts = compactTextParts(value && String(value).trim() ? value : emptyFallback);
  const [lead, ...rest] = parts;

  return (
    <div className="flex max-w-none flex-col gap-2">
      {lead ? (
        <p className="line-clamp-2 text-sm font-semibold leading-6 text-foreground">{renderInlineText(lead)}</p>
      ) : null}
      {rest.length ? (
        <div className="flex flex-col gap-1">
          {rest.map((item) => (
            <p key={item} className="line-clamp-2 text-sm leading-6 text-muted-foreground">
              {renderInlineText(item)}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function priorityCell(priority, formattedDate, renderPriority) {
  return (
    <div className="flex min-w-[5.5rem] flex-col items-end gap-2">
      {renderPriority(priority)}
      <span className="text-[11px] text-muted-foreground">{formattedDate}</span>
    </div>
  );
}

export function createOpportunityColumns(renderPriority) {
  return [
    {
      accessorKey: "account",
      header: "Conta",
      cell: ({ row }) => accountCell(row.original)
    },
    {
      accessorKey: "lastMovement",
      header: "Última movimentação",
      cell: ({ row }) => richCell(row.original.lastMovement, { emptyFallback: "Sem movimentação recente." })
    },
    {
      id: "pain",
      header: "Dor",
      cell: ({ row }) => richCell(row.original.pains[0], { emptyFallback: "Sem dor principal consolidada." })
    },
    {
      accessorKey: "nextStep",
      header: "Próximo passo",
      cell: ({ row }) => richCell(row.original.nextStep, { emptyFallback: "Próximo passo a definir." })
    },
    {
      id: "priority",
      header: () => <div className="text-right">Sinal</div>,
      cell: ({ row }) => priorityCell(row.original.priority, row.original.formattedDate, renderPriority)
    }
  ];
}

export function createCommercialAccountColumns(renderPriority, renderAction) {
  return [
    {
      accessorKey: "account",
      header: "Conta",
      cell: ({ row }) => accountCell(row.original)
    },
    {
      accessorKey: "summary",
      header: "Resumo",
      cell: ({ row }) => richCell(row.original.summary, { emptyFallback: "Sem resumo consolidado." })
    },
    {
      accessorKey: "nextStep",
      header: "Próximo passo",
      cell: ({ row }) => richCell(row.original.nextStep, { emptyFallback: "Próximo passo a definir." })
    },
    {
      id: "priority",
      header: () => <div className="text-right">Ações</div>,
      cell: ({ row }) => (
        <div className="flex min-w-[8rem] flex-col items-end gap-2">
          {renderPriority(row.original.priority)}
          {renderAction(row.original)}
        </div>
      )
    }
  ];
}

export function createProductAccountColumns(renderAction) {
  return [
    {
      accessorKey: "account",
      header: "Conta",
      cell: ({ row }) => (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{row.original.track}</Badge>
          </div>
          <div className="space-y-1">
            <p className="font-semibold text-foreground">{row.original.account}</p>
            <p className="text-sm text-muted-foreground">{row.original.contact}</p>
          </div>
        </div>
      )
    },
    {
      accessorKey: "summary",
      header: "Resumo",
      cell: ({ row }) => richCell(row.original.summary, { emptyFallback: "Sem resumo consolidado." })
    },
    {
      id: "pain",
      header: "Dor principal",
      cell: ({ row }) => richCell(row.original.pains[0], { emptyFallback: "Sem dor mapeada." })
    },
    {
      id: "action",
      header: () => <div className="text-right">Abrir</div>,
      cell: ({ row }) => <div className="flex justify-end">{renderAction(row.original)}</div>
    }
  ];
}

export default OpportunityDataTable;
