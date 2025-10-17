/**
 * Joystick blocks for micro:bit
 */

namespace radiop {

    let _onReceiveDisplayHandler: (payload: DisplayPayload) => void = null;

    export function onReceiveDisplay(handler: (payload: DisplayPayload) => void) {
        _onReceiveDisplayHandler = handler;
    }

    export class DisplayPayload extends radiop.RadioPayload {

    /**
     * Buffer layout (size: 31 bytes):
     * Byte 0   : Packet type (1 byte)
     * Byte 1   : tone (UInt8LE, 1 byte)
     * Byte 2   : duration (UInt8LE, 1 byte)
     * Byte 3-6 : image (UInt32LE, 4 bytes, lower 25 bits used)
     * Byte 7-18: Reserved/other payload (12 bytes)
     * Byte 19-21: headLampLeft (24-bit color, 3 bytes)
     * Byte 22-24: headLampRight (24-bit color, 3 bytes)
     * Byte 25-27: neoLeft (24-bit color, 3 bytes)
     * Byte 28-30: neoRight (24-bit color, 3 bytes)
     *
     * Color values are packed at the end of the buffer after image.
     */
    static readonly PACKET_SIZE: number = 31;


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

                /**
         * Set a 24-bit color value at the given position (buffer offset).
         * @param position Buffer offset (start byte)
         * @param value 32-bit int, only lower 24 bits used
         */
        setColor(position: number, value: number) {
            this.buffer.setNumber(NumberFormat.UInt8LE, position, (value >> 16) & 0xFF);
            this.buffer.setNumber(NumberFormat.UInt8LE, position + 1, (value >> 8) & 0xFF);
            this.buffer.setNumber(NumberFormat.UInt8LE, position + 2, value & 0xFF);
        }

        /**
         * Get a 24-bit color value from the given position (buffer offset).
         * @param position Buffer offset (start byte)
         * @returns 32-bit int, only lower 24 bits used
         */
        getColor(position: number): number {
            return ((this.buffer.getNumber(NumberFormat.UInt8LE, position) << 16) |
                    (this.buffer.getNumber(NumberFormat.UInt8LE, position + 1) << 8) |
                    (this.buffer.getNumber(NumberFormat.UInt8LE, position + 2)) ) >>> 0;
        }

    // Headlamp and NeoPixel color accessors (packed after image)
    get headLampLeft(): number { return this.getColor(7); }
    set headLampLeft(v: number) { this.setColor(7, v); }

    get headLampRight(): number { return this.getColor(10); }
    set headLampRight(v: number) { this.setColor(10, v); }

    get neoLeft(): number { return this.getColor(13); }
    set neoLeft(v: number) { this.setColor(13, v); }

    get neoRight(): number { return this.getColor(16); }
    set neoRight(v: number) { this.setColor(16, v); }

        private colorToHex(value: number): string {
            value = value & 0xFFFFFF;
            const hexChars = "0123456789ABCDEF";
            let hex = "";
            for (let i = 0; i < 6; i++) {
                hex = hexChars.charAt(value & 0x0F) + hex;
                value = value >> 4;
            }
            return "#" + hex;
        }

        dump(): string {
            return "DisplayPayload(serial=" + radiop.toHex(this.serial) +
                ", tone=" + this.tone +
                ", duration=" + this.duration +
                ", image=" + radiop.toHex(this.image) +
                ", lamps=[" + this.colorToHex(this.headLampLeft) + "," + this.colorToHex(this.headLampRight) +
                "," + this.colorToHex(this.neoLeft) + "," + this.colorToHex(this.neoRight) + "]" +
                ")";
        }

        get payloadLength() { return DisplayPayload.PACKET_SIZE; }

        get handler(): (payload: radiop.RadioPayload) => void {
            return _onReceiveDisplayHandler as any;
        }

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