

function testHereIAm() {
    basic.showIcon(IconNames.Target);
    radiop.initDefaults();

    serial.writeLine("-- HereIAm Test --");
    // Pick a random non-UNKNOWN class
  
    serial.writeLine("Init HereIAm ");
    radiop.initBeacon(radiop.DeviceClass.BEACON);

    radiop.onPayload(function (payload: radiop.RadioPayload) {
        serial.writeLine(payload.dump());
    });

    // Handler: dump all peers each time a HereIAm arrives
    radiop.onReceiveHereIAm(function (h: radiop.HereIAm) {
        const keys = Object.keys(radiop.peers);
        const count = keys.length;
        serial.writeLine("-- Peers (" + count + ") --");
        for (let i = 0; i < keys.length; i++) {
            const serialKey = (keys[i] as any) | 0;
            const p = radiop.peers[serialKey];
            if (p) {
                serial.writeLine(radiop.toHex(p.serial) + " class=" + p.classId + " ch=" + p.channel + " grp=" + p.group);
            }
        }
    });
}


// basic.showIcon(IconNames.Duck);
// radiop.initDefaults();

(new radiop.RadioRelay()).run();
