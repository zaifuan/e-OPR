const fs = require('fs');

// Semak byte sebenar fail, bukan MIME type yang didakwa client (boleh dipalsukan)
// atau extension nama fail. Hanya 3 format disokong - cukup mudah untuk disemak
// secara manual tanpa dependency tambahan.
function detectImageType(filePath) {
  const fd = fs.openSync(filePath, 'r');
  let buffer;
  try {
    buffer = Buffer.alloc(16);
    const bytesRead = fs.readSync(fd, buffer, 0, 16, 0);
    buffer = buffer.subarray(0, bytesRead);
  } finally {
    fs.closeSync(fd);
  }

  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }

  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'image/png';
  }

  if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'image/webp';
  }

  return null;
}

module.exports = { detectImageType };
