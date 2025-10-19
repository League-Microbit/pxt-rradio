/* Negotiation Messages
*
 */

namespace radiop {

    export let lastPayload: HereIAm = null;
    // Device class enum stored as single byte in HereIAm packet
    export enum DeviceClass {
        UNKNOWN = 0,
        BEACON = 1,
        RELAY = 2,
        CUTEBOT = 10,
        CUTEBOTPRO = 11,
        JOYSTICK = 20,
        DEVICE100 = 100,
        DEVICE101 = 101,
        DEVICE102 = 102

    }
    let myClassId: DeviceClass = DeviceClass.UNKNOWN; // Default class ID
    export let peers: { [serial: number]: HereIAm } = {};

    let _runBeacon = true;
    let _beaconInit = false;

    let _onReceiveHandler: (payload: HereIAm) => void = defaultOnReceiveHandler;


    export function clearPeers() { peers = {}; }
    function addPeer(p: HereIAm) { peers[p.serial] = p; }
    export function findPeerBySerial(serial: number): HereIAm {
        return peers[serial];
    }
    export function findPeerByClassId(classId: DeviceClass): HereIAm {
        const keys = Object.keys(peers);
        for (let i = 0; i < keys.length; i++) {
            const k = (keys[i] as any) | 0;
            const p = peers[k];
            if (p && p.classId == classId) return p;
        }
        return null;
    }

    // Compact HereIAm packet (12 bytes total):
    //  Byte 0 : packet type (HERE_I_AM)
    //  Byte 1 : classId (DeviceClass enum)
    //  Bytes2-3: group (u16)
    //  Bytes4-5: channel (u16)
    //  Bytes6-7: flags (u16)
    //  Bytes8-11: image (u32)
    export class HereIAm extends radiop.RadioPayload {

        static readonly PACKET_SIZE = RadioPacket.HEADER_SIZE + 11;
        private static readonly OFFSET_CLASS_ID = 0;
        private static readonly OFFSET_GROUP = 1;
        private static readonly OFFSET_CHANNEL = 3;
        private static readonly OFFSET_FLAGS = 5;

        constructor(buf?: Buffer) {
            super(radiop.PayloadType.HERE_I_AM, HereIAm.PACKET_SIZE);
            if (buf) {
                this.adoptBuffer(buf);
            } else {
                this.packetType = radiop.PayloadType.HERE_I_AM;
                this.classId = myClassId;
                this.group = radiop.getGroup();
                this.channel = radiop.getChannel();
                this.flags = 0;
            }
        }
        static fromBuffer(b: Buffer): HereIAm { if (!b || b.length < HereIAm.PACKET_SIZE) return null; return new HereIAm(b); }
        get classId(): DeviceClass { return this.u8(HereIAm.OFFSET_CLASS_ID); }
        set classId(v: DeviceClass) { this.su8(HereIAm.OFFSET_CLASS_ID, v & 0xff); }
        get group(): number { return this.u16(HereIAm.OFFSET_GROUP); }
        set group(v: number) { this.su16(HereIAm.OFFSET_GROUP, v); }
        get channel(): number { return this.u16(HereIAm.OFFSET_CHANNEL); }
        set channel(v: number) { this.su16(HereIAm.OFFSET_CHANNEL, v); }
        get flags(): number { return this.u16(HereIAm.OFFSET_FLAGS); }
        set flags(v: number) { this.su16(HereIAm.OFFSET_FLAGS, v); }


        dump(): string {
            return "HereIAm " + this.data.toHex();
        }

        get handler(): (payload: HereIAm) => void { return _onReceiveHandler; }
    }

    export function defaultOnReceiveHandler(payload: HereIAm, handler?: (payload: HereIAm) => void) {
        lastPayload = payload;
        addPeer(payload);
        if (handler) {
            handler(payload);
        }
    }

    export function onReceiveHereIAm(handler: (payload: HereIAm) => void) {
        _onReceiveHandler = function (payload: HereIAm) {
            defaultOnReceiveHandler(payload, handler);
        };
    }


