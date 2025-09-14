/**
 * Joystick blocks for micro:bit
 */

namespace radiop {

    export class DisplayPayload extends radiop.RadioPayload {

        /**
         * Buffer layout (size: 19 bytes):
         * Byte 0   : Packet type (1 byte)
         * Byte 1   : tone (UInt8LE, 1 byte)
         * Byte 2   : duration (UInt8LE, 1 byte)
         * Byte 3-6 : image (UInt32LE, 4 bytes, lower 25 bits used)
         * Byte 7-18: Reserved/other payload (12 bytes)
         *
         * All values are packed at the lowest possible indices.
         */
        static readonly PACKET_SIZE: number = 19;

        constructor(buf?: Buffer) {
            super(radiop.PayloadType.DISPLAY, DisplayPayload.PACKET_SIZE);
            if (buf) this.buffer = buf;
            else this.buffer.setNumber(NumberFormat.UInt8LE, 0, radiop.PayloadType.DISPLAY);
        }
        static fromBuffer(b: Buffer): DisplayPayload {
            if (!b || b.length != DisplayPayload.PACKET_SIZE) return null;
            return new DisplayPayload(b);
        }

        // --- Packed values at the bottom of the buffer ---
        // Byte 1: tone (UInt8LE)
        get tone(): number { return this.buffer.getNumber(NumberFormat.UInt8LE, 1); }
        set tone(v: number) { this.buffer.setNumber(NumberFormat.UInt8LE, 1, v & 0xff); }

        /** Set octave and note 
         *  Middle C is Octave 4, Note 1
         *  Concert A is Octave 4, Note 10
         *  There are no frequencies defined for octave 0
         */
        setOctaveNote(octave: number, note: number) {
            this.tone = (octave << 4) | (note & 0x0f);
        }

        // Byte 2: duration (UInt8LE)
        get duration(): number { return this.buffer.getNumber(NumberFormat.UInt8LE, 2); }
        set duration(v: number) { this.buffer.setNumber(NumberFormat.UInt8LE, 2, v & 0xff); }

        // Byte 3-6: image (UInt32LE, lower 25 bits used)
        get image(): number { return this.buffer.getNumber(NumberFormat.UInt32LE, 3); }
        set image(v: number) { this.buffer.setNumber(NumberFormat.UInt32LE, 3, (v | 0) >>> 0); }

        /** Set image from an IconNames enum value */
        setIcon(icon: IconNames) {
            if (icon !== undefined && icon !== null) {
                this.image = radiop.imageToInt(images.iconImage(icon));
            }
        }

        /** Set image from a 5x5 Image object */
        setImage(img: Image) { if (img) this.image = radiop.imageToInt(img); }
        /** Get image decoded as 5x5 Image */
        getImage(): Image { return radiop.intToImage(this.image); }

        get payloadLength() { return DisplayPayload.PACKET_SIZE; }

    }
    
    /**
     * Given a frequency, return the closest (octave, note) pair.
     * @param freq the frequency in Hz
     */
    //% blockId=joystick_get_octave_note_for_frequency block="octave and note for frequency %freq" group="Joystick"
    //% weight=60
    export function getOctaveNoteForFrequency(freq: number): [number, number] {
        let minDiff = 99999;
        let bestOctave = 0;
        let bestNote = 0;
        for (let octave = 1; octave <= 7; octave++) {
            for (let note = 0; note < 12; note++) {
                let f = music.getFrequencyForNote(octave, note);
                let diff = Math.abs(f - freq);
                if (diff < minDiff) {
                    minDiff = diff;
                    bestOctave = octave;
                    bestNote = note;
                }
            }
        }
        return [bestOctave, bestNote];
    }



}