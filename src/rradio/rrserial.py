"""Utilities for interacting with the micro:bit radio relay over serial."""

from __future__ import annotations

import time
from typing import Iterable, Iterator, Optional, Tuple, Union

import click
import serial
from serial.tools import list_ports
from serial.tools.list_ports_common import ListPortInfo

CMD_SEND = "s:"
CMD_RECEIVE = "r:"
_DEFAULT_BAUDRATE = 115200
_DEFAULT_TIMEOUT = 0.1
_IDLE_SLEEP = 0.05


def usb_serial_ports() -> Iterable[ListPortInfo]:
    """Yield USB serial ports that expose vendor information."""

    for port in list_ports.comports():
        if port.vid is None:
            continue
        yield port


def render_port_table(ports: Iterable[ListPortInfo]) -> None:
    """Render a simple table describing the available serial ports."""

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


def resolve_device(path: Optional[str]) -> Optional[str]:
    """Resolve a serial device path, auto-selecting a micro:bit when possible."""

    if path:
        return path

    ports = list(usb_serial_ports())
    if not ports:
        click.echo(
            "No USB serial ports detected. Use --device to select one.",
            err=True,
        )
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


class RRSerial:
    """Helper for communicating with the radio relay over serial."""

    def __init__(
        self,
        device: Optional[str] = None,
        *,
        baudrate: int = _DEFAULT_BAUDRATE,
        timeout: float = _DEFAULT_TIMEOUT,
    ) -> None:
        resolved = resolve_device(device)
        if not resolved:
            raise click.ClickException("Unable to resolve a serial device.")
        try:
            self._serial = serial.Serial(
                resolved,
                baudrate=baudrate,
                timeout=timeout,
            )
        except serial.SerialException as exc:  # pragma: no cover - hardware dependent
            raise click.ClickException(f"Failed to open serial port: {exc}") from exc

        self.device_path = resolved
        self.baudrate = self._serial.baudrate
        self.timeout = timeout

    def close(self) -> None:
        if self._serial and self._serial.is_open:
            self._serial.close()

    def __enter__(self) -> "RRSerial":
        return self

    def __exit__(self, exc_type, exc, tb) -> None:
        self.close()

    def reset_input_buffer(self) -> None:
        self._serial.reset_input_buffer()

    def send(self, payload: Union[bytes, str], prefix: str = CMD_SEND) -> str:
        """Send bytes (or a hex string) using the relay's send command."""

        if isinstance(payload, bytes):
            payload_hex = payload.hex()
        else:
            payload_hex = payload.replace(" ", "").strip()
        command = f"{prefix} {payload_hex}".strip()
        self._serial.write(command.encode("ascii") + b"\n")
        self._serial.flush()
        return command

    def iter(
        self, timeout: Optional[float] = None
    ) -> Iterator[Tuple[str, Union[bytes, str]]]:
        """Yield `(command, data)` tuples parsed from incoming serial output."""

        deadline: Optional[float] = None
        if timeout is not None:
            deadline = time.monotonic() + max(0.0, timeout)

        while True:
            if deadline is not None and time.monotonic() >= deadline:
                return

            line = self._serial.readline()
            if not line:
                time.sleep(_IDLE_SLEEP)
                continue

            text = line.decode("utf-8", errors="replace").rstrip("\r\n")
            if not text:
                continue

            prefix, sep, rest = text.partition(":")
            if not sep:
                yield ("log", text)
                continue

            raw_command = prefix.strip()
            payload = rest.strip()
            command = raw_command.lower() or "log"

            if command == "r":
                cleaned = payload.replace(" ", "")
                try:
                    data: Union[bytes, str] = bytes.fromhex(cleaned)
                except ValueError:
                    data = b""
            else:
                data = payload

            yield (command, data)

    def __iter__(self) -> Iterator[Tuple[str, Union[bytes, str]]]:
        return self.iter()


__all__ = [
    "RRSerial",
    "CMD_RECEIVE",
    "CMD_SEND",
    "render_port_table",
    "resolve_device",
    "usb_serial_ports",
]
