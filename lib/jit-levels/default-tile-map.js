/**
 * Default Lunar Magic tile-to-ASCII map (from default_tile_map.h)
 */

const TILE_TO_ASCII = new Array(256).fill(0);
[
  'A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P',
  'Q','R','S','T','U','V','W','X','Y','Z','!','.','-',',','?',' ',
].forEach((ch, i) => { TILE_TO_ASCII[i] = ch.charCodeAt(0); });
TILE_TO_ASCII[0x32] = 'I'.charCodeAt(0);
TILE_TO_ASCII[0x33] = 'L'.charCodeAt(0);
TILE_TO_ASCII[0x34] = 'L'.charCodeAt(0);
TILE_TO_ASCII[0x35] = 'U'.charCodeAt(0);
TILE_TO_ASCII[0x36] = 'S'.charCodeAt(0);
TILE_TO_ASCII[0x37] = 'I'.charCodeAt(0);
TILE_TO_ASCII[0x38] = 'Y'.charCodeAt(0);
TILE_TO_ASCII[0x39] = 'E'.charCodeAt(0);
TILE_TO_ASCII[0x3A] = 'L'.charCodeAt(0);
TILE_TO_ASCII[0x3B] = 'O'.charCodeAt(0);
TILE_TO_ASCII[0x3C] = 'W'.charCodeAt(0);
TILE_TO_ASCII[0x3D] = '?'.charCodeAt(0);
TILE_TO_ASCII[0x3F] = '!'.charCodeAt(0);
for (let i = 0x40; i <= 0x4f; i++) TILE_TO_ASCII[i] = 'a'.charCodeAt(0) + (i - 0x40);
for (let i = 0x50; i <= 0x59; i++) TILE_TO_ASCII[i] = 'q'.charCodeAt(0) + (i - 0x50);
TILE_TO_ASCII[0x5A] = '#'.charCodeAt(0);
TILE_TO_ASCII[0x5B] = '('.charCodeAt(0);
TILE_TO_ASCII[0x5C] = ')'.charCodeAt(0);
TILE_TO_ASCII[0x5D] = "'".charCodeAt(0);
for (let i = 0x63; i <= 0x6c; i++) TILE_TO_ASCII[i] = '0'.charCodeAt(0) + (i - 0x63);

function smwCharacterLookup(charcode) {
  switch (charcode) {
    case 0x00: return 'A'; case 0x01: return 'B'; case 0x02: return 'C';
    case 0x03: return 'D'; case 0x04: return 'E'; case 0x05: return 'F';
    case 0x06: return 'G'; case 0x07: return 'H'; case 0x08: return 'I';
    case 0x09: return 'J'; case 0x0A: return 'K'; case 0x0B: return 'L';
    case 0x0C: return 'M'; case 0x0D: return 'N'; case 0x0E: return 'O';
    case 0x0F: return 'P'; case 0x10: return 'Q'; case 0x11: return 'R';
    case 0x12: return 'S'; case 0x13: return 'T'; case 0x14: return 'U';
    case 0x15: return 'V'; case 0x16: return 'W'; case 0x17: return 'X';
    case 0x18: return 'Y'; case 0x19: return 'Z';
    case 0x1A: return '!'; case 0x1B: return '.'; case 0x1C: return '-';
    case 0x1D: return ','; case 0x1E: return '?'; case 0x1F: return ' ';
    case 0x5A: return '#';
    case 0x5B: return '('; case 0x5C: return ')';
    case 0x64: return '1'; case 0x65: return '2'; case 0x66: return '3';
    case 0x67: return '4'; case 0x68: return '5'; case 0x69: return '6';
    case 0x6A: return '7'; case 0x6B: return '8'; case 0x6C: return '9';
    case 0x9F: return ' '; case 0xFC: return ' ';
    default: {
      const mapped = TILE_TO_ASCII[charcode & 0xff];
      return mapped ? String.fromCharCode(mapped) : '';
    }
  }
}

module.exports = {
  TILE_TO_ASCII,
  smwCharacterLookup,
};
