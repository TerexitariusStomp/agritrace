type TimelineItem = {
  at: string
  label: string
  detail?: string
}

type TimelineProps = {
  items: TimelineItem[]
}

function formatTimestamp(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toLocaleString('en-GB', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

export function Timeline({ items }: TimelineProps) {
  if (items.length === 0) {
    return <p>No timeline events available.</p>
  }

  return (
    <ol className="timeline">
      {items.map((item) => (
        <li key={`${item.at}-${item.label}`} className="timeline-item">
          <p className="timeline-label">{item.label}</p>
          <p className="timeline-time">{formatTimestamp(item.at)}</p>
          {item.detail ? <p className="timeline-detail">{item.detail}</p> : null}
        </li>
      ))}
    </ol>
  )
}

export type { TimelineItem }
