from __future__ import annotations
import sys
import time
from typing import Optional, Literal
import grpc

sys.path.append("proto")
from proto.cinema_pb2_grpc import CinemaStub
from proto.cinema_pb2 import (
    Empty,
    GetFilmScreeningsRequest,
    SubscribeScreeningsRequest,
)

PORT = 50051
EXIT = 1


def execute_command(
        command: str,
        argument: Optional[str],
        stub: CinemaStub
) -> int | None:
    match command:
        case "films":
            response = stub.GetFilms(Empty())
            print(response.films)
        case "screenings":
            try:
                film_id = int(argument)
            except ValueError as error:
                print(error)
                return

            request = GetFilmScreeningsRequest(film_id=film_id)
            response = stub.GetFilmScreenings(request)
            print(response.screenings)
        case "subscribe":
            film_ids = read_ids("film")
            venue_ids = read_ids("venue")

            request = SubscribeScreeningsRequest(
                film_ids=film_ids,
                venue_ids=venue_ids
            )
            responses = stub.SubscribeScreenings(request)
            for response in responses:
                print(response.screenings)
        case "exit":
            print("exit command, goodbye! =)")
            return EXIT
        case _:
            print(f"Unknown command '{command}'")


def read_ids(
        ids_type: Literal["film", "venue"]
) -> list[int] | None:
    print(f"    Enter {ids_type} identifiers (empty line stops the reading)")
    ids: list[int] = []
    while True:
        try:
            user_input = input("    >>> ")
            if user_input == "":
                break

            try:
                identifier = int(user_input)
                ids.append(identifier)
            except ValueError as error:
                print(error)
                return

        except EOFError:
            print("EOF, don't do it again =(")
            return

    return ids if len(ids) > 0 else None


def run():
    grpc_options = (
        ("grpc.keepalive_time_ms", 10000),
        ("grpc.keepalive_timeout_ms", 10000),
        ("grpc.keepalive_permit_without_calls", 1),
        ("grpc.http2_max_pings_without_data", 0),
    )

    socket = f"localhost:{PORT}"
    with grpc.insecure_channel(
            socket,
            grpc_options
    ) as channel:
        stub = CinemaStub(channel)

        while True:
            try:
                split_input = input(">>> ").split(" ")
                command = split_input[0]
                argument = None
                if len(split_input) > 1:
                    argument = split_input[1]

                if execute_command(command, argument, stub) == EXIT:
                    break

            except EOFError:
                print("EOF, goodbye! =)")
                break
            except Exception:
                time.sleep(1)


if __name__ == '__main__':
    run()
