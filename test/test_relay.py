import os
import sys
import time
from typing import Iterable, Optional

import click
import serial
from serial.tools import list_ports
from serial.tools.list_ports_common import ListPortInfo


DEFAULT_COUNT = 10
DEFAULT_INTERVAL = 2.0
PACKET_SIZE = 32
CMD_SEND = "s:"


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


def send_packets(port: serial.Serial, count: int, interval: float, randomize: bool, words: bool | str) -> None:
    click.echo(
        f"Sending {count} packet(s) every {interval:.3f}s with "
        f"{'random' if randomize else 'pattern'} payloads."
    )
    pump_serial(port, 0.2)


    for index in range(count):
        if words:
            payload_hex = words+words
        else:
            payload = generate_payload(index, randomize)
            payload_hex = payload.hex()

        command = f"{CMD_SEND} {payload_hex}"
        port.write(command.encode("ascii") + b"\n")
        port.flush()
        click.echo(f">> {command}")

        wait = interval if index < count - 1 else 0.5
        pump_serial(port, wait)


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
def main(
    list_only: bool,
    device: Optional[str],
    count: int,
    interval: float,
    rand: bool,
    words: bool,
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

    resolved = resolve_device(device)
    if not resolved:
        sys.exit(2)

    try:
        with serial.Serial(resolved, baudrate=115200, timeout=0.1) as port:
            click.echo(f"Opened {resolved} @ {port.baudrate} baud")
            port.reset_input_buffer()
            send_packets(port, count, interval, rand, hex_words if words else None)
    except serial.SerialException as exc:  # pragma: no cover - hardware dependent
        click.echo(f"Failed to open serial port: {exc}", err=True)
        sys.exit(1)


if __name__ == "__main__":
    main()


if __name__ == "__main__":
    main()
