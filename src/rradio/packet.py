"""Python representations of micro:bit radio packets."""

from __future__ import annotations

import struct
from enum import IntEnum
from typing import ClassVar, Dict, Optional, Type


class PayloadType(IntEnum):
	HERE_I_AM = 10
	DISPLAY = 11
	BOT_COMMAND = 20
	BOT_STATUS = 21


class RadioPacket:
	"""Base packet that handles the shared radio header."""

	HEADER_STRUCT: ClassVar[struct.Struct] = struct.Struct("<Bii")
	HEADER_SIZE: ClassVar[int] = HEADER_STRUCT.size
	TOTAL_SIZE: ClassVar[Optional[int]] = None
	PACKET_TYPE: ClassVar[Optional[int]] = None

	def __init__(self, packet_type: int, time: int = 0, serial: int = 0) -> None:
		self.packet_type = packet_type & 0xFF
		self.time = int(time)
		self.serial = int(serial)

	@classmethod
	def _parse_header(cls, data: bytes) -> tuple[int, int, int]:
		view = memoryview(data)
		if len(view) < cls.HEADER_SIZE:
			raise ValueError(
				f"Packet too short: expected at least {cls.HEADER_SIZE} bytes, got {len(view)}"
			)
		return cls.HEADER_STRUCT.unpack_from(view)

	def payload_bytes(self) -> bytes:
		return b""

	def to_bytes(self) -> bytes:
		header = self.HEADER_STRUCT.pack(self.packet_type, self.time, self.serial)
		return header + self.payload_bytes()

	def to_hex(self) -> str:
		return self.to_bytes().hex()

	@classmethod
	def from_bytes(cls, data: bytes) -> "RadioPacket":
		raise NotImplementedError("from_bytes must be implemented by subclasses")

	@classmethod
	def from_hex(cls: Type["RadioPacket"], text: str) -> "RadioPacket":
		return cls.from_bytes(bytes.fromhex(text))


class RawRadioPacket(RadioPacket):
	"""Fallback packet used when the payload type is unknown."""

	def __init__(self, packet_type: int, payload: bytes = b"", time: int = 0, serial: int = 0) -> None:
		super().__init__(packet_type, time, serial)
		self.payload = bytes(payload)

	@classmethod
	def from_bytes(cls, data: bytes) -> "RawRadioPacket":
		packet_type, time, serial = cls._parse_header(data)
		payload = bytes(memoryview(data)[cls.HEADER_SIZE:])
		return cls(packet_type, payload, time, serial)

	def payload_bytes(self) -> bytes:
		return self.payload


def _join_color(red: int, green: int, blue: int) -> int:
	return ((red & 0xFF) << 16) | ((green & 0xFF) << 8) | (blue & 0xFF)


def _split_color(value: int) -> tuple[int, int, int]:
	value &= 0xFFFFFF
	return ((value >> 16) & 0xFF, (value >> 8) & 0xFF, value & 0xFF)


class BotCommandPacket(RadioPacket):
	PACKET_TYPE: ClassVar[int] = PayloadType.BOT_COMMAND
	PAYLOAD_STRUCT: ClassVar[struct.Struct] = struct.Struct("<Bhhhhh")
	TOTAL_SIZE: ClassVar[int] = RadioPacket.HEADER_SIZE + PAYLOAD_STRUCT.size

	def __init__(
		self,
		data: Optional[bytes] = None,
		*,
		command_type: int = 0,
		motor1: int = 0,
		motor2: int = 0,
		motor3: int = 0,
		motor4: int = 0,
		duration: int = 0,
		time: int = 0,
		serial: int = 0,
	) -> None:
		if data is not None:
			packet_type, time, serial = self._parse_header(data)
			if packet_type != self.PACKET_TYPE:
				raise ValueError("Not a BotCommand packet")
			if len(data) != self.TOTAL_SIZE:
				raise ValueError(
					f"BotCommand packet must be {self.TOTAL_SIZE} bytes, got {len(data)}"
				)
			values = self.PAYLOAD_STRUCT.unpack_from(memoryview(data), self.HEADER_SIZE)
			command_type, motor1, motor2, motor3, motor4, duration = values
		super().__init__(int(self.PACKET_TYPE), time, serial)
		self.command_type = int(command_type) & 0xFF
		self.motor1 = int(motor1)
		self.motor2 = int(motor2)
		self.motor3 = int(motor3)
		self.motor4 = int(motor4)
		self.duration = int(duration)

	def payload_bytes(self) -> bytes:
		return self.PAYLOAD_STRUCT.pack(
			self.command_type & 0xFF,
			self.motor1,
			self.motor2,
			self.motor3,
			self.motor4,
			self.duration,
		)

	@classmethod
	def from_bytes(cls, data: bytes) -> "BotCommandPacket":
		return cls(data)


