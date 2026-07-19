import fs from "node:fs";
import path from "node:path";
import GtfsRealtimeBindings from "gtfs-realtime-bindings";

const {
  FeedMessage,
  FeedHeader,
  FeedEntity,
  VehiclePosition,
  Position,
  TripDescriptor,
  VehicleDescriptor,
  TripUpdate,
} = GtfsRealtimeBindings.transit_realtime;

const StopTimeUpdate = TripUpdate.StopTimeUpdate;
const StopTimeEvent = TripUpdate.StopTimeEvent;

const out = path.join(process.cwd(), "fixtures", "gtfs-rt");
fs.mkdirSync(out, { recursive: true });

function write(name: string, msg: ReturnType<typeof FeedMessage.create>) {
  const buf = Buffer.from(FeedMessage.encode(msg).finish());
  fs.writeFileSync(path.join(out, name), buf);
  console.log(name, buf.length);
}

const now = Math.floor(Date.now() / 1000);

write(
  "normal.pb",
  FeedMessage.create({
    header: FeedHeader.create({
      gtfsRealtimeVersion: "2.0",
      timestamp: now,
      incrementality: 0,
    }),
    entity: [
      FeedEntity.create({
        id: "1",
        vehicle: VehiclePosition.create({
          trip: TripDescriptor.create({
            tripId: "T1",
            routeId: "R1",
            startDate: "20260719",
            startTime: "08:00:00",
          }),
          vehicle: VehicleDescriptor.create({ id: "BUS1" }),
          position: Position.create({
            latitude: 51.5074,
            longitude: -0.1278,
            bearing: 90,
            speed: 10,
          }),
          timestamp: now,
          currentStatus: 2,
        }),
      }),
      FeedEntity.create({
        id: "2",
        vehicle: VehiclePosition.create({
          trip: TripDescriptor.create({
            tripId: "T2",
            routeId: "R2",
            startDate: "20260719",
          }),
          vehicle: VehicleDescriptor.create({ id: "BUS2" }),
          position: Position.create({
            latitude: 51.509,
            longitude: -0.134,
            bearing: 180,
            speed: 5,
          }),
          timestamp: now - 5,
        }),
      }),
    ],
  }),
);

write(
  "empty.pb",
  FeedMessage.create({
    header: FeedHeader.create({
      gtfsRealtimeVersion: "2.0",
      timestamp: now,
      incrementality: 0,
    }),
    entity: [],
  }),
);

write(
  "frozen-header.pb",
  FeedMessage.create({
    header: FeedHeader.create({
      gtfsRealtimeVersion: "2.0",
      timestamp: now - 600,
      incrementality: 0,
    }),
    entity: [
      FeedEntity.create({
        id: "1",
        vehicle: VehiclePosition.create({
          vehicle: VehicleDescriptor.create({ id: "BUS1" }),
          position: Position.create({ latitude: 51.5, longitude: -0.12 }),
          timestamp: now - 600,
        }),
      }),
    ],
  }),
);

write(
  "missing-position.pb",
  FeedMessage.create({
    header: FeedHeader.create({
      gtfsRealtimeVersion: "2.0",
      timestamp: now,
      incrementality: 0,
    }),
    entity: [
      FeedEntity.create({
        id: "1",
        vehicle: VehiclePosition.create({
          vehicle: VehicleDescriptor.create({ id: "BUS3" }),
          trip: TripDescriptor.create({ tripId: "T1" }),
          timestamp: now,
        }),
      }),
    ],
  }),
);

fs.writeFileSync(path.join(out, "corrupt.pb"), Buffer.from([0x00, 0x01, 0x02, 0xff, 0xfe]));
console.log("corrupt.pb", 5);

write(
  "tripupdates-normal.pb",
  FeedMessage.create({
    header: FeedHeader.create({
      gtfsRealtimeVersion: "2.0",
      timestamp: now,
      incrementality: 0,
    }),
    entity: [
      FeedEntity.create({
        id: "tu1",
        tripUpdate: TripUpdate.create({
          trip: TripDescriptor.create({
            tripId: "T1",
            startDate: "20260719",
            startTime: "08:00:00",
            routeId: "R1",
          }),
          stopTimeUpdate: [
            StopTimeUpdate.create({
              stopSequence: 1,
              stopId: "S1",
              arrival: StopTimeEvent.create({ delay: 120 }),
              departure: StopTimeEvent.create({ delay: 120 }),
            }),
            StopTimeUpdate.create({
              stopSequence: 2,
              stopId: "S2",
              arrival: StopTimeEvent.create({ time: now + 600 }),
            }),
          ],
          timestamp: now,
        }),
      }),
      FeedEntity.create({
        id: "tu-cancel",
        tripUpdate: TripUpdate.create({
          trip: TripDescriptor.create({
            tripId: "T2",
            startDate: "20260719",
            scheduleRelationship: 3,
          }),
          timestamp: now,
        }),
      }),
    ],
  }),
);

console.log("fixtures ok");
