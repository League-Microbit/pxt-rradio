/* Radio Payloads
* Specialized payloads for sending radio messages. The messaged include: 
* 
* JoyPayload - for joystick data including position, buttons, and accelerometer
*/
//% color=#0066CC weight=95 icon="\uf11b" 
namespace radiop {

    export const BROADCAST_CHANNEL : number  = 1; // Default broadcast channel for HereIAm messages
    export const BROADCAST_GROUP: number = 1; // Default broadcast group for HereIAm messages

    export const CHANNEL_MIN = radiop.BROADCAST_CHANNEL + 1; // Minimum channel number
    export const CHANNEL_MAX = 100; // Maximum channel number
    export const GROUP_MIN = radiop.BROADCAST_GROUP + 1; // Minimum group number
    export const GROUP_MAX = 255; // Maximum group number

    let _group: number = radiop.BROADCAST_GROUP;
    let _channel: number = radiop.BROADCAST_CHANNEL;

    let transmittingSerial: boolean = true;
    let initialized = false;

    let payloadHandler: (payload: RadioPayload) => void; // Handles any payload if no specific handler is set


    export enum PayloadType {
        JOY = 10,
        HERE_I_AM = 11,
        BOT_STATUS = 12
    }

    export function setGroup(group: number) {
        if (group != _group) {
            _group = group;
            radiop.clearPeers(); // Clear peers when group changes (peerDb removed)
        }
        radio.setGroup(group);
    }


    export function getGroup(): number {
        return _group;
    }

    export function setChannel(channel: number) {
        if (channel != _channel) {
            radiop.clearPeers(); // Clear peers when channel changes (peerDb removed)
            _channel = channel;
        }
        
        radio.setFrequencyBand(channel);
    }

    export function getChannel(): number {
        return _channel;
    }




    /**
     * Base class for all radio payloads
     */
    export class RadioPayload {

        readonly BYTE_POS_PACKET_TYPE = 0; // Position of packet type in the buffer
        readonly BYTE_POS_PAYLOAD_START = 1; // Position of payload start in the buffer
        static readonly MAX_PACKET_SIZE = 19; // Max size of a radio buffer ( not the whole packet, which is 32 bytes )


        public packet: radio.RadioPacket = undefined; 
        protected buffer: Buffer;
        protected packetType: number;

        constructor(packetType: number, size: number) {
            this.packetType = packetType;
            this.buffer = control.createBuffer(size);
            this.buffer.fill(0)
            this.buffer.setNumber(NumberFormat.UInt8LE,
                                  this.BYTE_POS_PACKET_TYPE, packetType);
        }


        get time(): number {
            if (this.packet) {
                return this.packet.time;
            }
            return 0;
        }

        get serial(): number {
            if (this.packet) {
                return this.packet.serial;
            }
            return 0;
        }

        get signal(): number {
            if (this.packet) {
                return this.packet.signal;
            }
            return 0;
        }
        static fromBuffer(buffer: Buffer): RadioPayload {
            return undefined;
        }

        getBuffer(): Buffer {
            return this.buffer;
        }

        getPacketType(): number {
            return this.packetType;
        }

        get payloadLength() {
            return 0;
        }

        get hash(): number {
            return this.buffer.hash(32);
        }

        get handler(): (payload: RadioPayload) => void {
            return undefined;
        }

        send(): void {
            radio.sendBuffer(this.getBuffer());
        }

        /** Get the value (0/1) of a bit within a number stored at a byte offset in the payload buffer.
         * @param byteOffset start of the number within the buffer
         * @param bit bit position (0 = least significant)
         * @param format numeric format (size determines how many bytes are read); default UInt8LE
         */
        getBit(byteOffset: number, bit: number, format: NumberFormat = NumberFormat.UInt8LE): number {
            if (bit < 0 || bit > 31) return 0;
            let v = this.buffer.getNumber(format, byteOffset);
            return (v & (1 << bit)) ? 1 : 0;
        }

        /** Set or clear a bit (accepts 0/1 or false/true) within a number at a byte offset in the buffer.
         * @param byteOffset start of the number in the buffer
         * @param bit bit position (0 = least significant)
         * @param value boolean or 0/1; other numbers treated as truthy/non-zero
         * @param format numeric format; default UInt8LE
         */
        setBit(byteOffset: number, bit: number, value: number | boolean, format: NumberFormat = NumberFormat.UInt8LE): void {
            if (bit < 0 || bit > 31) return;
            let v = this.buffer.getNumber(format, byteOffset);
            if (value ? true : false) v |= (1 << bit); else v &= ~(1 << bit);
            this.buffer.setNumber(format, byteOffset, v);
        }