class BotStatusPacket(RadioPacket):
	PACKET_TYPE: ClassVar[int] = PayloadType.BOT_STATUS
	PAYLOAD_STRUCT: ClassVar[struct.Struct] = struct.Struct("<Bhhh")
	TOTAL_SIZE: ClassVar[int] = RadioPacket.HEADER_SIZE + PAYLOAD_STRUCT.size

	def __init__(
		self,
		data: Optional[bytes] = None,
		*,
		buttons: int = 0,
		accel_x: int = 0,
		accel_y: int = 0,
		accel_z: int = 0,
		time: int = 0,
		serial: int = 0,
	) -> None:
		if data is not None:
			packet_type, time, serial = self._parse_header(data)
			if packet_type != self.PACKET_TYPE:
				raise ValueError("Not a BotStatus packet")
			if len(data) != self.TOTAL_SIZE:
				raise ValueError(
					f"BotStatus packet must be {self.TOTAL_SIZE} bytes, got {len(data)}"
				)
			values = self.PAYLOAD_STRUCT.unpack_from(memoryview(data), self.HEADER_SIZE)
			buttons, accel_x, accel_y, accel_z = values
		super().__init__(int(self.PACKET_TYPE), time, serial)
		self.buttons = int(buttons) & 0xFF
		self.accel_x = int(accel_x)
		self.accel_y = int(accel_y)
		self.accel_z = int(accel_z)

	def payload_bytes(self) -> bytes:
		return self.PAYLOAD_STRUCT.pack(
			self.buttons & 0xFF,
			self.accel_x,
			self.accel_y,
			self.accel_z,
		)

	@classmethod
	def from_bytes(cls, data: bytes) -> "BotStatusPacket":
		return cls(data)


class DisplayPacket(RadioPacket):
	PACKET_TYPE: ClassVar[int] = PayloadType.DISPLAY
	PAYLOAD_STRUCT: ClassVar[struct.Struct] = struct.Struct("<BBI12B")
	TOTAL_SIZE: ClassVar[int] = RadioPacket.HEADER_SIZE + PAYLOAD_STRUCT.size

	def __init__(
		self,
		data: Optional[bytes] = None,
		*,
		tone: int = 0,
		duration: int = 0,
		image: int = 0,
		head_lamp_left: int = 0,
		head_lamp_right: int = 0,
		neo_left: int = 0,
		neo_right: int = 0,
		time: int = 0,
		serial: int = 0,
	) -> None:
		if data is not None:
			packet_type, time, serial = self._parse_header(data)
			if packet_type != self.PACKET_TYPE:
				raise ValueError("Not a Display packet")
			if len(data) != self.TOTAL_SIZE:
				raise ValueError(
					f"Display packet must be {self.TOTAL_SIZE} bytes, got {len(data)}"
				)
			unpacked = self.PAYLOAD_STRUCT.unpack_from(memoryview(data), self.HEADER_SIZE)
			tone, duration, image, *color_bytes = unpacked
			head_lamp_left = _join_color(*color_bytes[0:3])
			head_lamp_right = _join_color(*color_bytes[3:6])
			neo_left = _join_color(*color_bytes[6:9])
			neo_right = _join_color(*color_bytes[9:12])
		super().__init__(int(self.PACKET_TYPE), time, serial)
		self.tone = int(tone) & 0xFF
		self.duration = int(duration) & 0xFF
		self.image = int(image) & 0xFFFFFFFF
		self.head_lamp_left = int(head_lamp_left) & 0xFFFFFF
		self.head_lamp_right = int(head_lamp_right) & 0xFFFFFF
		self.neo_left = int(neo_left) & 0xFFFFFF
		self.neo_right = int(neo_right) & 0xFFFFFF

	def payload_bytes(self) -> bytes:
		color_bytes = []
		for value in (
			self.head_lamp_left,
			self.head_lamp_right,
			self.neo_left,
			self.neo_right,
		):
			color_bytes.extend(_split_color(value))
		values = [
			self.tone & 0xFF,
			self.duration & 0xFF,
			self.image & 0xFFFFFFFF,
			*color_bytes,
		]
		return self.PAYLOAD_STRUCT.pack(*values)

	@classmethod
	def from_bytes(cls, data: bytes) -> "DisplayPacket":
		return cls(data)


