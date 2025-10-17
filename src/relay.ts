namespace radiop {

    const CMD_SEND = "s:";
    const CMD_RECEIVE = "r:";
    const CMD_CGP = "cgp:";

    export class RadioRelay {
        private running = false;
        private echoMode = false;

        constructor() {
            radiop.initDefaults();
            radiop.useStdHeader(true);
            basic.showIcon(IconNames.Target);
            serial.setRxBufferSize(128);
            serial.setTxBufferSize(128);
        }

        run() {
            if (this.running) return;
            this.running = true;
            this.registerRadioHook();
            control.inBackground(() => this.loop());
            input.onButtonPressed(Button.A, () => this.toggleEcho());
        }

        private registerRadioHook() {
            radio.onDataReceived(function () {
                let buffer: Buffer = radio.readRawPacket();
                
                const hex = buffer.toHex();
      
                serial.writeLine(CMD_RECEIVE+" " + hex);
                if (this.echoMode) {
                    radio.sendRawPacket(buffer);
                    serial.writeLine("e: " + hex);
                }
            });
        }

        private loop() {
            while (this.running) {
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
            basic.showIcon(this.echoMode ? IconNames.Duck : IconNames.Target);
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