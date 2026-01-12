import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * Accessible Table Components
 *
 * These components provide WCAG 2.1 AA compliant data tables with:
 * - Proper ARIA roles and attributes
 * - Row and column headers with scope attributes
 * - Caption support for table description
 * - Sortable column support with aria-sort
 * - Selectable row support with aria-selected
 * - Responsive design with horizontal scroll indication
 */

interface AccessibleTableProps extends React.HTMLAttributes<HTMLTableElement> {
  /** Accessible caption describing the table contents */
  caption?: string;
  /** Whether to visually hide the caption (still available to screen readers) */
  captionHidden?: boolean;
  /** Summary of the table for complex data (deprecated but useful for older AT) */
  summary?: string;
}

const AccessibleTable = React.forwardRef<HTMLTableElement, AccessibleTableProps>(
  ({ className, caption, captionHidden = false, summary, children, ...props }, ref) => {
    return (
      <div className="relative w-full overflow-auto" role="region" aria-label={caption || "Data table"}>
        <table
          ref={ref}
          role="table"
          className={cn("w-full caption-bottom text-sm", className)}
          {...props}
        >
          {caption && (
            <caption className={cn(
              "mt-4 text-sm text-muted-foreground",
              captionHidden && "sr-only"
            )}>
              {caption}
            </caption>
          )}
          {children}
        </table>
      </div>
    )
  }
)
AccessibleTable.displayName = "AccessibleTable"

const AccessibleTableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead
    ref={ref}
    role="rowgroup"
    className={cn("[&_tr]:border-b", className)}
    {...props}
  />
))
AccessibleTableHeader.displayName = "AccessibleTableHeader"

const AccessibleTableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody
    ref={ref}
    role="rowgroup"
    className={cn("[&_tr:last-child]:border-0", className)}
    {...props}
  />
))
AccessibleTableBody.displayName = "AccessibleTableBody"

const AccessibleTableFooter = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tfoot
    ref={ref}
    role="rowgroup"
    className={cn(
      "border-t bg-muted/50 font-medium [&>tr]:last:border-b-0",
      className
    )}
    {...props}
  />
))
AccessibleTableFooter.displayName = "AccessibleTableFooter"

interface AccessibleTableRowProps extends React.HTMLAttributes<HTMLTableRowElement> {
  /** Whether this row is selected */
  selected?: boolean;
  /** Index for aria-rowindex (1-based) */
  rowIndex?: number;
}

const AccessibleTableRow = React.forwardRef<HTMLTableRowElement, AccessibleTableRowProps>(
  ({ className, selected, rowIndex, ...props }, ref) => (
    <tr
      ref={ref}
      role="row"
      aria-selected={selected}
      aria-rowindex={rowIndex}
      className={cn(
        "border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted",
        selected && "bg-muted",
        className
      )}
      {...props}
    />
  )
)
AccessibleTableRow.displayName = "AccessibleTableRow"

interface AccessibleTableHeadProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  /** Sort direction for sortable columns */
  sortDirection?: 'ascending' | 'descending' | 'none';
  /** Whether this header is for a column or row */
  scope?: 'col' | 'row' | 'colgroup' | 'rowgroup';
  /** Column index for aria-colindex (1-based) */
  colIndex?: number;
}

const AccessibleTableHead = React.forwardRef<HTMLTableCellElement, AccessibleTableHeadProps>(
  ({ className, sortDirection, scope = 'col', colIndex, children, ...props }, ref) => (
    <th
      ref={ref}
      role="columnheader"
      scope={scope}
      aria-sort={sortDirection}
      aria-colindex={colIndex}
      className={cn(
        "h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0",
        sortDirection && "cursor-pointer select-none",
        className
      )}
      {...props}
    >
      {children}
      {sortDirection && (
        <span className="sr-only">
          {sortDirection === 'ascending' ? ', sorted ascending' :
           sortDirection === 'descending' ? ', sorted descending' :
           ', not sorted'}
        </span>
      )}
    </th>
  )
)
AccessibleTableHead.displayName = "AccessibleTableHead"

interface AccessibleTableCellProps extends React.TdHTMLAttributes<HTMLTableCellElement> {
  /** Whether this cell is a row header */
  isRowHeader?: boolean;
  /** Column index for aria-colindex (1-based) */
  colIndex?: number;
}

const AccessibleTableCell = React.forwardRef<HTMLTableCellElement, AccessibleTableCellProps>(
  ({ className, isRowHeader = false, colIndex, ...props }, ref) => {
    const Component = isRowHeader ? 'th' : 'td'
    return (
      <Component
        ref={ref as React.Ref<HTMLTableCellElement>}
        role={isRowHeader ? "rowheader" : "cell"}
        scope={isRowHeader ? "row" : undefined}
        aria-colindex={colIndex}
        className={cn("p-4 align-middle [&:has([role=checkbox])]:pr-0", className)}
        {...props}
      />
    )
  }
)
AccessibleTableCell.displayName = "AccessibleTableCell"

const AccessibleTableCaption = React.forwardRef<
  HTMLTableCaptionElement,
  React.HTMLAttributes<HTMLTableCaptionElement>
>(({ className, ...props }, ref) => (
  <caption
    ref={ref}
    className={cn("mt-4 text-sm text-muted-foreground", className)}
    {...props}
  />
))
AccessibleTableCaption.displayName = "AccessibleTableCaption"

export {
  AccessibleTable,
  AccessibleTableHeader,
  AccessibleTableBody,
  AccessibleTableFooter,
  AccessibleTableHead,
  AccessibleTableRow,
  AccessibleTableCell,
  AccessibleTableCaption,
}
