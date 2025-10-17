# Radio Relay

The radiop.RadioRelay class ( in `src/relay.ts` ) is a class thatallows a serial
client to send and recieve radio messages. 

When the object is constructed and `.run()` is called, the object
will read messages to send from the serial port and write messages
recieved from the serial port. Additionally, there are a few other commands

By default, the radio is set to channel 1, group 1 at construction. 

## Packet Spec




## Commands

* "s:" send a  message
* "r:" a message has been received
* "cgp:" Set the channel, group and optionally, power. 

### "s:" Send A message

The client sends 's:' to the Micro:bit to send a message. The message is encoded in 
Hex. 

Example: 

```
s: 030d130c00f376fcf20c0a010100010000000000000000000000000000000000
```

### "r:" Recieve a message

When the Microbit recieves a message, it sends to the serial port the recieve statement, 
which is the. full hex encoded buffer.

```
r: 030d130c00f376fcf20c0a010100010000000000000000000000000000000000
```

# 'cgp:' Set Channel, Group and Power

The `cgp` command sets the channel, group and power with three strings, which
can be either a number or a '.'. The '.' means to no change that value. 

```
cgp: 10 12 7
cgp: 10 5 . 
cgp: . . 5
```

## Other Features

When the microbit starts, it enters 'Normal' mode, which displays the Target
icon on the screen and reads and writes messages with commands. 

### Echo Mode

If the user presses the A button on the miccrobit, it will enter Echo mode.
Pressing it again wil exit Echo mode and return to Normal mode. 

In Echo mode, the Microbit displays the Duck icon and any message recieved will be
sent back out, without any changes, to the currently active channel and group. 

## Implementation. 

Send packets with `radio.sendRawPacke()`

Read packets by setting up a handler, like with this code from 
radio.ts:

```typescript

    radio.onDataReceived(function () {

        let buffer: Buffer = readRawPacket();
        ...
    }

```