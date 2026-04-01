const scheduledVisits = [
  { id: "V-220", zone: "North Valley", officer: "A. Okumu", slot: "09:00" },
  { id: "V-221", zone: "West Ridge", officer: "S. Nakitto", slot: "11:30" },
];

export function Visits() {
  return (
    <section className="card">
      <h2>Upcoming Field Visits</h2>
      <ul className="stack-list">
        {scheduledVisits.map((visit) => (
          <li key={visit.id} className="row">
            <div>
              <strong>{visit.zone}</strong>
              <p className="status">
                {visit.id} - {visit.officer}
              </p>
            </div>
            <span className="pill">{visit.slot}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
