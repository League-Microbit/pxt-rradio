/**
 * Joystick blocks for micro:bit
 */

namespace radiop {

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

        get payloadLength() { return BotCommandPayload.PACKET_SIZE; }

    }
    
   

}