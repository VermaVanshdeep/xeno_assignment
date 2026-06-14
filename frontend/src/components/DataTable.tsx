import React, { useState } from 'react';

export interface ColumnDefinition<T> {
  key: keyof T | string;
  label: string;
  sortable?: boolean;
}

interface DataTableProps<T> {
  columns: ColumnDefinition<T>[];
  data: T[];
  renderRow: (item: T, index: number) => React.ReactNode;
  className?: string;
  onSortChange?: (key: string, direction: 'asc' | 'desc' | null) => void;
  defaultSortKey?: string;
}

export function DataTable<T>({
  columns,
  data,
  renderRow,
  className = '',
  onSortChange,
  defaultSortKey
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(defaultSortKey || null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc' | null>('asc');

  const handleHeaderClick = (column: ColumnDefinition<T>) => {
    if (!column.sortable) return;

    let newDir: 'asc' | 'desc' | null = 'asc';
    if (sortKey === column.key) {
      if (sortDir === 'asc') {
        newDir = 'desc';
      } else if (sortDir === 'desc') {
        newDir = null; // Reset sort
      } else {
        newDir = 'asc';
      }
    }

    const nextSortKey = newDir === null ? null : (column.key as string);
    setSortKey(nextSortKey);
    setSortDir(newDir);

    if (onSortChange) {
      onSortChange(column.key as string, newDir);
    }
  };

  return (
    <div className={`table-container ${className}`}>
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((col, idx) => {
              const isSorted = sortKey === col.key;
              const headerClass = col.sortable ? 'sortable-header' : '';
              const directionClass = isSorted && sortDir ? (sortDir === 'asc' ? 'asc' : 'desc') : '';

              return (
                <th
                  key={idx}
                  className={`${headerClass} ${directionClass}`}
                  onClick={() => handleHeaderClick(col)}
                >
                  {col.label}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} style={{ textAlign: 'center', padding: '32px 0' }}>
                <span className="text-label" style={{ textTransform: 'none' }}>No records found.</span>
              </td>
            </tr>
          ) : (
            data.map((item, idx) => renderRow(item, idx))
          )}
        </tbody>
      </table>
    </div>
  );
}
export default DataTable;
