import type { ReimbursementWithDepartment } from "./types";
export interface DetailFilters { from: string; to: string; min: string; max: string; category: string; }
export const emptyDetailFilters: DetailFilters = { from: "", to: "", min: "", max: "", category: "" };
export function filterDetails(items: ReimbursementWithDepartment[], filters: DetailFilters) {
  return items.filter(item => (!filters.from || item.date >= filters.from) && (!filters.to || item.date <= filters.to)
    && (!filters.min || item.amount >= Number(filters.min)) && (!filters.max || item.amount <= Number(filters.max))
    && (!filters.category || item.category === filters.category));
}
