import type { ExpenseClaimReport } from "../data/expenseClaimData";
import { fetchExpenseClaims } from "../api/expenseClaimApi";
import { useLiveData, type LiveDataState } from "./useLiveData";

export function useExpenseClaims(): LiveDataState<ExpenseClaimReport> {
  return useLiveData(fetchExpenseClaims);
}
