"use client";

import React from "react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number | "ALL";
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number | "ALL") => void;
  pageSizeOptions?: Array<number | "ALL">;
  itemLabel?: string;
  isLoading?: boolean;
}

export default function Pagination({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100, "ALL"],
  itemLabel = "data",
  isLoading = false,
}: PaginationProps) {
  if (totalItems <= 0) return null;

  const isAll = pageSize === "ALL";
  const numericPageSize = typeof pageSize === "number" ? pageSize : totalItems;

  const startItem = isAll || totalItems === 0 ? 1 : (currentPage - 1) * numericPageSize + 1;
  const endItem = isAll ? totalItems : Math.min(currentPage * numericPageSize, totalItems);

  // Generate page numbers with smart ellipsis: e.g. [1, "...", 4, 5, 6, "...", 10]
  const getPageNumbers = () => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const pages: (number | string)[] = [];
    const delta = 1; // Number of pages before and after current page

    const left = currentPage - delta;
    const right = currentPage + delta + 1;

    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= left && i < right)) {
        pages.push(i);
      } else if (pages[pages.length - 1] !== "...") {
        pages.push("...");
      }
    }

    return pages;
  };

  const pageNumbers = getPageNumbers();

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-4 px-2 select-none">
      {/* Entries Info & Page Size Selector */}
      <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 text-xs sm:text-sm text-slate-500 w-full sm:w-auto">
        <span>
          Menampilkan <span className="font-semibold text-slate-800">{totalItems > 0 ? startItem : 0}</span>-
          <span className="font-semibold text-slate-800">{endItem}</span> dari{" "}
          <span className="font-semibold text-slate-800">{totalItems}</span> {itemLabel}
        </span>

        {onPageSizeChange && (
          <div className="flex items-center gap-1.5 ml-0 sm:ml-2">
            <span className="text-slate-400">|</span>
            <span className="text-slate-500">Baris:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                const val = e.target.value === "ALL" ? "ALL" : Number(e.target.value);
                onPageSizeChange(val);
              }}
              disabled={isLoading}
              className="bg-white border border-slate-200 text-slate-700 rounded-lg px-2 py-1 text-xs font-medium focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition cursor-pointer disabled:opacity-50"
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt.toString()} value={opt}>
                  {opt === "ALL" ? "Semua" : opt}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Pagination Controls */}
      {!isAll && totalPages > 1 && (
        <div className="flex items-center gap-1 flex-wrap justify-center w-full sm:w-auto">
          {/* First Page */}
          <button
            type="button"
            onClick={() => onPageChange(1)}
            disabled={currentPage <= 1 || isLoading}
            title="Halaman Pertama"
            className="p-1.5 sm:p-2 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-40 disabled:hover:bg-white disabled:hover:text-slate-600 transition shadow-sm"
          >
            <ChevronsLeft className="w-4 h-4" />
          </button>

          {/* Previous Page */}
          <button
            type="button"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage <= 1 || isLoading}
            title="Halaman Sebelumnya"
            className="p-1.5 sm:p-2 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-40 disabled:hover:bg-white disabled:hover:text-slate-600 transition shadow-sm"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          {/* Page Numbers */}
          <div className="flex items-center gap-1">
            {pageNumbers.map((p, idx) => {
              if (p === "...") {
                return (
                  <span
                    key={`ellipsis-${idx}`}
                    className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center text-slate-400 text-xs font-semibold"
                  >
                    ...
                  </span>
                );
              }

              const isCurrent = p === currentPage;
              return (
                <button
                  key={`page-${p}`}
                  type="button"
                  onClick={() => onPageChange(Number(p))}
                  disabled={isLoading || isCurrent}
                  className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg text-xs sm:text-sm font-semibold transition flex items-center justify-center ${
                    isCurrent
                      ? "bg-emerald-600 text-white shadow-sm shadow-emerald-600/30"
                      : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 shadow-sm"
                  }`}
                >
                  {p}
                </button>
              );
            })}
          </div>

          {/* Next Page */}
          <button
            type="button"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= totalPages || isLoading}
            title="Halaman Berikutnya"
            className="p-1.5 sm:p-2 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-40 disabled:hover:bg-white disabled:hover:text-slate-600 transition shadow-sm"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          {/* Last Page */}
          <button
            type="button"
            onClick={() => onPageChange(totalPages)}
            disabled={currentPage >= totalPages || isLoading}
            title="Halaman Terakhir"
            className="p-1.5 sm:p-2 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-40 disabled:hover:bg-white disabled:hover:text-slate-600 transition shadow-sm"
          >
            <ChevronsRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
