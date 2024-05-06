import path from "node:path";
import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";
import prand from "pure-rand";
import * as rxjs from "rxjs";
import { Observable } from "rxjs";

import { ProtoGrpcType } from "./proto/cinema";
import { Empty } from "./proto/cinema/Empty";
import { Film } from "./proto/cinema/Film";
import { Films } from "./proto/cinema/Films";
import { Screening } from "./proto/cinema/Screening";
import { Screenings } from "./proto/cinema/Screenings";
import { SeatType } from "./proto/cinema/SeatType";
import {
  GetFilmScreeningsRequest
} from "./proto/cinema/GetFilmScreeningsRequest";
import { SubscribeScreeningsRequest } from "./proto/cinema/SubscribeScreeningsRequest";


const films: Film[] = [
  {
    id: 1,
    name: "Dune: Part One",
    durationSec: 9326,
  },
  {
    id: 2,
    name: "Dune: Part Two",
    durationSec: 9937,
  },
  {
    id: 3,
    name: "Star Wars: The Rise of Skywalker",
    durationSec: 8460,
  },
];

const screening: Screening = {
  id: 1,
  filmId: 2,
  startDate: {
    seconds: 1714909069,
  },
  endDate: {
    seconds: 1714920206,
  },
  venue: {
    id: 1,
    maximumSeatsCount: 3,
    purchasedSeatsCount: 0,
    seats: [
      {
        id: 1,
        type: SeatType.STANDARD,
        purchased: false,
      },
      {
        id: 2,
        type: SeatType.STANDARD,
        purchased: false,
      },
      {
        id: 3,
        type: SeatType.STANDARD,
        purchased: false,
      },
    ],
  },
};

const screenings: {
  byFilmId: Record<number, Screening[]>;
  byVenueId: Record<number, Screening[]>;
} = {
  byFilmId: {
    1: [],
    2: [ screening ],
    3: [],
  },
  byVenueId: {
    1: [ screening ],
    2: [],
    3: [],
  },
};

const screeningObservables: {
  byFilmId: Record<number, Observable<Screening>>;
  byVenueId: Record<number, Observable<Screening>>;
} = {
  byFilmId: {
    1: rxjs.from(screenings.byFilmId[1]),
    2: rxjs.from(screenings.byFilmId[2]),
    3: rxjs.from(screenings.byFilmId[3]),
  },
  byVenueId: {
    1: rxjs.from(screenings.byVenueId[1]),
    2: rxjs.from(screenings.byVenueId[2]),
    3: rxjs.from(screenings.byVenueId[3]),
  },
};

const screeningSubjects: {
  byFilmId: Record<number, rxjs.Subject<Screening>>;
  byVenueId: Record<number, rxjs.Subject<Screening>>;
} = {
  byFilmId: {
    1: new rxjs.Subject(),
    2: new rxjs.Subject(),
    3: new rxjs.Subject(),
  },
  byVenueId: {
    1: new rxjs.Subject(),
    2: new rxjs.Subject(),
    3: new rxjs.Subject(),
  },
};

const SEED = 31;
const generator = prand.xoroshiro128plus(SEED);

const PORT = 50051;
const PROTO_CINEMA_FILE = "../../proto/cinema.proto";

const packageDefinition = protoLoader.loadSync(
  path.resolve(__dirname, PROTO_CINEMA_FILE));
const grpcObject = grpc.loadPackageDefinition(
  packageDefinition) as unknown as ProtoGrpcType;
const cinemaPackage = grpcObject.cinema;

function main() {
  const grpcOptions = {
    "grpc.keepalive_time_ms": 10000,
    "grpc.keepalive_timeout_ms": 10000,
    "grpc.keepalive_permit_without_calls": 1,
    "grpc.http2_max_pings_without_data": 0,
  };

  const server = new grpc.Server(grpcOptions);
  server.addService(cinemaPackage.Cinema.service, {
    getFilms,
    getFilmScreenings,
    subscribeScreenings,
  });

  const socket = `0.0.0.0:${PORT}`,
        credentials = grpc.ServerCredentials.createInsecure();

  server.bindAsync(socket, credentials, (error, port) => {
    if (error) {
      console.error(error);
      return;
    }

    console.log(`Server has successfully started on port ${port}`);

    for (const filmId in screeningObservables.byFilmId) {
      screeningObservables.byFilmId[filmId]
        .subscribe(screeningSubjects.byFilmId[filmId]);
    }
    for (const venueId in screeningObservables.byVenueId) {
      screeningObservables.byVenueId[venueId]
        .subscribe(screeningSubjects.byVenueId[venueId]);
    }

    addScreeningCoroutine(2500);
    purchaseSeatCoroutine(1500);
  });
}

function getFilms (
  _: grpc.ServerUnaryCall<Empty, Films>,
  send: grpc.sendUnaryData<Films>
) {
  console.log("| getFilms |");

  send(null, { films });
}

