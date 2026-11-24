// Kemas Kini 5/6: penjana lapisan CSS design (KK5 + 6 corak prototaip KK6). Hanya:
//   (1) menukar nilai pemboleh ubah warna sedia ada (--theme-*, --ink, --gray*)
//   (2) menambah corak melalui ::before/::after + box-shadow inset
// TIADA perubahan struktur HTML, saiz, kedudukan, margin, padding atau font.
// Semua corak terhad kepada ZON SELAMAT yang telah diukur (tiada teks).
const { DESIGNS } = require('./designs');

// Corak = SATU lapisan repeating-linear-gradient dengan warna LEGAP (diadun
// terlebih dahulu dengan warna latar zon). Diukur: lapisan tunggal legap
// menambah ~4KB pada PDF; gradient lutsinar/berlapis/radial & latar SVG
// dirasterkan oleh Chromium (+0.4 hingga +1.7MB) - dielakkan.
function hexToRgb(h) { const n = h.replace('#', ''); return [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16)); }
function mix(lineHex, alpha, bgHex) {
  const l = hexToRgb(lineHex), b = hexToRgb(bgHex);
  return '#' + l.map((v, i) => Math.round(v * alpha + b[i] * (1 - alpha)).toString(16).padStart(2, '0')).join('').toUpperCase();
}
function texture(kind, lineHex, alpha, bgHex) {
  const fg = mix(lineHex, alpha, bgHex);
  switch (kind) {
    case 'pinstripe': // Corporate: garis halus serong
      return `repeating-linear-gradient(135deg, ${fg} 0 0.35mm, ${bgHex} 0.35mm 2.2mm)`;
    case 'bands': // Nature: jalur tona mendatar
      return `repeating-linear-gradient(0deg, ${fg} 0 0.9mm, ${bgHex} 0.9mm 2.4mm)`;
    case 'doubleline': // Royal: garis berkembar serong
      return `repeating-linear-gradient(45deg, ${fg} 0 0.25mm, ${bgHex} 0.25mm 0.75mm, ${fg} 0.75mm 1mm, ${bgHex} 1mm 3.4mm)`;
    // ---- KK6: corak baharu (masih SATU lapisan legap; boleh ada 2 tona legap) ----
    case 'tide': { // Ocean: jalur pasang surut - dua tona, jarak tidak sekata
      const fg2 = mix(lineHex, alpha * 0.55, bgHex);
      return `repeating-linear-gradient(0deg, ${fg} 0 0.45mm, ${bgHex} 0.45mm 1.25mm, ${fg2} 1.25mm 1.55mm, ${bgHex} 1.55mm 3.1mm)`;
    }
    case 'softdiagonal': // Burgundy: diagonal lebar & lembut (formal)
      return `repeating-linear-gradient(45deg, ${fg} 0 1.1mm, ${bgHex} 1.1mm 3.2mm)`;
    case 'trunks': // Forest: garis menegak minimal (batang pokok), jarak berirama
      return `repeating-linear-gradient(90deg, ${fg} 0 0.3mm, ${bgHex} 0.3mm 1.5mm, ${fg} 1.5mm 1.75mm, ${bgHex} 1.75mm 4.2mm)`;
    case 'starline': { // Midnight: garis buruj halus 60deg, satu garis terang setiap tempoh
      const fg2 = mix(lineHex, alpha * 0.5, bgHex);
      return `repeating-linear-gradient(60deg, ${fg} 0 0.2mm, ${bgHex} 0.2mm 2.1mm, ${fg2} 2.1mm 2.25mm, ${bgHex} 2.25mm 4.6mm)`;
    }
    case 'tile': // Terracotta: tekstur jubin serong (jalur + garis nipis)
      return `repeating-linear-gradient(135deg, ${fg} 0 0.8mm, ${bgHex} 0.8mm 1.3mm, ${fg} 1.3mm 1.5mm, ${bgHex} 1.5mm 3.2mm)`;
    case 'technical': { // Graphite: garis teknikal - halus setiap 1.5mm, utama setiap 6mm
      const fg2 = mix(lineHex, alpha * 0.55, bgHex);
      return `repeating-linear-gradient(90deg, ${fg} 0 0.3mm, ${bgHex} 0.3mm 1.5mm, ${fg2} 1.5mm 1.62mm, ${bgHex} 1.62mm 3mm, ${fg2} 3mm 3.12mm, ${bgHex} 3.12mm 4.5mm, ${fg2} 4.5mm 4.62mm, ${bgHex} 4.62mm 6mm)`;
    }
    default:
      return 'none';
  }
}

