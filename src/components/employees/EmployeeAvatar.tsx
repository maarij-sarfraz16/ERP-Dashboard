import { useEffect, useState } from "react";
import type { Employee } from "../../data/employeeData";

/**
 * Round employee avatar. Shows the photo on file in Frappe when there is one;
 * falls back to initials on the department colour only when no photo exists
 * or the file fails to load (missing on disk, or private and unauthenticated
 * in a production build — see `frappeFileUrl`).
 */
export function EmployeeAvatar({
  employee,
  color,
}: {
  employee: Pick<Employee, "name" | "initials" | "photoUrl">;
  color: string;
}) {
  const [broken, setBroken] = useState(false);
  // A row's employee can change when the list is filtered; retry the new photo.
  useEffect(() => setBroken(false), [employee.photoUrl]);

  const showPhoto = Boolean(employee.photoUrl) && !broken;

  return (
    <span className={`emp-avatar${showPhoto ? " has-photo" : ""}`} style={{ background: color }}>
      {showPhoto ? (
        <img
          src={employee.photoUrl ?? undefined}
          alt={employee.name}
          loading="lazy"
          decoding="async"
          onError={() => setBroken(true)}
        />
      ) : (
        employee.initials
      )}
    </span>
  );
}
