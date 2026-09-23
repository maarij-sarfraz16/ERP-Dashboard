import { useState } from "react";
import type { HeadcountEmployee } from "../../api/headcountApi";
import { cleanDepartment, initialsOf } from "../../api/frappeMappers";
import { fmtDate } from "./hcShared";

/** Keyed by photo URL at the call site, so a new photo retries after a broken one. */
function Avatar({ person }: { person: HeadcountEmployee }) {
  const [broken, setBroken] = useState(false);
  return (
    <span className="hc-avatar">
      {person.photoUrl && !broken ? (
        <img src={person.photoUrl} alt="" loading="lazy" onError={() => setBroken(true)} />
      ) : (
        initialsOf(person.name)
      )}
    </span>
  );
}

/** Employees who joined / left inside the window, newest first. */
export function PeopleList({
  people,
  dateOf,
  detailOf,
  empty,
}: {
  people: HeadcountEmployee[];
  dateOf: (e: HeadcountEmployee) => string;
  detailOf?: (e: HeadcountEmployee) => string;
  empty: string;
}) {
  if (people.length === 0) return <div className="hc-empty hc-empty-soft">{empty}</div>;
  return (
    <ul className="hc-people">
      {people.map((p) => (
        <li key={p.id}>
          <Avatar key={p.photoUrl ?? ""} person={p} />
          <span className="hc-people-main">
            <b>{p.name}</b>
            <small>
              #{p.id} · {p.designation || "—"} · {cleanDepartment(p.department)}
            </small>
            {detailOf?.(p) && <small className="hc-people-detail">{detailOf(p)}</small>}
          </span>
          <span className="hc-people-date">{fmtDate(dateOf(p))}</span>
        </li>
      ))}
    </ul>
  );
}