function buildDesignCss(designId) {
  const d = Object.hasOwn(DESIGNS, designId) ? DESIGNS[designId] : null; // tolak 'constructor', '__proto__' dsb.
  if (!d) throw new Error(`Design tidak dikenali: ${designId}`);
  if (!d.palette) return ''; // ORIGINAL: tiada lapisan - HTML production tepat
  const p = d.palette;
  const t = d.pattern;
  const onPrimary = texture(t.kind, t.line, t.alphaOnPrimary, p.primary);
  const onDark = texture(t.kind, t.line, t.alphaOnDark, p.ink);
  const onTab = texture(t.kind, '#FFFFFF', 0.45, p.gray);
  return `
  /* === KK5 design: ${d.label} (lapisan warna & corak sahaja) === */
  body .opr-page {
    --theme-primary: ${p.primary};
    --theme-dark: ${p.dark};
    --theme-light: ${p.light};
    --theme-accent: ${p.accent};
    --ink: ${p.ink};
    --gray: ${p.gray};
    --gray-dark: ${p.grayDark};
  }
  /* Banner sisi: corak HANYA 14mm di hujung atas & bawah (teks terpanjang
     berhenti 16.4mm dari hujung). */
  body .side-banner::before,
  body .side-banner::after {
    content: ''; position: absolute; left: 0; right: 0; height: 14mm;
    background: ${onPrimary}; pointer-events: none;
  }
  body .side-banner::before { top: 0; }
  body .side-banner::after { bottom: 0; }
  /* Geo-top g-b (bentuk gelap): corak bermula x >= 142mm sahaja - bebas
     daripada huruf akhir "Report" (berakhir 138.7mm). Dalam clip-path g-b. */
  body .geo-top .g-b::after {
    content: ''; position: absolute; top: 0; bottom: 0; right: 0; left: 22%;
    background: ${onDark}; pointer-events: none;
  }
  /* Geo-top g-c (tab hiasan, tiada teks) */
  body .geo-top .g-c::after {
    content: ''; position: absolute; inset: 0;
    background: ${onTab}; pointer-events: none;
  }
  /* Jalur bawah: corak dalam bentuk warna utama (tiada teks) */
  body .geo-bottom-strip .g-a::after {
    content: ''; position: absolute; inset: 0;
    background: ${onPrimary}; pointer-events: none;
  }
  /* Segi tiga header (g-a): tona sederhana (palette.secondary) - di
     belakang "Report" putih DAN huruf "E" dalam "ONE PAGE" (geometri
     production; dalam Original "E" hanya ~1.7:1). Warna sahaja - bentuk,
     saiz & kedudukan tidak berubah; tiada penggandaan teks dalam PDF. */
  body .geo-top .g-a { background: ${p.secondary}; }
  /* Garis aksen nipis (box-shadow inset - tidak mengubah saiz elemen):
     bawah bar nama sekolah & atas footer, jauh daripada teks. */
  body .header-schoolbar { box-shadow: inset 0 -0.6mm 0 ${t.accentRule}; }
  body .footer { box-shadow: inset 0 0.7mm 0 ${t.accentRule}; }
  /* Footer: corak di hujung kiri & kanan sahaja (slogan 63-167mm). */
  body .footer::before,
  body .footer::after {
    content: ''; position: absolute; top: 0.7mm; bottom: 0; width: 28mm;
    background: ${onDark}; pointer-events: none;
  }
  body .footer::before { left: 0; }
  body .footer::after { right: 0; }
`;
}

// Suntik lapisan design ke HTML production (sebelum </head>). Original -> HTML asal tepat.
function applyDesign(html, designId) {
  const css = buildDesignCss(designId);
  if (!css) return html;
  return html.replace('</head>', `<style data-design="${designId}">${css}</style>\n</head>`);
}

module.exports = { buildDesignCss, applyDesign };
