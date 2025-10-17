import os
import random
import sys
import time
from typing import Dict, Iterable, Optional, Sequence, Tuple, Type

import click
import serial
from serial.tools import list_ports
from serial.tools.list_ports_common import ListPortInfo

from rradio.packet import (
    BotCommandPacket,
    BotStatusPacket,
    DisplayPacket,
    HereIAmPacket,
    RadioPacket,
    parse_hex,
)


DEFAULT_COUNT = 10
DEFAULT_INTERVAL = .25
PACKET_SIZE = 32
RESPONSE_TIMEOUT = 2.0
CMD_SEND = "s:"
CMD_RECEIVE = "r:"


StructuredPacketInfo = Tuple[
    Type[RadioPacket],
    Tuple[str, ...],
]


STRUCTURED_PACKET_CLASSES: Sequence[StructuredPacketInfo] = (
    (
        BotCommandPacket,
        (
            "packet_type",
            "time",
            "serial",
            "command_type",
            "motor1",
            "motor2",
            "motor3",
            "motor4",
            "duration",
        ),
    ),
    (
        BotStatusPacket,
        (
            "packet_type",
            "time",
            "serial",
            "buttons",
            "accel_x",
            "accel_y",
            "accel_z",
        ),
    ),
    (
        DisplayPacket,
        (
            "packet_type",
            "time",
            "serial",
            "tone",
            "duration",
            "image",
            "head_lamp_left",
            "head_lamp_right",
            "neo_left",
            "neo_right",
        ),
    ),
    (
        HereIAmPacket,
        (
            "packet_type",
            "time",
            "serial",
            "class_id",
            "group",
            "channel",
            "flags",
            "image",
        ),
    ),
)


def usb_serial_ports() -> Iterable[ListPortInfo]:
    for port in list_ports.comports():
        if port.vid is None:
            continue
        yield port


def resolve_device(path: Optional[str]) -> Optional[str]:
    if path:
        return path

    ports = list(usb_serial_ports())
    if not ports:
        click.echo("No USB serial ports detected. Use --device to select one.", err=True)
        return None

    click.echo("Available USB serial ports:")
    render_port_table(ports)

    for port in ports:
        text = " ".join(
            filter(
                None,
                [
                    port.description,
                    getattr(port, "product", None),
                    getattr(port, "manufacturer", None),
                    port.name,
                ],
            )
        )
        if "micro:bit" in text.lower():
            click.echo(f"Selecting {port.device}")
            return port.device

    click.echo(
        "No micro:bit device detected. Use --device to choose one.",
        err=True,
    )
    return None


def random_int32() -> int:
    return random.randint(-(1 << 31), (1 << 31) - 1)


def random_uint32() -> int:
    return random.getrandbits(32)


def random_int16() -> int:
    return random.randint(-(1 << 15), (1 << 15) - 1)


def random_uint16() -> int:
    return random.randint(0, 0xFFFF)


def random_uint8() -> int:
    return random.randint(0, 0xFF)


def random_color24() -> int:
    return random.randint(0, 0xFFFFFF)


def generate_payload(index: int, randomize: bool) -> bytes:
    if randomize:
        return os.urandom(PACKET_SIZE)

    data = bytearray(PACKET_SIZE)
    data[0] = index & 0xFF
    data[1] = (index >> 8) & 0xFF
    data[2] = (index >> 16) & 0xFF
    data[3] = (index >> 24) & 0xFF
    return bytes(data)


def pump_serial(port: serial.Serial, duration: float) -> None:
    if duration <= 0:
        duration = 0
    deadline = time.monotonic() + duration
    while True:
        line = port.readline()
        if line:
            text = line.decode("utf-8", errors="replace").rstrip("\r\n")
            if text:
                click.echo(f"<< {text}")
            continue

        if time.monotonic() >= deadline:
            break
    time.sleep(0.05)


def send_packets(
    port: serial.Serial,
    count: int,
    interval: float,
    randomize: bool,
    words: Optional[str],
) -> None:
    click.echo(
        f"Sending {count} packet(s) every {interval:.3f}s with "
        f"{'random' if randomize else 'pattern'} payloads."
    )
    pump_serial(port, 0.2)


    for index in range(count):
        if words:
            payload_hex = words + words
        else:
            payload = generate_payload(index, randomize)
            payload_hex = payload.hex()

        command = f"{CMD_SEND} {payload_hex}"
        port.write(command.encode("ascii") + b"\n")
        port.flush()
        click.echo(f">> {command}")

        wait = interval if index < count - 1 else 0.5
        pump_serial(port, wait)


def wait_for_response(port: serial.Serial, prefix: str, timeout: float) -> Optional[str]:
    deadline = time.monotonic() + timeout
    while True:
        if time.monotonic() >= deadline:
            return None
        line = port.readline()
        if not line:
            time.sleep(0.05)
            continue
        text = line.decode("utf-8", errors="replace").rstrip("\r\n")
        if not text:
            continue
        click.echo(f"<< {text}")
        if text.startswith(prefix):
            _, _, rest = text.partition(" ")
            if rest:
                return rest.strip() or None
            return text[len(prefix):].strip() or None