        /** Toggle (invert) a bit at the given position */
        toggleBit(byteOffset: number, bit: number, format: NumberFormat = NumberFormat.UInt8LE): void {
            if (bit < 0 || bit > 31) return;
            let v = this.buffer.getNumber(format, byteOffset) ^ (1 << bit);
            this.buffer.setNumber(format, byteOffset, v);
        }

        // Short numeric accessors to reduce repetition and possibly flash size
        u16(off: number): number { return this.buffer.getNumber(NumberFormat.UInt16LE, off); }
        su16(off: number, v: number) { this.buffer.setNumber(NumberFormat.UInt16LE, off, v & 0xffff); }
        i16(off: number): number { return this.buffer.getNumber(NumberFormat.Int16LE, off); }
        si16(off: number, v: number) { this.buffer.setNumber(NumberFormat.Int16LE, off, v); }

        u8(off: number): number { return this.buffer.getNumber(NumberFormat.UInt8LE, off); }
        su8(off: number, v: number) { this.buffer.setNumber(NumberFormat.UInt8LE, off, v & 0xff); }



    }

    /* Construct a payload from a buffer. This is the central
    * place to add definitions for new payloads */
    function extractPayload(buffer: Buffer): RadioPayload {

        let packetType = buffer.getNumber(NumberFormat.UInt8LE, 0);

        switch (packetType) {
            case PayloadType.JOY:
                return radiop.JoyPayload.fromBuffer(buffer);
            case PayloadType.HERE_I_AM:
                return radiop.HereIAm.fromBuffer(buffer);
            case PayloadType.BOT_STATUS:
                return radiop.BotStatePayload.fromBuffer(buffer);
        }

        return undefined;
    }

    /**
     * Check if the radio is initialized
     * @returns true if the radio is initialized, false otherwise
     */
    //% blockId=radio_is_initialized block="is radio initialized"
    //% group="radio"
    export function isInitialized(): boolean {
        return initialized;
    }
    /**
     * Initialize the radio for joystick payloads
     * @param channel radio channel (default 1, range 1-100)
     * @param group radio group (default 1, range 1-254)  
     * @param power transmit power (default 7, range 1-7)
     */
    //% blockId=radio_init block="initialize radio on channel $channel group $group power $power"
    //% channel.min=1 channel.max=100 channel.defl=1
    //% group.min=1 group.max=254 group.defl=1
    //% power.min=1 power.max=7 power.defl=7
    //% group="radio"
    export function init(channel: number = BROADCAST_CHANNEL,
        group: number = BROADCAST_GROUP, power: number = 7) {
        
        if (initialized) {
            if (channel !== _channel || group !== _group) {
                // If channel or group changed, reinitialize
          
                setGroup(group);
                setChannel(channel);
                radio.setTransmitPower(power);
                broadcastHereIAm(); // Resend HereIAm message
            }
            return;
        }
        
        initialized = true;

        // Initialize radio
    // removed serial logging (initialized)
        setGroup(group);
        setChannel(channel);
        radio.setTransmitSerialNumber(true);
        
        if (power !== undefined) {
            radio.setTransmitPower(power);
        } else {
            radio.setTransmitPower(7);
        }
 
        // Set up radio packet received handler
        radio.onReceivedBuffer(function (buffer: Buffer) {
            
            let payload = extractPayload(buffer);

            let packetType = buffer.getNumber(NumberFormat.UInt8LE, 0);

            if (!payload) return;

            payload.packet = radio.lastPacket;
            
            // Handler specific to the payload type
            let handler = payload.handler;

            if (handler) {
                // handler for specific payload type
                handler(payload);
            }
            
            // Global payload handler if set
            if (payloadHandler) {
                // global payload handler
                payloadHandler(payload);
            } 
        });

    }

    export function initDefaults() {
        
        if (!initialized) {
            init(BROADCAST_CHANNEL, BROADCAST_GROUP, 7);
        }
    }

    /**
     * Set a global handler for any radio payload
     * @param handler function to handle the payload
     */
    //% blockId=radio_on_payload block="on radio extended payload"
    //% group="radio"
   export function onPayload(handler: (payload: RadioPayload) => void) {
       payloadHandler = handler;
   }




}