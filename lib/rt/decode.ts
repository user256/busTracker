import GtfsRealtimeBindings from "gtfs-realtime-bindings";

const { FeedMessage } = GtfsRealtimeBindings.transit_realtime;

export type DecodedFeed = {
  headerTimestamp: Date | null;
  entities: ReturnType<typeof FeedMessage.decode>["entity"];
};

export function decodeFeedMessage(buf: Buffer): DecodedFeed {
  const msg = FeedMessage.decode(buf);
  const ts = msg.header?.timestamp
    ? new Date(Number(msg.header.timestamp) * 1000)
    : null;
  return { headerTimestamp: ts, entities: msg.entity ?? [] };
}
