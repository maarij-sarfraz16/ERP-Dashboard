import type { AttendanceStatus, PayrollRunStatus } from "../../data/mockData";

const ATTENDANCE_LABEL: Record<AttendanceStatus, string> = {
  "on-time": "On time",
  late: "Late",
  "half-day": "Half day",
  absent: "Absent",
  holiday: "Holiday",
};

const ATTENDANCE_CLASS: Record<AttendanceStatus, string> = {
  "on-time": "good",
  late: "late",
  "half-day": "processing",
  absent: "absent",
  holiday: "pending",
};

export function AttendanceStatusBadge({ status }: { status: AttendanceStatus }) {
  return (
    <span className={`status-pill ${ATTENDANCE_CLASS[status]}`}>
      <span className="dot" />
      {ATTENDANCE_LABEL[status]}
    </span>
  );
}

const RUN_LABEL: Record<PayrollRunStatus, string> = {
  completed: "Completed",
  processing: "Processing",
  pending: "Pending",
};

const RUN_CLASS: Record<PayrollRunStatus, string> = {
  completed: "done",
  processing: "processing",
  pending: "pending",
};

export function PayrollRunBadge({ status }: { status: PayrollRunStatus }) {
  return (
    <span className={`status-pill ${RUN_CLASS[status]}`}>
      <span className="dot" />
      {RUN_LABEL[status]}
    </span>
  );
}
