export type TraceStatus = "created" | "in_transit" | "received" | "rejected";

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export interface TraceEvent {
  id: string;
  timestamp: string;
  actor: string;
  status: TraceStatus;
  note?: string;
  location?: GeoPoint;
}

export interface TraceRecord {
  traceId: string;
  productId: string;
  status: TraceStatus;
  events: TraceEvent[];
}

export function createEmptyTraceRecord(traceId: string, productId: string): TraceRecord {
  return {
    traceId,
    productId,
    status: "created",
    events: []
  };
}
