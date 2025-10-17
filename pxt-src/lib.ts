
namespace radiop {

    /* Scramble the input using MurmurHash3. This can scramble the bits of the 
    * id of the Micro:bit, so we can use the last 12 for an id value. */
    export function murmur_32_scramble(k: number): number {
        k = Math.imul(k, 0xcc9e2d51);
        k = (k << 15) | (k >>> 17);  // rotate left 15 (use >>> for unsigned right shift)
        k = Math.imul(k, 0x1b873593);
        return k;
    }

    export function toHex(num: number): string {
        // Convert to 32-bit unsigned integer
        num = num >>> 0;

        let hex = "";
        const hexChars = "0123456789ABCDEF";

        // Extract each hex digit (4 bits at a time) from right to left
        for (let i = 0; i < 8; i++) {
            hex = hexChars[num & 0xF] + hex;
            num = num >>> 4;
        }


        return hex;
    }

    /* Scramble the machine id and return the last 12 bits,
    * to be used as a unique identifier, particularly useful for the IR paccket
    * ID value. */
    export function getUniqueId12(): number {
        let machineId = control.deviceSerialNumber();
        let scrambledId = murmur_32_scramble(machineId);
        // Return the last 12 bits
        return scrambledId & 0xFFF;
    } 


    
    /* Get an initial request for a radio channel and group, 
    * based on the scrambled machine id. */
    export function getInitialRadioRequest(): number[] {
        let machineId = control.deviceSerialNumber();
        let scrambledId = murmur_32_scramble(machineId);

        let c_range = radiop.CHANNEL_MAX - radiop.CHANNEL_MIN;
        let channel = ((scrambledId & 0x0FFFF000) >> 12) % c_range + radiop.CHANNEL_MIN; // 0-83
        
        let g_range = radiop.GROUP_MAX - radiop.GROUP_MIN;
        let group = (scrambledId & 0xFF) % g_range + radiop.GROUP_MIN; // 1-255

        return [channel, group];
    }


    // imageToInt: compress a 5x5 Image into a 25-bit number (bit index = y*5 + x, LSB = (0,0))
    export function imageToInt(img: Image): number {
        if (!img) return 0;
        let bits = 0;
        for (let y = 0; y < 5; y++) {
            for (let x = 0; x < 5; x++) {
                if (img.pixel(x, y)) bits |= (1 << (y * 5 + x));
            }
        }
        return bits >>> 0;
    }

    // intoToImage: expand a 25-bit number into a 5x5 Image (inverse of imageToInt)
    export function intToImage(bits: number): Image {
        let img = images.createImage(`
.....
.....
.....
.....
.....`);
        bits = bits >>> 0;
        for (let y = 0; y < 5; y++) {
            for (let x = 0; x < 5; x++) {
                let bit = (y * 5 + x);
                if (bits & (1 << bit)) img.setPixel(x, y, true);
            }
        }
        return img;
    }

}