def random_structured_packet(packet_cls: Type[RadioPacket]) -> RadioPacket:
    if packet_cls is BotCommandPacket:
        return BotCommandPacket(
            command_type=random_uint8(),
            motor1=random_int16(),
            motor2=random_int16(),
            motor3=random_int16(),
            motor4=random_int16(),
            duration=random_int16(),
            time=random_int32(),
            serial=random_int32(),
        )
    if packet_cls is BotStatusPacket:
        return BotStatusPacket(
            buttons=random_uint8(),
            accel_x=random_int16(),
            accel_y=random_int16(),
            accel_z=random_int16(),
            time=random_int32(),
            serial=random_int32(),
        )
    if packet_cls is DisplayPacket:
        return DisplayPacket(
            tone=random_uint8(),
            duration=random_uint8(),
            image=random_uint32(),
            head_lamp_left=random_color24(),
            head_lamp_right=random_color24(),
            neo_left=random_color24(),
            neo_right=random_color24(),
            time=random_int32(),
            serial=random_int32(),
        )
    if packet_cls is HereIAmPacket:
        return HereIAmPacket(
            class_id=random_uint8(),
            group=random_uint16(),
            channel=random_uint16(),
            flags=random_uint16(),
            image=random_uint32(),
            time=random_int32(),
            serial=random_int32(),
        )
    raise ValueError(f"Unsupported packet class {packet_cls!r}")


def compare_packet_fields(
    expected: RadioPacket,
    actual: RadioPacket,
    fields: Sequence[str],
) -> Dict[str, Tuple[object, object]]:
    mismatches: Dict[str, Tuple[object, object]] = {}
    for field in fields:
        lhs = getattr(expected, field)
        rhs = getattr(actual, field)
        if lhs != rhs:
            mismatches[field] = (lhs, rhs)
    return mismatches


def send_structured_packets(port: serial.Serial, count: int, interval: float) -> None:
    click.echo(
        f"Sending structured packets for {count} iteration(s), "
        "covering all known payload types."
    )
    pump_serial(port, 0.2)

    for iteration in range(count):
        click.echo(f"Iteration {iteration + 1}/{count}")
        for packet_cls, fields in STRUCTURED_PACKET_CLASSES:
            packet = random_structured_packet(packet_cls)
            payload_hex = packet.to_hex()
            command = f"{CMD_SEND} {payload_hex}"
            port.write(command.encode("ascii") + b"\n")
            port.flush()
            click.echo(f">> {command}")

            response_hex = wait_for_response(port, CMD_RECEIVE, RESPONSE_TIMEOUT)
            if response_hex is None:
                raise click.ClickException(
                    f"Timed out waiting for echoed packet for {packet_cls.__name__}."
                )

            received = parse_hex(response_hex)
            if not isinstance(received, packet_cls):
                raise click.ClickException(
                    f"Expected {packet_cls.__name__} echo, got {type(received).__name__}."
                )

            mismatches = compare_packet_fields(packet, received, fields)
            if mismatches:
                details = ", ".join(
                    f"{name} sent={sent!r} received={got!r}"
                    for name, (sent, got) in mismatches.items()
                )
                raise click.ClickException(
                    f"Field mismatch for {packet_cls.__name__}: {details}"
                )

            click.echo(f"Validated {packet_cls.__name__} ({payload_hex})")

            if interval > 0:
                time.sleep(interval)


def render_port_table(ports: Iterable[ListPortInfo]) -> None:
    ports = list(ports)
    if not ports:
        click.echo("No USB serial ports found.")
        return

    header = f"{'Path':<24} {'Name':<12} Description"
    click.echo(header)
    click.echo("-" * len(header))
    for port in ports:
        name = port.name or "-"
        description = port.description or "-"
        click.echo(f"{port.device:<24} {name:<12} {description}")


@click.command()
@click.option(
    "--list",
    "list_only",
    "-l",
    is_flag=True,
    help="List available USB serial ports and exit.",
)
@click.option(
    "--device",
    "-d",
    type=str,
    help="Serial device path (auto-selects when exactly one USB device is present).",
)
@click.option(
    "--count",
    "-c",
    default=DEFAULT_COUNT,
    show_default=True,
    help="Number of packets to send.",
)
@click.option(
    "--time",
    "interval",
    "-t",
    default=DEFAULT_INTERVAL,
    show_default=True,
    help="Seconds between packets.",
)
@click.option(
    "--rand",
    "-r",
    is_flag=True,
    help="Send random 32-byte payloads.",
)
@click.option(
    "--words",
    "-w",
    is_flag=True,
    help="Send words in hex",
)
@click.option(
    "--packets",
    "-p",
    is_flag=True,
    help="Send random structured packets for each payload type and verify the echoed response.",
)
def main(
    list_only: bool,
    device: Optional[str],
    count: int,
    interval: float,
    rand: bool,
    words: bool,
    packets: bool,
) -> None:

    hex_words= 'deadbeefcafefoodbabe8badf00dd00dface'

    if list_only:
        render_port_table(usb_serial_ports())
        return

    if count <= 0:
        click.echo("--count must be a positive integer.", err=True)
        sys.exit(2)

    if interval < 0:
        click.echo("--time must be zero or positive.", err=True)
        sys.exit(2)

    if packets and (rand or words):
        click.echo("--packets may not be combined with --rand or --words.", err=True)
        sys.exit(2)

    resolved = resolve_device(device)
    if not resolved:
        sys.exit(2)

    try:
        with serial.Serial(resolved, baudrate=115200, timeout=0.1) as port:
            click.echo(f"Opened {resolved} @ {port.baudrate} baud")
            port.reset_input_buffer()
            if packets:
                send_structured_packets(port, count, interval)
            else:
                send_packets(port, count, interval, rand, hex_words if words else None)
    except serial.SerialException as exc:  # pragma: no cover - hardware dependent
        click.echo(f"Failed to open serial port: {exc}", err=True)
        sys.exit(1)


if __name__ == "__main__":
    main()


if __name__ == "__main__":
    main()
