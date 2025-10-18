/*
The RadioRelay reads messages from the serial port and send them over the radio. 

It also has an Echo mode for testing: when Echo mode is on, any received 
radio message is sent back out immediately, and payloads are dumped to serial.
*/

namespace radiop {

    const CMD_SEND = "s:";
    const CMD_RECEIVE = "r:";
    const CMD_CGP = "cgp:";

    export class RadioRelay {
        private running = false;
        private echoMode = false;
        private chatterMode = false;
        private chatterDeadline = 0;

        constructor() {
            radiop.initDefaults();
            radiop.useStdHeader(false);
            this.updateStatusIcon();
            serial.setRxBufferSize(128);
            serial.setTxBufferSize(128);
            serial.writeLine("RadioRelay");
        }

        run() {
            if (this.running) return;
            this.running = true;
            this.registerRadioHook();
            control.inBackground(() => this.loop());
            input.onButtonPressed(Button.A, () => this.toggleEcho());
            input.onButtonPressed(Button.B, () => this.toggleChatter());
        }

        private registerRadioHook() {
            const self = this;
            radio.onDataReceived(function () {
                const buffer = radio.readRawPacket();
                const hex = buffer.toHex();
                serial.writeLine(CMD_RECEIVE + " " + hex);

                const payload = radiop.extractPayload(buffer);
                if (payload) {
                    
                    if (self.echoMode) {
                        radio.sendRawPacket(buffer);
                        serial.writeLine("e: " + payload.dump());

                    } else {
                        serial.writeLine("p: " + payload.dump());

                    }
                } 
            });
        }

        private loop() {
            while (this.running) {
                this.maybeSendChatter();
                const line = serial.readLine();

                if (!line) {
                    basic.pause(10);
                    continue;
                }
                this.processCommand(line.trim());
            }
        }

        private processCommand(line: string) {

            if (line.length === 0) return;

            if (line.indexOf(CMD_SEND) === 0) {
                const payloadHex = line.substr(CMD_SEND.length).trim();
                // We need to add sizeof(int) to the end of the buffer, because radio.sendRawPacket
                // will cut them off otherwise ( it uses these bytes for reporting signal strength )
                const buf: Buffer = Buffer.fromHex(payloadHex+'00000000'); // pad to avoid truncation
                if (buf) {
                    serial.writeLine("S: " + buf.toHex());
                    radio.sendRawPacket(buf);
                }
                return;
            }

            if (line.indexOf(CMD_CGP) === 0) {
                const parts = this.parseCGP(line.substr(CMD_CGP.length));
                this.applyCGP(parts.channel, parts.group, parts.power);
                return;
            }
        }

        private parseCGP(arg: string) {
            const tokens = splitWhitespace(arg.trim());
            let channel: number = undefined;
            let group: number = undefined;
            let power: number = undefined;
            if (tokens.length > 0 && tokens[0] !== ".") channel = parseInt(tokens[0]);
            if (tokens.length > 1 && tokens[1] !== ".") group = parseInt(tokens[1]);
            if (tokens.length > 2 && tokens[2] !== ".") power = parseInt(tokens[2]);
            return {
                channel: channel,
                group: group,
                power: power
            };
        }

        private applyCGP(channel?: number, group?: number, power?: number) {
            if (channel !== undefined && !isNaN(channel)) {
                radiop.setChannel(channel);
            }
            if (group !== undefined && !isNaN(group)) {
                radiop.setGroup(group);
            }
            if (power !== undefined && !isNaN(power)) {
                radio.setTransmitPower(power);
            }
        }

        private toggleEcho() {
            this.echoMode = !this.echoMode;
            this.chatterMode = false;
            serial.writeLine("Echo mode: " + (this.echoMode ? "ON" : "OFF"));
            this.updateStatusIcon();
        }

        private toggleChatter() {
            this.chatterMode = !this.chatterMode;
            this.echoMode = false;
            if (this.chatterMode) {
                this.chatterDeadline = 0;
            }
            serial.writeLine("Chatter mode: " + (this.chatterMode ? "ON" : "OFF"));
            this.updateStatusIcon();
        }

        private updateStatusIcon() {
            if (this.chatterMode) {
                basic.showString("C");
            } else if (this.echoMode) {
                basic.showString("E");
            } else {
                basic.showIcon(IconNames.Target);
            }
        }

        private maybeSendChatter() {
            if (!this.chatterMode) return;
            const now = control.millis();
            if (now < this.chatterDeadline) return;
            this.chatterDeadline = now + 3000;
            
            const pick = randint(0, 3);
            let packetType: PayloadType;
            if (pick == 0) packetType = PayloadType.HERE_I_AM;
            else if (pick == 1) packetType = PayloadType.DISPLAY;
            else if (pick == 2) packetType = PayloadType.BOT_COMMAND;
            else packetType = PayloadType.BOT_STATUS;

            const packet = radiop.newPacketByType(packetType);
            if (!packet) return;

            const buf = packet.getBuffer();
            for (let i = 1; i < buf.length; i++) {
                buf[i] = randint(0, 255);
            }

            packet.send();
            serial.writeLine("P: " + packet.dump());
        }
    }


    function splitWhitespace(text: string): string[] {
        const result: string[] = [];
        let current = "";
        for (let i = 0; i < text.length; i++) {
            const ch = text.charAt(i);
            if (ch <= " ") {
                if (current.length > 0) {
                    result.push(current);
                    current = "";
                }
            } else {
                current += ch;
            }
        }
        if (current.length > 0) result.push(current);
        return result;
    }
}