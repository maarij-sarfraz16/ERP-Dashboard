import { fetchHeadcountData, type HeadcountData } from "../api/headcountApi";
import { useLiveData, type LiveDataState } from "./useLiveData";

export function useHeadcountData(): LiveDataState<HeadcountData> {
  return useLiveData(fetchHeadcountData);
}
