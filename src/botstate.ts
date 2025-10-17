namespace radiop {

    let _onReceiveBotStatusHandler: (payload: BotStatusPayload) => void = null;

    export function onReceiveBotStatus(handler: (payload: BotStatusPayload) => void) {
        _onReceiveBotStatusHandler = handler;
    }


    /** BotStatus payload mirrors JoyPayload layout but uses BOT_STATUS packet type and provides alias accessors. */
    export class BotStatusPayload extends radiop.RadioPayload {

    static PACKET_SIZE = RadioPacket.HEADER_SIZE + 7;
        private static readonly OFFSET_BUTTONS = 0;
        private static readonly OFFSET_ACCEL_X = 1;
        private static readonly OFFSET_ACCEL_Y = 3;
        private static readonly OFFSET_ACCEL_Z = 5;

        constructor(buf?: Buffer) {
            super(radiop.PayloadType.BOT_STATUS, BotStatusPayload.PACKET_SIZE);
            if (buf) {
                this.adoptBuffer(buf);
            }
        }

        static fromBuffer(b: Buffer): BotStatusPayload {
            if (!b || b.length < BotStatusPayload.PACKET_SIZE) return null;
            return new BotStatusPayload(b);
        }

    get buttons(): number { return this.u8(BotStatusPayload.OFFSET_BUTTONS); }
    set buttons(v: number) { this.su8(BotStatusPayload.OFFSET_BUTTONS, v); }

    get accelX(): number { return this.i16(BotStatusPayload.OFFSET_ACCEL_X); }
    set accelX(v: number) { this.si16(BotStatusPayload.OFFSET_ACCEL_X, v); }

    get accelY(): number { return this.i16(BotStatusPayload.OFFSET_ACCEL_Y); }
    set accelY(v: number) { this.si16(BotStatusPayload.OFFSET_ACCEL_Y, v); }

    get accelZ(): number { return this.i16(BotStatusPayload.OFFSET_ACCEL_Z); }
    set accelZ(v: number) { this.si16(BotStatusPayload.OFFSET_ACCEL_Z, v); }

        dump(): string {
            return "BotStatusPayload(serial=" + radiop.toHex(this.serial) +
                ", buttons=" + this.buttons +
                ", accel=[" + this.accelX + "," + this.accelY + "," + this.accelZ + "]" +
                ")";
        }

        get handler(): (payload: radiop.RadioPayload) => void {
            return _onReceiveBotStatusHandler as any;
        }

    }


}