class HereIAmPacket(RadioPacket):
	PACKET_TYPE: ClassVar[int] = PayloadType.HERE_I_AM
	PAYLOAD_STRUCT: ClassVar[struct.Struct] = struct.Struct("<BHHHI")
	TOTAL_SIZE: ClassVar[int] = RadioPacket.HEADER_SIZE + PAYLOAD_STRUCT.size

	def __init__(
		self,
		data: Optional[bytes] = None,
		*,
		class_id: int = 0,
		group: int = 0,
		channel: int = 0,
		flags: int = 0,
		image: int = 0,
		time: int = 0,
		serial: int = 0,
	) -> None:
		if data is not None:
			packet_type, time, serial = self._parse_header(data)
			if packet_type != self.PACKET_TYPE:
				raise ValueError("Not a HereIAm packet")
			if len(data) != self.TOTAL_SIZE:
				raise ValueError(
					f"HereIAm packet must be {self.TOTAL_SIZE} bytes, got {len(data)}"
				)
			class_id, group, channel, flags, image = self.PAYLOAD_STRUCT.unpack_from(
				memoryview(data), self.HEADER_SIZE
			)
		super().__init__(int(self.PACKET_TYPE), time, serial)
		self.class_id = int(class_id) & 0xFF
		self.group = int(group) & 0xFFFF
		self.channel = int(channel) & 0xFFFF
		self.flags = int(flags) & 0xFFFF
		self.image = int(image) & 0xFFFFFFFF

	def payload_bytes(self) -> bytes:
		return self.PAYLOAD_STRUCT.pack(
			self.class_id & 0xFF,
			self.group & 0xFFFF,
			self.channel & 0xFFFF,
			self.flags & 0xFFFF,
			self.image & 0xFFFFFFFF,
		)

	@classmethod
	def from_bytes(cls, data: bytes) -> "HereIAmPacket":
		return cls(data)


PACKET_CLASSES: Dict[int, Type[RadioPacket]] = {
	int(PayloadType.BOT_COMMAND): BotCommandPacket,
	int(PayloadType.BOT_STATUS): BotStatusPacket,
	int(PayloadType.DISPLAY): DisplayPacket,
	int(PayloadType.HERE_I_AM): HereIAmPacket,
}


def parse_packet(data: bytes) -> RadioPacket:
	"""Return an appropriate packet instance for the raw bytes."""

	if len(data) < RadioPacket.HEADER_SIZE:
		raise ValueError("Packet too short to decode")
	packet_type = data[0]
	packet_cls = PACKET_CLASSES.get(packet_type, RawRadioPacket)
	expected_size = getattr(packet_cls, "TOTAL_SIZE", None)
	if expected_size:
		if len(data) < expected_size:
			raise ValueError(
				f"Packet too short for {packet_cls.__name__}: "
				f"expected {expected_size} bytes, got {len(data)}"
			)
		data = data[:expected_size]
	return packet_cls.from_bytes(data)


def parse_hex(text: str) -> RadioPacket:
	"""Decode a packet from a hex string."""

	return parse_packet(bytes.fromhex(text))


__all__ = [
	"PayloadType",
	"RadioPacket",
	"RawRadioPacket",
	"BotCommandPacket",
	"BotStatusPacket",
	"DisplayPacket",
	"HereIAmPacket",
	"parse_packet",
	"parse_hex",
]

