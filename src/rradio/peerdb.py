"""In-memory store for tracking HereIAm peers."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, Iterable, List, Optional

from .packet import HereIAmPacket


@dataclass(frozen=True)
class PeerRecord:
    """Snapshot of a peer advertised via a HereIAm packet."""

    serial: int
    class_id: int
    group: int
    channel: int
    flags: int
    image: int
    time: int

    @classmethod
    def from_packet(cls, packet: HereIAmPacket) -> "PeerRecord":
        return cls(
            serial=int(packet.serial),
            class_id=int(packet.class_id),
            group=int(packet.group),
            channel=int(packet.channel),
            flags=int(packet.flags),
            image=int(packet.image),
            time=int(packet.time),
        )


class PeerDB:
    """Mirror of the micro:bit peer tracking helpers."""

    def __init__(self) -> None:
        self._peers: Dict[int, PeerRecord] = {}

    def add(self, packet: HereIAmPacket) -> PeerRecord:
        """Insert or update a peer using the packet's serial as the key."""

        record = PeerRecord.from_packet(packet)
        self._peers[record.serial] = record
        return record

    def clear(self) -> None:
        self._peers.clear()

    @property
    def records(self) -> Iterable[PeerRecord]:
        """All known peer records in insertion order."""

        return tuple(self._peers.values())

    def find_by_serial(self, serial: int) -> Optional[PeerRecord]:
        return self._peers.get(int(serial))

    def find_by_class(self, class_id: int) -> List[PeerRecord]:
        target = int(class_id)
        return [record for record in self._peers.values() if record.class_id == target]

    def __len__(self) -> int:
        return len(self._peers)

    def __iter__(self):
        return iter(self._peers.values())


__all__ = ["PeerDB", "PeerRecord"]
