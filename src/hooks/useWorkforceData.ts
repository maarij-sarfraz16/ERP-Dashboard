import type { WorkforceApiResponse } from "../data/mockData";
import { fetchWorkforceData } from "../api/workforceApi";
import { useLiveData, type LiveDataState } from "./useLiveData";

export function useWorkforceData(): LiveDataState<WorkforceApiResponse> {
  return useLiveData(fetchWorkforceData);
}
