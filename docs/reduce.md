# Reducing Program Size

The current build is brushing up against the micro:bit’s available flash. A pass through the TypeScript sources shows several hot spots that collectively pull in a lot of code and data.

## Why the Program Is Large

- **Heavy runtime helpers in `radiop.ts`.** The base `RadioPayload` class
  exposes a wide surface area (bit twiddlers, multiple integer/float getters,
  `toHex` wrappers, etc.). Even if only a subset is used, the compiler keeps the
  helper implementations, increasing code size.
- **Feature-rich relay (`pxt-src/relay.ts`).** `RadioRelay` brings in background
  loops, command parsing, chatter mode, string tokenisation, `serial.readLine`,
  and lots of string building (`toHex`, `payload.dump`, `serial.writeLine`). All
  of that drags in the JS string runtime and Buffer helpers.
- **Negotiation beacon (`pxt-src/negotiate.ts`).** The beacon runs a perpetual
  `control.inBackground` loop, does serial logging, triggers `basic.showIcon`,
  and allocates peer tables. Those APIs each add chunks of runtime support (icon
  images, map helpers, etc.).
- **Debug/diagnostic paths.** Every payload class implements `dump()`,
  `RadioRelay` prints them, and `negotiate.ts` logs beacon chatter. These
  strings live in flash and the associated formatting code sticks around.
- **Unused dependencies.** `pxt.json` still pulls in the `microphone` package
  even though nothing references it. Importing the extension forces the
  microphone driver and option menus into the build.
- **Wide packet definitions.** `BotCommandPayload` now carries motors, servos,
  and a 32-bit data field (19-byte payload). Chatter mode fills buffers with
  random bytes, so none of the accessors can be tree-shaken.

## How to Make It Smaller

1. **Strip or gate debug features.** Wrap `dump()` implementations, serial
   logging, and chatter mode behind a compile-time flag (e.g.
   `settings.readNumber("debug")` or a `Radiop.enableDebug()` toggle). Removing
   the string-heavy paths should reclaim several KB.
2. **Reduce dependencies.** Drop the unused `"microphone"` dependency and
   re-check the generated binary size. If the feature is needed only in certain
   builds, move it to an optional extension.
3. **Split development tools from the runtime.** The relay/debug helpers
   (`RadioRelay`, command parser, chatter) can live in a separate MakeCode
   extension so production builds include only the payload classes and
   negotiation helpers actually required on robots.
   `f32`, bit manipulation) are never called and remove them or move them to a
4. **Collapse helper surface area.** Audit which `RadioPayload` helpers (`u32`,
   debug-only mixin. Fewer exported methods translates to smaller generated
   code.
5. **Trim negotiation logging.** Replace the serial chatter in `initBeacon` with
   LED indications or gate it behind a `debugBeacon` flag. Consider shortening
   the scan loop (e.g. fewer `basic.showIcon` variants) to avoid pulling icon
   bitmaps.
6. **Review payload widths.** If the `BotCommand` servos or `data1` are
   optional, move them to a secondary packet type or pack them more tightly
   (e.g. shared scaling or bitfields). Smaller payloads let you reserve less
   buffer space and reduce helper code.
7. **Profile the compiled output.** Use `pxt build --stats` or inspect
   `yotta.json`/`mbdal-binary.asm` to find remaining large symbols. Target
   anything that isn’t required on-device (e.g. leftover helpers that only
   support the Python CLI).

These notes should give us a starting checklist for turning the current codebase
into a slim deployment build while keeping the rich tooling available for
development.