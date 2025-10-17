namespace radiop {

    let _onReceiveBotStatusHandler: (payload: BotStatusPayload) => void = null;

    export function onReceiveBotStatus(handler: (payload: BotStatusPayload) => void) {
        _onReceiveBotStatusHandler = handler;
    }


    /** BotStatus payload mirrors JoyPayload layout but uses BOT_STATUS packet type and provides alias accessors. */
    export class BotStatusPayload extends radiop.RadioPayload {

        static PACKET_SIZE = 8;

        constructor(buf?: Buffer) {
            super(radiop.PayloadType.BOT_STATUS, BotStatusPayload.PACKET_SIZE);
            if (buf) this.buffer = buf;
            else this.buffer.setNumber(NumberFormat.UInt8LE, 0, radiop.PayloadType.BOT_STATUS);
        }

        static fromBuffer(b: Buffer): BotStatusPayload {
            if (!b || b.length < BotStatusPayload.PACKET_SIZE) return null;
            return new BotStatusPayload(b);
        }

        get buttons(): number { return this.u8(1); }
        set buttons(v: number) { this.su8(1, v); }

        get accelX(): number { return this.i16(2); }
        set accelX(v: number) { this.si16(2, v); }

        get accelY(): number { return this.i16(4); }
        set accelY(v: number) { this.si16(4, v); }

        get accelZ(): number { return this.i16(6); }
        set accelZ(v: number) { this.si16(6, v); }

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
