const queue = [
  { id: "AI-901", summary: "Geo-tag mismatch on harvest claim", risk: "High" },
  { id: "AI-902", summary: "Duplicate invoice pattern", risk: "Medium" },
];

export function AIModeration() {
  return (
    <section className="card">
      <h2>AI Moderation Queue</h2>
      <ul className="stack-list">
        {queue.map((item) => (
          <li key={item.id} className="row">
            <div>
              <strong>{item.summary}</strong>
              <p className="status">{item.id}</p>
            </div>
            <span className="pill">{item.risk}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
