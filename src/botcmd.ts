/**
 * Joystick blocks for micro:bit
 */

namespace radiop {

    let _lastSentPayload: JoyPayload = null;
    export let lastJoyPayload: JoyPayload = null;

    let _onReceiveJoyHandler: (payload: radiop.RadioPayload) => void = undefined;

   
    function clip(x: number, min: number, max: number): number {
        return Math.max(min, Math.min(max, x));
    }

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
            super(radiop.PayloadType.JOY, DisplayPayload.PACKET_SIZE);
            if (buf) this.buffer = buf;
            else this.buffer.setNumber(NumberFormat.UInt8LE, 0, radiop.PayloadType.JOY);
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
            if (icon !== undefined && icon !== null) this.image = radiop.imageToInt(images.iconImage(icon));
        }

        /** Set image from a 5x5 Image object */
        setImage(img: Image) { if (img) this.image = radiop.imageToInt(img); }
        /** Get image decoded as 5x5 Image */
        getImage(): Image { return radiop.intToImage(this.image); }

        get handler(): (payload: radiop.RadioPayload) => void { return _onReceiveJoyHandler; }
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

    /**
     * Get the last received joystick payload
     */
    //% blockId=get_last_joy_payload
    //% block="last joystick message"
    //% group="Joystick"
    export function getLastJoyPayload(): radiop.JoyPayload {
        return radiop.lastJoyPayload;
    }


    /**
     * Get the 5x5 image stored in the joystick payload (lower 25 bits of image field)
     */
    //% blockId=joystick_get_image block="joystick $payload image"
    //% group="Joystick"
    //% weight=70
    export function getImage(payload: JoyPayload): Image {
        if (!payload) return images.createImage(`\n.....\n.....\n.....\n.....\n.....`);
        return payload.getImage();
    }

    /**
     * Get the generic 16-bit data value from the joystick payload
     */
    //% blockId=joystick_get_data block="joystick $payload data"
    //% group="Joystick"
    //% weight=60
    export function getData(payload: JoyPayload): number {
        if (!payload) return 0;
    return payload.datau8;
    }

    // (Audio helper blocks removed for simplicity.)


    /** Send joystick state if changed */
    export function sendIfChanged(jp: radiop.JoyPayload): boolean {
        let hasChanged = (!_lastSentPayload || _lastSentPayload.hash != jp.hash);
        if (hasChanged) jp.send();
        _lastSentPayload = jp;
        return hasChanged;
    }

    export function sendJoyPayload(x: number, y: number, buttons: number[], accelX: number, accelY: number, accelZ: number): void {
        radiop.initDefaults();
        let p = new radiop.JoyPayload();
        p.x = x; p.y = y; p.accelX = accelX; p.accelY = accelY; p.accelZ = accelZ;
        let bits = 0; let n = buttons?buttons.length:0; for (let i=0;i<n && i<8;i++){ let bt=buttons[i]; if(bt>=0&&bt<8) bits |= (1<<bt);} 
        p["buffer"].setNumber(NumberFormat.UInt8LE,5,bits);
        radio.sendBuffer(p.getBuffer());
    }   

    /**
     * Run code when a joystick message is received
     */
    //% blockId=joystick_on_receive block="on receive joystick"
    //% group="Joystick"
    //% weight=100
    export function onReceiveJoystickMessage(handler: (payload: radiop.JoyPayload) => void) {

        _onReceiveJoyHandler = function (payload: JoyPayload) {
            lastJoyPayload = payload;
            handler(payload);
        };
    }




}