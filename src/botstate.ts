namespace radiop {


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

    }


}
