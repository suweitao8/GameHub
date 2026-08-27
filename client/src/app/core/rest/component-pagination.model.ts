export interface ComponentPagination {
  currentPage: number
  itemsPerPage: number
  totalItems: number
  itemsRemoved?: number
}

export type ComponentPaginationLight = Omit<ComponentPagination, 'totalItems'> & { totalItems?: number }