    function newHereIAm(classId?: DeviceClass, group?: number, channel?: number): HereIAm {
        let h = new HereIAm();
        if (classId !== undefined) h.classId = classId;
        if (group !== undefined) h.group = group;
        if (channel !== undefined) h.channel = channel;
        return h;
    }
    /**
     * Send a HereIAm message to the broadcast channel and group 
     */

    export function broadcastHereIAm() {
        _broadcastHereIAm(newHereIAm());
    }

    export function _broadcastHereIAm(hia: HereIAm) {
        let origChannel = radiop.getChannel();
        let origGroup = radiop.getGroup();
        radiop.setChannel(BROADCAST_CHANNEL);
        radiop.setGroup(BROADCAST_GROUP);
        hia.send();

        radiop.setChannel(origChannel);
        radiop.setGroup(origGroup);
        basic.pause(100); // Allow some time for the message to be sent
    }

    /** Initialize the hereIAm Beacon
     * @param classId The class ID to use for the HereIAm message
     */
    //% blockId=init_beacon block="initialize beacon with classId %classId"
    //% group='Beacon'
    export function initBeacon(classId: DeviceClass) {

        if (_beaconInit) {
            return;
        }
        _beaconInit = true;


        myClassId = classId;


        let lastChannel: number = undefined
        let lastGroup: number = undefined
        let bCountDown = 10;

        control.inBackground(function () {
            while (true) {
                if (_runBeacon) {
                    let hereIAm = newHereIAm(); 
                    serial.writeLine("Beacon: ch=" + hereIAm.channel + " grp=" + hereIAm.group);
                    hereIAm.send(); // Send to my private radio
                    if (lastChannel !== radiop.getChannel() || lastGroup !== radiop.getGroup() || bCountDown <= 0) {
                        lastChannel = radiop.getChannel();
                        lastGroup = radiop.getGroup();
                        _broadcastHereIAm(hereIAm);
                        bCountDown = 10;
                    }
                    bCountDown--;
                }
                basic.pause(2000);
            }
        });

    }

    /** 
     * Start the beacon loop 
     */
    //% blockId=start_beacon block="start beacon"
    //% group='Beacon'
    export function startBeacon() {
        if (!_beaconInit) {
            return;
        }
        _runBeacon = true;
    }

    /** 
     * Stop the beacon loop 
     */
    //% blockId=stop_beacon block="stop beacon"
    //% group='Beacon'
    export function stopBeacon() {
        _runBeacon = false;
    }

    /* Look for traffic on a channel/group. Assumes the beacon is running
    * and is collecting HearIAm into the PeerDb.     */

    function testChannel(i: number, channel: number, group: number): Boolean {
        clearPeers();
        radiop.setGroup(group);
        radiop.setChannel(channel);

        let startTime = input.runningTime();


        // Poll the PeerDb for up to 5 seconds
        while (input.runningTime() - startTime < 5000) {
            let peer = findPeerByClassId(myClassId);
            if (peer) return false;
            basic.pause(200);
        }


        return true;

    }

    /*
    * Look for a free radio channel. First use a channel + group derived from the
    * machine id, and if that is occupied, randomly check a channel and group for
    * HereIAm messages from other senders.
    * If no messages are received within 5 seconds, return the channel and group.
    * */
    //% blockId=find_free_channel block="find free radio channel"
    //% group='Beacon'
    export function findFreeChannel(): void {
        let i = 0;

        /* channel and group based on the scrambled machine id,
        * so the initial request will always be the same. */
        let [channel, group] = radiop.getInitialRadioRequest();


        while (true) {

            if (testChannel(i, channel, group)) {
                // Return both channel and group as an array

                radiop.setGroup(group);
                radiop.setChannel(channel);
                basic.clearScreen();

                basic.showIcon(IconNames.Yes);

                return;
            }

            channel = randint(0, 83);
            group = randint(0, 255);

            i++;

            basic.showIcon(IconNames.No);
            basic.pause(200); // Pause to avoid flooding the radio with requests

        }

    }


}