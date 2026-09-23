import type { LoanReport } from "../data/loanData";
import { fetchLoanReport } from "../api/loanApi";
import { useLiveData, type LiveDataState } from "./useLiveData";

export function useLoanReport(): LiveDataState<LoanReport> {
  return useLiveData(fetchLoanReport);
}
