/**
 * Joystick payload for micro:bit radio
 */

namespace radiop {

    let _onReceiveJoystickHandler: (payload: JoystickPayload) => void = null;

    /**
     * Joystick button types
     */
    export enum JoystickButton {
        //% block="A"
        A = 0,
        //% block="B"
        B = 1,
        //% block="Logo"
        Logo = 2,
        //% block="C"
        C = 3,
        //% block="D"
        D = 4,
        //% block="E"
        E = 5,
        //% block="F"
        F = 6
    }

    export class JoystickPayload extends radiop.RadioPayload {

        static readonly PACKET_SIZE: number = RadioPacket.HEADER_SIZE + 11;
        private static readonly OFFSET_X = 0;
        private static readonly OFFSET_Y = 2;
        private static readonly OFFSET_BUTTONS = 4;
        private static readonly OFFSET_ACCEL_X = 5;
        private static readonly OFFSET_ACCEL_Y = 7;
        private static readonly OFFSET_ACCEL_Z = 9;

        constructor(buf?: Buffer) {
            super(radiop.PayloadType.JOYSTICK, JoystickPayload.PACKET_SIZE);
            if (buf) {
                this.adoptBuffer(buf);
            } else {
                this.packetType = radiop.PayloadType.JOYSTICK;
            }
        }
        
        static fromBuffer(b: Buffer): JoystickPayload {
            if (!b || b.length < JoystickPayload.PACKET_SIZE) return null;
            return new JoystickPayload(b);
        }

        get x(): number { return this.u16(JoystickPayload.OFFSET_X); }
        set x(v: number) { this.su16(JoystickPayload.OFFSET_X, Math.max(0, Math.min(1023, v | 0))); }

        get y(): number { return this.u16(JoystickPayload.OFFSET_Y); }
        set y(v: number) { this.su16(JoystickPayload.OFFSET_Y, Math.max(0, Math.min(1023, v | 0))); }

        get buttons(): number { return this.u8(JoystickPayload.OFFSET_BUTTONS); }
        set buttons(v: number) { this.su8(JoystickPayload.OFFSET_BUTTONS, v & 0xFF); }

        get accelX(): number { return this.i16(JoystickPayload.OFFSET_ACCEL_X); }
        set accelX(v: number) { this.si16(JoystickPayload.OFFSET_ACCEL_X, Math.max(-1023, Math.min(1023, v | 0))); }

        get accelY(): number { return this.i16(JoystickPayload.OFFSET_ACCEL_Y); }
        set accelY(v: number) { this.si16(JoystickPayload.OFFSET_ACCEL_Y, Math.max(-1023, Math.min(1023, v | 0))); }

        get accelZ(): number { return this.i16(JoystickPayload.OFFSET_ACCEL_Z); }
        set accelZ(v: number) { this.si16(JoystickPayload.OFFSET_ACCEL_Z, Math.max(-1023, Math.min(1023, v | 0))); }

        // Button helper methods
        buttonPressed(btn: JoystickButton): boolean { 
            return (this.buttons & (1 << btn)) != 0; 
        }
        
        setButton(btn: JoystickButton, on: boolean) { 
            let bits = this.buttons; 
            if (on) bits |= (1 << btn); 
            else bits &= ~(1 << btn); 
            this.buttons = bits; 
        }
        
        clearButtons() { 
            this.buttons = 0; 
        }

        dump(): string {
            return "JoystickPayload " + this.data.toHex();
        }

        get payloadLength() { return JoystickPayload.PACKET_SIZE; }

        get handler(): (payload: radiop.RadioPayload) => void {
            return _onReceiveJoystickHandler as any;
        }
    }

    /**
     * Get the last received joystick payload
     */
    //% blockId=get_last_joystick_payload
    //% block="last joystick message"
    //% group="Joystick"
    export function getLastJoystickPayload(): radiop.JoystickPayload {
        return radiop.lastPayload && radiop.lastPayload instanceof radiop.JoystickPayload ? 
               radiop.lastPayload as radiop.JoystickPayload : null;
    }

    /**
     * Check if a button is pressed
     */
    //% blockId=joystick_button_pressed block="joystick $payload button $button pressed"
    //% group="Joystick"
    //% weight=80
    export function buttonPressed(payload: JoystickPayload, button: JoystickButton): boolean {
        if (!payload) return false;
        return payload.buttonPressed(button);
    }

    /**
     * Run code when a joystick message is received
     */
    //% blockId=joystick_on_receive block="on receive joystick"
    //% group="Joystick"
    //% weight=100
    export function onReceiveJoystickMessage(handler: (payload: radiop.JoystickPayload) => void) {
        _onReceiveJoystickHandler = handler;
    }
}
