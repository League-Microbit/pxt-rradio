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
    export const CHANNEL_MAX = 83; // Maximum channel number
    export const GROUP_MIN = radiop.BROADCAST_GROUP + 1; // Minimum group number
    export const GROUP_MAX = 255; // Maximum group number

    let _group: number = radiop.BROADCAST_GROUP;
    let _channel: number = radiop.BROADCAST_CHANNEL;

    let initialized = false;
    let _useStdHeader = false;

    let payloadHandler: (payload: RadioPayload) => void; // Handles any payload if no specific handler is set

    function copyBuffer(src: Buffer, dst: Buffer) {
        let len = Math.min(src.length, dst.length);
        for (let i = 0; i < len; i++) {
            dst.setNumber(NumberFormat.UInt8LE, i, src.getNumber(NumberFormat.UInt8LE, i));
        }
    }

    export function useStdHeader(flag?: boolean): boolean {
        if (flag !== undefined) {
            _useStdHeader = !!flag;
            radio.setTransmitSerialNumber(_useStdHeader);
        }
        return _useStdHeader;
    }

    // NOTE! The docs say that we can send 32 bytes, bbut there is a bug which will 
    // clobber the last three bytes: https://github.com/lancaster-university/codal-microbit-v2/issues/383
    // So you will generallt only be able to send 29. 

    export class RadioPacket {
        static readonly HEADER_SIZE = 9; // type + time (4 bytes) + serial (4 bytes)

        data: Buffer;

        constructor(size: number) {
            this.data = control.createBuffer(size);
            this.data.fill(0);
        }


        get signal() {
            return this.data.getNumber(NumberFormat.Int32LE, this.data.length - 4);
        }

        get packetType() {
            return this.data[0];
        }

        set packetType(val: number) {
            this.data[0] = val & 0xff;
        }

        get time() {
            return this.data.getNumber(NumberFormat.Int32LE, 1);
        }

        set time(val: number) {
            this.data.setNumber(NumberFormat.Int32LE, 1, val);
        }

        get serial() {
            return this.data.getNumber(NumberFormat.Int32LE, 5);
        }

        set serial(val: number) {
            this.data.setNumber(NumberFormat.Int32LE, 5, val);
        }

        sendPacket() {
            radio.sendRawPacket(this.data);
        }
    }

    export enum PayloadType {
        HERE_I_AM = 10,
        DISPLAY = 11,
        BOT_COMMAND = 20,
        BOT_STATUS = 21

    }

    export function newPacketByType(packetType: PayloadType): RadioPayload {
        switch (packetType) {
            case radiop.PayloadType.HERE_I_AM:
                return new radiop.HereIAm();
            case radiop.PayloadType.DISPLAY:
                return new radiop.DisplayPayload();
            case radiop.PayloadType.BOT_COMMAND:
                return new radiop.BotCommandPayload();
            case radiop.PayloadType.BOT_STATUS:
                return new radiop.BotStatusPayload();
        }
        return undefined;
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

    export class RadioPayload extends RadioPacket {

    readonly BYTE_POS_PACKET_TYPE = 0; // Position of packet type in the buffer
    readonly BYTE_POS_PAYLOAD_START = RadioPacket.HEADER_SIZE; // Position of payload start in the buffer
    static readonly MAX_PACKET_SIZE = 32; // Maximum raw packet length supported by the radio


        public packet: RadioPacket = undefined;

        constructor(packetType: number, size: number) {
            super(size);
            this.packetType = packetType;
        }

        protected adoptBuffer(buf: Buffer) {
            if (buf) {
                this.data = buf;
                this.packetType = this.data.getNumber(NumberFormat.UInt8LE, this.BYTE_POS_PACKET_TYPE);
            }
        }

        get time(): number {
            if (this.packet) {
                return this.packet.time;
            }
            return this.data.getNumber(NumberFormat.Int32LE, 1);
        }

        set time(val: number) {
            this.data.setNumber(NumberFormat.Int32LE, 1, val);
        }

        get serial(): number {
            if (this.packet) {
                return this.packet.serial;
            }
            return this.data.getNumber(NumberFormat.Int32LE, 5);
        }

        set serial(val: number) {
            this.data.setNumber(NumberFormat.Int32LE, 5, val);
        }

        get signal(): number {
            if (this.packet) {
                return this.packet.signal;
            }
            return this.data.getNumber(NumberFormat.Int32LE, this.data.length - 4);
        }
        static fromBuffer(buffer: Buffer): RadioPayload {
            return undefined;
        }

        getBuffer(): Buffer {
            return this.data;
        }

        getPacketType(): number {
            return this.packetType;
        }

        get payloadLength() {
            return Math.max(0, this.data.length - this.BYTE_POS_PAYLOAD_START);
        }

        get hash(): number {
            return this.data.hash(32);
        }

        get handler(): (payload: RadioPayload) => void {
            return undefined;
        }

        dump(): string {
            return "RadioPayload " + this.data.toHex();
        }

        send(): void {
            if (_useStdHeader) {
                this.time = control.millis();
                this.serial = control.deviceSerialNumber();
            }
            this.sendPacket();
        }

        protected payloadOffset(offset: number): number {
            return this.BYTE_POS_PAYLOAD_START + offset;
        }

        /** Get the value (0/1) of a bit within a number stored at a byte offset in the payload buffer.
         * @param byteOffset start of the number within the buffer
         * @param bit bit position (0 = least significant)
         * @param format numeric format (size determines how many bytes are read); default UInt8LE
         */
        getBit(byteOffset: number, bit: number, format: NumberFormat = NumberFormat.UInt8LE): number {
            if (bit < 0 || bit > 31) return 0;
            let v = this.data.getNumber(format, this.payloadOffset(byteOffset));
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
            let v = this.data.getNumber(format, this.payloadOffset(byteOffset));
            if (value ? true : false) v |= (1 << bit); else v &= ~(1 << bit);
            this.data.setNumber(format, this.payloadOffset(byteOffset), v);
        }

        /** Toggle (invert) a bit at the given position */
        toggleBit(byteOffset: number, bit: number, format: NumberFormat = NumberFormat.UInt8LE): void {
            if (bit < 0 || bit > 31) return;
            let v = this.data.getNumber(format, this.payloadOffset(byteOffset)) ^ (1 << bit);
            this.data.setNumber(format, this.payloadOffset(byteOffset), v);
        }

        // Short numeric accessors to reduce repetition and possibly flash size
        u8(off: number): number { return this.data.getNumber(NumberFormat.UInt8LE, this.payloadOffset(off)); }
        su8(off: number, v: number) { this.data.setNumber(NumberFormat.UInt8LE, this.payloadOffset(off), v & 0xff); }

        u16(off: number): number { return this.data.getNumber(NumberFormat.UInt16LE, this.payloadOffset(off)); }
        su16(off: number, v: number) { this.data.setNumber(NumberFormat.UInt16LE, this.payloadOffset(off), v & 0xffff); }

        i16(off: number): number { return this.data.getNumber(NumberFormat.Int16LE, this.payloadOffset(off)); }
        si16(off: number, v: number) { this.data.setNumber(NumberFormat.Int16LE, this.payloadOffset(off), v); }

        u32(off: number): number { return this.data.getNumber(NumberFormat.UInt32LE, this.payloadOffset(off)); }
        su32(off: number, v: number) { this.data.setNumber(NumberFormat.UInt32LE, this.payloadOffset(off), v >>> 0); }

        i32(off: number): number { return this.data.getNumber(NumberFormat.Int32LE, this.payloadOffset(off)); }
        si32(off: number, v: number) { this.data.setNumber(NumberFormat.Int32LE, this.payloadOffset(off), v | 0); }

        f32(off: number): number { return this.data.getNumber(NumberFormat.Float32LE, this.payloadOffset(off)); }
        sf32(off: number, v: number) { this.data.setNumber(NumberFormat.Float32LE, this.payloadOffset(off), v); }

    }

    export function clip(x: number, min: number, max: number): number {
        return Math.max(min, Math.min(max, x));
    }

    /* Construct a payload from a buffer. This is the central
    * place to add definitions for new payloads */
    export function extractPayload(buffer: Buffer): RadioPayload {

        let packetType = buffer.getNumber(NumberFormat.UInt8LE, 0);

        switch (packetType) {
            case radiop.PayloadType.HERE_I_AM:
                return radiop.HereIAm.fromBuffer(buffer);
            case radiop.PayloadType.DISPLAY:
                return radiop.DisplayPayload.fromBuffer(buffer);
            case radiop.PayloadType.BOT_COMMAND:
                return radiop.BotCommandPayload.fromBuffer(buffer);
            case radiop.PayloadType.BOT_STATUS:
                return radiop.BotStatusPayload.fromBuffer(buffer);
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
          
                radiop.setGroup(group);
                radiop.setChannel(channel);
                radio.setTransmitPower(power);
                broadcastHereIAm(); // Resend HereIAm message
            }
            return;
        }
        
        initialized = true;

        // Initialize radio
        // removed serial logging (initialized)
    radiop.setGroup(group);
    radiop.setChannel(channel);
        useStdHeader(true);
            
        if (power !== undefined) {
            radio.setTransmitPower(power);
        } else {
            radio.setTransmitPower(7);
        }

        // Set up radio packet received handler
        radio.onDataReceived(function () {

            let buffer: Buffer = radio.readRawPacket();

            return;

            let payload = extractPayload(buffer);

            let packetType = buffer.getNumber(NumberFormat.UInt8LE, 0);

            if (!payload) return;

            return

            //payload.packet = RadioPacket.fromIncoming(buffer, radio.lastPacket);
            
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