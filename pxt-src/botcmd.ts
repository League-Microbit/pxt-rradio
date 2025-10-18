/**
 * Joystick blocks for micro:bit
 */

namespace radiop {

    let _onReceiveBotCommandHandler: (payload: BotCommandPayload) => void = null;

    export function onReceiveBotCommand(handler: (payload: BotCommandPayload) => void) {
        _onReceiveBotCommandHandler = handler;
    }

    export class BotCommandPayload extends radiop.RadioPayload {

        static readonly PACKET_SIZE: number = RadioPacket.HEADER_SIZE + 19;
        private static readonly OFFSET_COMMAND = 0;
        private static readonly OFFSET_MOTOR1 = 1;
        private static readonly OFFSET_MOTOR2 = 3;
        private static readonly OFFSET_MOTOR3 = 5;
        private static readonly OFFSET_MOTOR4 = 7;
        private static readonly OFFSET_DURATION = 9;
        private static readonly OFFSET_SERVO1 = 11;
        private static readonly OFFSET_SERVO2 = 13;
        private static readonly OFFSET_DATA1 = 15;

        constructor(buf?: Buffer) {
            super(radiop.PayloadType.BOT_COMMAND, BotCommandPayload.PACKET_SIZE);
            if (buf) {
                this.adoptBuffer(buf);
            } else {
                this.packetType = radiop.PayloadType.BOT_COMMAND;
            }
        }
        static fromBuffer(b: Buffer): BotCommandPayload {
            if (!b || b.length < BotCommandPayload.PACKET_SIZE) return null;
            return new BotCommandPayload(b);
        }

        get commandType(): number { return this.u8(BotCommandPayload.OFFSET_COMMAND); }
        set commandType(v: number) { this.su8(BotCommandPayload.OFFSET_COMMAND, v); }

        get motor1(): number { return this.i16(BotCommandPayload.OFFSET_MOTOR1); }
        set motor1(v: number) { this.si16(BotCommandPayload.OFFSET_MOTOR1, v); }

        get motor2(): number { return this.i16(BotCommandPayload.OFFSET_MOTOR2); }
        set motor2(v: number) { this.si16(BotCommandPayload.OFFSET_MOTOR2, v); }

        get motor3(): number { return this.i16(BotCommandPayload.OFFSET_MOTOR3); }
        set motor3(v: number) { this.si16(BotCommandPayload.OFFSET_MOTOR3, v); }

        get motor4(): number { return this.i16(BotCommandPayload.OFFSET_MOTOR4); }
        set motor4(v: number) { this.si16(BotCommandPayload.OFFSET_MOTOR4, v); }

        get duration(): number { return this.i16(BotCommandPayload.OFFSET_DURATION); }
        set duration(v: number) { this.si16(BotCommandPayload.OFFSET_DURATION, v); }

        get servo1(): number { return this.i16(BotCommandPayload.OFFSET_SERVO1); }
        set servo1(v: number) { this.si16(BotCommandPayload.OFFSET_SERVO1, v); }

        get servo2(): number { return this.i16(BotCommandPayload.OFFSET_SERVO2); }
        set servo2(v: number) { this.si16(BotCommandPayload.OFFSET_SERVO2, v); }

        get data1(): number { return this.data.getNumber(NumberFormat.Int32LE, this.payloadOffset(BotCommandPayload.OFFSET_DATA1)); }
        set data1(v: number) { this.data.setNumber(NumberFormat.Int32LE, this.payloadOffset(BotCommandPayload.OFFSET_DATA1), v); }

        dump(): string {
            return "BotCommandPayload " + this.data.toHex();
        }

        get payloadLength() { return BotCommandPayload.PACKET_SIZE; }

        get handler(): (payload: radiop.RadioPayload) => void {
            return _onReceiveBotCommandHandler as any;
        }

    }
    
   

}