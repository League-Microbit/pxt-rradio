namespace radiop {

    /**
     * Send a BotState message with the given sonar distance.
     * @param distance the sonar distance in cm
     */
    //% blockId=botstate_send_sonar block="send bot state sonar %distance|cm" group="Bot State"
    export function sendBotStateSonar(distance: number): void {
        const bs = new radiop.BotStatePayload();
        bs.sonarDistance = distance;
        bs.send();
    }

    /**
     * Send a BotState message with the given icon image.
     * @param icon the icon to display
     */
    //% blockId=botstate_send_image block="send bot state image %icon" group="Bot State"
    export function sendBotStateImage(icon: IconNames): void {
        const bs = new radiop.BotStatePayload();
        bs.setIcon(icon);
        bs.send();
    }

    /**
     * Send a BotState message with a tone and duration.
     * @param octave the octave (1-7)
     * @param note the note (0-11)
     * @param beat the beat duration (BeatFraction enum)
     */
    //% blockId=botstate_send_tone block="send bot state tone octave %octave|note %note|duration %beat" group="Bot State"
    export function sendBotStateTone(octave: number, note: number, beat: BeatFraction): void {
        const bs = new radiop.BotStatePayload();
        bs.setOctaveNote(octave, note);
        // Duration: BeatFraction is 1 (whole), 2 (half), 4 (quarter), etc. Assume 1 = 1000ms, so duration = 1000/beat/10
        let ms = 1000 / beat;
        bs.duration = Math.max(1, Math.min(255, Math.round(ms / 10)));
        bs.send();
    }

    /**
     * Send a BotState message with the given flags byte.
     * @param flags the flags byte
     */
    //% blockId=botstate_send_flags block="send bot state flags %flags" group="Bot State"
    export function sendBotStateFlags(flags: number): void {
        const bs = new radiop.BotStatePayload();
        bs.flags = flags;
        bs.send();
    }

    /** BotState payload mirrors JoyPayload layout but uses BOT_STATUS packet type and provides alias accessors. */
    export class BotStatePayload extends JoyPayload {
        static PACKET_SIZE = JoyPayload.PACKET_SIZE;
        constructor(buf?: Buffer) {
            super(buf);
            // Overwrite packet type to BOT_STATUS
            this.getBuffer().setNumber(NumberFormat.UInt8LE, 0, radiop.PayloadType.BOT_STATUS);
        }
        static fromBuffer(b: Buffer): BotStatePayload { if (!b || b.length < BotStatePayload.PACKET_SIZE) return null; return new BotStatePayload(b); }

        // Alias: sonarDistance -> x
        get sonarDistance(): number { return this.x; }
        set sonarDistance(v: number) { this.x = v; }

        // Alias: flags bit operations reuse buttons bitfield (byte 5)
        flagIsSet(flag: number): boolean { return this.buttonPressed(flag as any); }
        setFlag(flag: number, on: boolean) { this.setButton(flag as any, on); }

        get flags(): number { return this.gb(); }
        set flags(value: number) { this.sb(value); }

    }



}
