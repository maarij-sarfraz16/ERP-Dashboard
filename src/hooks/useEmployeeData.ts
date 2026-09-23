import type { EmployeeApiResponse } from "../data/employeeData";
import { fetchEmployeeData } from "../api/employeeApi";
import { useLiveData, type LiveDataState } from "./useLiveData";

export function useEmployeeData(): LiveDataState<EmployeeApiResponse> {
  return useLiveData(fetchEmployeeData);
}
