require('dotenv').config();
const readline = require('readline');
const pool = require('../src/db/pool');
const adminService = require('../src/services/admin.service');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

// Guna async iterator (bukan rl.question berulang) - rl.question yang dipanggil
// beberapa kali berturut-turut boleh terlepas baris input apabila input datang
// sekaligus (cth. dipaip/automation), kerana one-time 'line' listener didaftar
// terlalu lewat. Async iterator beratur (queue) setiap baris dengan betul.
const lines = rl[Symbol.asyncIterator]();

async function ask(question) {
  process.stdout.write(question);
  const { value, done } = await lines.next();
  if (done) return '';
  return value.trim();
}

// Masking input password dalam terminal interaktif. Jika stdin bukan TTY
// (cth. dijalankan melalui automation/testing), kembali kepada input biasa.
function askPassword(question) {
  if (!process.stdin.isTTY) {
    return ask(question);
  }

  return new Promise((resolve) => {
    const stdin = process.stdin;
    let password = '';

    process.stdout.write(question);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');

    const onData = (char) => {
      char = char.toString();
      switch (char) {
        case '\n':
        case '\r':
        case '\u0004':
          stdin.setRawMode(false);
          stdin.removeListener('data', onData);
          process.stdout.write('\n');
          resolve(password);
          break;
        case '\u0003': // Ctrl+C
          process.stdout.write('\n');
          process.exit(1);
          break;
        case '\u007f': // backspace
          password = password.slice(0, -1);
          break;
        default:
          password += char;
          break;
      }
    };

    stdin.on('data', onData);
  });
}

async function main() {
  console.log('=== Cipta Admin Pertama — Sistem OPR ===\n');

  const name = await ask('Nama: ');
  const username = await ask('Username: ');

  if (!name || !username) {
    console.error('\nNama dan username tidak boleh kosong.');
    process.exitCode = 1;
    return;
  }

  const existing = await adminService.findByUsername(username);
  if (existing) {
    console.error(`\nUsername "${username}" sudah wujud.`);
    process.exitCode = 1;
    return;
  }

  const password = await askPassword('Password (sekurang-kurangnya 12 aksara): ');
  const confirmPassword = await askPassword('Sahkan Password: ');

  if (password.length < 12) {
    console.error('\nPassword mesti sekurang-kurangnya 12 aksara.');
    process.exitCode = 1;
    return;
  }

  if (password !== confirmPassword) {
    console.error('\nPassword tidak sepadan.');
    process.exitCode = 1;
    return;
  }

  const admin = await adminService.createAdmin({ name, username, password });
  console.log(`\n✅ Admin "${admin.username}" berjaya dicipta (id: ${admin.id}).`);
}

main()
  .catch((err) => {
    console.error('\n❌ Gagal cipta admin:', err.message);
    process.exitCode = 1;
  })
  .finally(() => {
    rl.close();
    pool.end();
  });