function getFilmScreenings(
  call: grpc.ServerUnaryCall<GetFilmScreeningsRequest, Screenings>,
  send: grpc.sendUnaryData<Screenings>
) {
  console.log(`| getFilmScreenings, filmId = ${call.request.filmId } |`);

  if (typeof call.request.filmId !== "number") {
    const errorMessage = "'filmId' is not a number";
    console.error(errorMessage);
    send({
      code: grpc.status.INVALID_ARGUMENT,
      message: errorMessage,
    });
    return;
  }

  const filmId = call.request.filmId;

  send(null, { screenings: screenings.byFilmId[filmId] });
}

function subscribeScreenings(
  stream: grpc.ServerWritableStream<SubscribeScreeningsRequest, Screenings>
) {
  console.log("| subscribeScreenings |");

  const { request } = stream;

  if (request.filmIds == undefined && request.venueIds == undefined) {
    const errorMessage = "'filmIds' and 'venueIds' are undefined";
    console.error(errorMessage);
    stream.emit("error", {
      code: grpc.status.INVALID_ARGUMENT,
      message: errorMessage,
    });
    return;
  }

  const filmIds = stream.request.filmIds ?? [],
        venueIds = stream.request.venueIds ?? [];

  for (const filmId of filmIds) {
    stream.write({ screenings: screenings.byFilmId[filmId] });

    let lastScreeningsCount = screenings.byFilmId[filmId].length;
    setInterval(() => {
      if (lastScreeningsCount === screenings.byFilmId[filmId].length) {
        return;
      }

      stream.write({
        screenings: screenings.byFilmId[filmId]
          .slice(lastScreeningsCount, screenings.byFilmId[filmId].length),
      });
      lastScreeningsCount = screenings.byFilmId[filmId].length;
    }, 1000);
  }
  for (const venueId of venueIds) {
    stream.write({ screenings: screenings.byVenueId[venueId] });

    let lastScreeningsCount = screenings.byVenueId[venueId].length;
    setInterval(() => {
      if (lastScreeningsCount === screenings.byVenueId[venueId].length) {
        return;
      }

      stream.write({
        screenings: screenings.byVenueId[venueId]
          .slice(lastScreeningsCount, screenings.byVenueId[venueId].length),
      });
      lastScreeningsCount = screenings.byVenueId[venueId].length;
    }, 1000);
  }
}

function addScreeningCoroutine(intervalMsec: number) {
  setInterval(() => {
    const filmId    = prand.unsafeUniformIntDistribution(1, 3, generator),
          venueId   = prand.unsafeUniformIntDistribution(1, 3, generator),
          startDate = prand.unsafeUniformIntDistribution(
            1714909069, 1715177600, generator);
    const screening: Screening = {
      id: prand.unsafeUniformIntDistribution(1, 3, generator),
      filmId,
      startDate: {
        seconds: startDate,
      },
      endDate: {
        seconds: startDate + (films[filmId - 1].durationSec as number) + 1200,
      },
      venue: {
        id: venueId,
        maximumSeatsCount: 3,
        purchasedSeatsCount: 0,
        seats: [
          {
            id: 1,
            type: prand.unsafeUniformIntDistribution(
              0, 2, generator) as SeatType,
            purchased: false,
          },
          {
            id: 2,
            type: prand.unsafeUniformIntDistribution(
              0, 2, generator) as SeatType,
            purchased: false,
          },
          {
            id: 3,
            type: SeatType.STANDARD,
            purchased: false,
          },
        ],
      },
    };

    screenings.byFilmId[filmId].push(screening);
    screeningSubjects.byFilmId[filmId].next(screening);
    screenings.byVenueId[venueId].push(screening);
    screeningSubjects.byVenueId[venueId].next(screening);
  }, intervalMsec);
}

function purchaseSeatCoroutine(intervalMsec: number) {
  setInterval(() => {
    const availableScreenings: Screening[] = [];
    for (const filmId in screenings.byFilmId) {
      for (const screening of screenings.byFilmId[filmId]) {
        const purchasedSeatsCount
          = screening.venue?.purchasedSeatsCount ?? Infinity;
        const maximumSeatsCount = screening.venue?.maximumSeatsCount ?? 0;
        if (purchasedSeatsCount < maximumSeatsCount) {
          availableScreenings.push(screening);
        }
      }
    }

    const randomScreeningIndex = prand.unsafeUniformIntDistribution(
      0, availableScreenings.length - 1, generator);
    const screening = availableScreenings[randomScreeningIndex];

    if (
      !Array.isArray(screening.venue?.seats)
      || screening.venue?.purchasedSeatsCount == undefined
    ) {
      return;
    }

    screening.venue.seats.filter(seat => !seat.purchased)[0].purchased = true;
    screening.venue.purchasedSeatsCount++;
  }, intervalMsec);
}

main();
