// Head Count page: the whole Employee roster (every status) plus one day of
// per-employee attendance, read straight from Frappe. Nothing is aggregated
// server-side here on purpose — the page's four filters (status, department,
// reason for exit, marital status) must apply to every panel, including the
// attendance summary, so the rows are joined and counted in the browser.
// ~2.3k employees and one day of attendance is small enough for that.

import { frappeFileUrl, getList } from "./frappeClient";
import { fetchAttendanceDaySummary } from "./attendanceDay";

export interface HeadcountEmployee {
  id: string;
  name: string;
  photoUrl: string | null;
  /** Raw Frappe values, trimmed; `""` where the field is blank. */
  status: string;
  department: string;
  designation: string;
  gender: string;
  maritalStatus: string;
  salaryMode: string;
  bankName: string;
  reasonForLeaving: string;
  dateOfJoining: string;
  relievingDate: string;
}

export interface HeadcountData {
  employees: HeadcountEmployee[];
  /**
   * The attendance day summarised: yesterday in the Frappe site's time zone,
   * the same day the Overview tiles and the ATS main dashboard describe.
   */
  attendanceDate: string | null;
  /**
   * employee id → the `status` of each of their Attendance records on
   * `attendanceDate`. Usually one, but someone who worked two shifts has two,
   * and ATS counts both.
   */
  attendanceByEmployee: Map<string, string[]>;
}

interface RawEmployee {
  name: string;
  employee_name: string | null;
  status: string | null;
  department: string | null;
  designation: string | null;
  gender: string | null;
  marital_status: string | null;
  salary_mode: string | null;
  bank_name: string | null;
  reason_for_leaving: string | null;
  date_of_joining: string | null;
  relieving_date: string | null;
  image: string | null;
}

const clean = (v: string | null | undefined) => (v ?? "").trim();

export async function fetchHeadcountData(): Promise<HeadcountData> {
  const [rawEmployees, { date: attendanceDate }] = await Promise.all([
    getList<RawEmployee>("Employee", {
      fields: [
        "name",
        "employee_name",
        "status",
        "department",
        "designation",
        "gender",
        "marital_status",
        "salary_mode",
        "bank_name",
        "reason_for_leaving",
        "date_of_joining",
        "relieving_date",
        "image",
      ],
      orderBy: "name asc",
      limit: 0,
    }),
    // One definition of "yesterday" for the whole app — see attendanceDay.ts.
    fetchAttendanceDaySummary(),
  ]);

  const attendanceRows = attendanceDate
    ? await getList<{ employee: string; status: string | null }>("Attendance", {
        fields: ["employee", "status"],
        filters: [
          ["attendance_date", "=", attendanceDate],
          ["docstatus", "=", 1],
        ],
        limit: 0,
      })
    : [];

  const attendanceByEmployee = new Map<string, string[]>();
  for (const row of attendanceRows) {
    const list = attendanceByEmployee.get(row.employee) ?? [];
    list.push(clean(row.status));
    attendanceByEmployee.set(row.employee, list);
  }

  const employees: HeadcountEmployee[] = rawEmployees.map((raw) => ({
    id: raw.name,
    name: clean(raw.employee_name) || raw.name,
    photoUrl: frappeFileUrl(raw.image),
    status: clean(raw.status),
    department: clean(raw.department),
    designation: clean(raw.designation),
    gender: clean(raw.gender),
    maritalStatus: clean(raw.marital_status),
    salaryMode: clean(raw.salary_mode),
    bankName: clean(raw.bank_name),
    reasonForLeaving: clean(raw.reason_for_leaving),
    dateOfJoining: clean(raw.date_of_joining),
    relievingDate: clean(raw.relieving_date),
  }));

  return { employees, attendanceDate, attendanceByEmployee };
}
