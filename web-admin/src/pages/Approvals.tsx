import { useState } from "react";

type ApprovalItem = {
  id: string;
  farmer: string;
  approved: boolean;
};

export const initialApprovalItems: ApprovalItem[] = [
  { id: "sub-401", farmer: "Mwanza Plot Cooperative", approved: false },
  { id: "sub-402", farmer: "Kiboga Export Group", approved: false },
];

export function approveItem(items: ApprovalItem[], id: string): ApprovalItem[] {
  return items.map((entry) => (entry.id === id ? { ...entry, approved: true } : entry));
}

export function Approvals() {
  const [items, setItems] = useState(initialApprovalItems);

  return (
    <section className="card">
      <h2>Submission Approvals</h2>
      <ul className="stack-list">
        {items.map((item) => (
          <li key={item.id} className="row">
            <div>
              <strong>{item.farmer}</strong>
              <p className="status">{item.id}</p>
            </div>
            {item.approved ? (
              <span className="pill approved">Approved</span>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setItems((current) => approveItem(current, item.id));
                }}
              >
                Approve
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
