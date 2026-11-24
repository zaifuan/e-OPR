const crypto = require('crypto');
const { DESIGN_IDS } = require('../templates/designs');

// Kemas Kini 5: peraturan design BERSAMA untuk CREATE, DUPLICATE (= CREATE)
// dan EDIT - satu sumber kebenaran, tiada peraturan bercanggah.
//
// Medan borang: design_choice
//   CREATE/DUPLICATE: 'random' | salah satu ID dalam DESIGN_IDS (10 design, KK6)
//                     (tiada / kosong = 'random' - lalai borang)
//   EDIT            : salah satu ID dalam DESIGN_IDS
//                     (tiada / kosong = KEKALKAN design versi aktif;
//                      'random' DITOLAK - design tidak boleh bertukar rawak)
// Nilai lain (huruf besar, ruang, array/parameter berganda, ID tidak wujud)
// -> 400. 'random' TIDAK PERNAH disimpan: diselesaikan SEKALI di backend.

const RANDOM = 'random';
const DESIGN_MESSAGES = {
  invalid: 'Pilihan reka bentuk OPR tidak sah.',
  randomNotAllowed: 'Reka bentuk tidak boleh dipilih secara rawak semasa suntingan. Sila pilih satu reka bentuk.',
};

function isDesignId(value) {
  return typeof value === 'string' && DESIGN_IDS.includes(value);
}

// Pulangkan { ok: true, choice } | { ok: false, error }.
// choice: ID design, RANDOM, atau null (tiada pilihan).
function parseDesignChoice(raw, { allowRandom }) {
  if (raw === undefined || raw === null || raw === '') return { ok: true, choice: null };
  if (typeof raw !== 'string') return { ok: false, error: DESIGN_MESSAGES.invalid }; // cth. parameter berganda -> array
  if (raw === RANDOM) {
    return allowRandom ? { ok: true, choice: RANDOM } : { ok: false, error: DESIGN_MESSAGES.randomNotAllowed };
  }
  if (!isDesignId(raw)) return { ok: false, error: DESIGN_MESSAGES.invalid };
  return { ok: true, choice: raw };
}

// Pemilihan rawak seragam (crypto.randomInt - setiap design tepat 1/DESIGN_IDS.length;
// 10 design = 10% setiap satu sejak KK6).
function pickRandomDesign(randomInt = crypto.randomInt) {
  return DESIGN_IDS[randomInt(DESIGN_IDS.length)];
}

// CREATE/DUPLICATE: pilihan -> design SEBENAR yang akan disimpan.
function resolveDesignForCreate(choice) {
  if (choice === null || choice === RANDOM) return pickRandomDesign();
  return choice;
}

// EDIT: tiada pilihan -> kekal design semasa (tidak pernah rawak).
function resolveDesignForEdit(choice, currentDesignId) {
  if (choice === null) return isDesignId(currentDesignId) ? currentDesignId : 'original';
  return choice;
}

module.exports = {
  RANDOM,
  DESIGN_IDS,
  DESIGN_MESSAGES,
  isDesignId,
  parseDesignChoice,
  pickRandomDesign,
  resolveDesignForCreate,
  resolveDesignForEdit,
};
