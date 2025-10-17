/**
 * Joystick blocks for micro:bit
 */

namespace radiop {

    let _onReceiveBotCommandHandler: (payload: BotCommandPayload) => void = null;

    export function onReceiveBotCommand(handler: (payload: BotCommandPayload) => void) {
        _onReceiveBotCommandHandler = handler;
    }

    export class BotCommandPayload extends radiop.RadioPayload {

        static readonly PACKET_SIZE: number = 19;

        constructor(buf?: Buffer) {
            super(radiop.PayloadType.BOT_COMMAND, BotCommandPayload.PACKET_SIZE);
            if (buf) this.buffer = buf;
            else this.buffer.setNumber(NumberFormat.UInt8LE, 0, radiop.PayloadType.BOT_COMMAND);
        }
        static fromBuffer(b: Buffer): BotCommandPayload {
            if (!b || b.length != BotCommandPayload.PACKET_SIZE) return null;
            return new BotCommandPayload(b);
        }

        get commandType(): number { return this.u8(1); }
        set commandType(v: number) { this.su8(1, v); }

        get motor1(): number { return this.i16(2); }
        set motor1(v: number) { this.si16(2, v); }

        get motor2(): number { return this.i16(4); }
        set motor2(v: number) { this.si16(4, v); }

        get motor3(): number { return this.i16(6); }
        set motor3(v: number) { this.si16(6, v); }

        get motor4(): number { return this.i16(8); }
        set motor4(v: number) { this.si16(8, v); }

        get duration(): number { return this.i16(10); }
        set duration(v: number) { this.si16(10, v); }

        dump(): string {
            return "BotCommandPayload(serial=" + radiop.toHex(this.serial) +
                ", type=" + this.commandType +
                ", motors=[" + this.motor1 + "," + this.motor2 + "," + this.motor3 + "," + this.motor4 + "]" +
                ", duration=" + this.duration +
                ")";
        }

        get payloadLength() { return BotCommandPayload.PACKET_SIZE; }

        get handler(): (payload: radiop.RadioPayload) => void {
            return _onReceiveBotCommandHandler as any;
        }

    }
    
   

}