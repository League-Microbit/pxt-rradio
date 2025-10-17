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
     * Buffer layout (total size: 27 bytes):
     * Byte 0            : Packet type (1 byte)
     * Byte 1-8          : Standard header (time, serial) when enabled
     * Payload offsets (relative to payload start at byte 9):
     *   +0  tone (UInt8LE, 1 byte)
     *   +1  duration (UInt8LE, 1 byte)
     *   +2  image (UInt32LE, 4 bytes, lower 25 bits used)
     *   +6  headLampLeft (24-bit color, 3 bytes)
     *   +9  headLampRight (24-bit color, 3 bytes)
     *   +12 neoLeft (24-bit color, 3 bytes)
     *   +15 neoRight (24-bit color, 3 bytes)
     */
    static readonly PACKET_SIZE: number = RadioPacket.HEADER_SIZE + 18;

        private static readonly OFFSET_TONE = 0;
        private static readonly OFFSET_DURATION = 1;
        private static readonly OFFSET_IMAGE = 2;
        private static readonly OFFSET_HEAD_LAMP_LEFT = 6;
        private static readonly OFFSET_HEAD_LAMP_RIGHT = 9;
        private static readonly OFFSET_NEO_LEFT = 12;
        private static readonly OFFSET_NEO_RIGHT = 15;


        constructor(buf?: Buffer) {
            super(radiop.PayloadType.DISPLAY, DisplayPayload.PACKET_SIZE);
            if (buf) {
                this.adoptBuffer(buf);
            }
        }
        static fromBuffer(b: Buffer): DisplayPayload {
            if (!b || b.length != DisplayPayload.PACKET_SIZE) return null;
            return new DisplayPayload(b);
        }

        // --- Packed values at the bottom of the buffer ---
        // Byte +0: tone (UInt8LE)
        get tone(): number { return this.data.getNumber(NumberFormat.UInt8LE, this.payloadOffset(DisplayPayload.OFFSET_TONE)); }
        set tone(v: number) { this.data.setNumber(NumberFormat.UInt8LE, this.payloadOffset(DisplayPayload.OFFSET_TONE), v & 0xff); }

        /** Set octave and note 
         *  Middle C is Octave 4, Note 1
         *  Concert A is Octave 4, Note 10
         *  There are no frequencies defined for octave 0
         */
        setOctaveNote(octave: number, note: number) {
            this.tone = (octave << 4) | (note & 0x0f);
        }

    // Byte +1: duration (UInt8LE)
    get duration(): number { return this.data.getNumber(NumberFormat.UInt8LE, this.payloadOffset(DisplayPayload.OFFSET_DURATION)); }
    set duration(v: number) { this.data.setNumber(NumberFormat.UInt8LE, this.payloadOffset(DisplayPayload.OFFSET_DURATION), v & 0xff); }

    // Byte +2-5: image (UInt32LE, lower 25 bits used)
    get image(): number { return this.data.getNumber(NumberFormat.UInt32LE, this.payloadOffset(DisplayPayload.OFFSET_IMAGE)); }
    set image(v: number) { this.data.setNumber(NumberFormat.UInt32LE, this.payloadOffset(DisplayPayload.OFFSET_IMAGE), (v | 0) >>> 0); }

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
            const offset = this.payloadOffset(position);
            this.data.setNumber(NumberFormat.UInt8LE, offset, (value >> 16) & 0xFF);
            this.data.setNumber(NumberFormat.UInt8LE, offset + 1, (value >> 8) & 0xFF);
            this.data.setNumber(NumberFormat.UInt8LE, offset + 2, value & 0xFF);
        }

        /**
         * Get a 24-bit color value from the given position (buffer offset).
         * @param position Buffer offset (start byte)
         * @returns 32-bit int, only lower 24 bits used
         */
        getColor(position: number): number {
            const offset = this.payloadOffset(position);
            return ((this.data.getNumber(NumberFormat.UInt8LE, offset) << 16) |
                    (this.data.getNumber(NumberFormat.UInt8LE, offset + 1) << 8) |
                    (this.data.getNumber(NumberFormat.UInt8LE, offset + 2)) ) >>> 0;
        }

    // Headlamp and NeoPixel color accessors (packed after image)
    get headLampLeft(): number { return this.getColor(DisplayPayload.OFFSET_HEAD_LAMP_LEFT); }
    set headLampLeft(v: number) { this.setColor(DisplayPayload.OFFSET_HEAD_LAMP_LEFT, v); }

    get headLampRight(): number { return this.getColor(DisplayPayload.OFFSET_HEAD_LAMP_RIGHT); }
    set headLampRight(v: number) { this.setColor(DisplayPayload.OFFSET_HEAD_LAMP_RIGHT, v); }

    get neoLeft(): number { return this.getColor(DisplayPayload.OFFSET_NEO_LEFT); }
    set neoLeft(v: number) { this.setColor(DisplayPayload.OFFSET_NEO_LEFT, v); }

    get neoRight(): number { return this.getColor(DisplayPayload.OFFSET_NEO_RIGHT); }
    set neoRight(v: number) { this.setColor(DisplayPayload.OFFSET_NEO_RIGHT, v); }

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

    get payloadLength() { return DisplayPayload.PACKET_SIZE - this.BYTE_POS_PAYLOAD_START; }

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