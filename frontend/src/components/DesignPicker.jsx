import { DESIGN_OPTIONS, RANDOM_DESIGN } from '../utils/designOptions';

// Kemas Kini 5: "PILIH REKA BENTUK OPR".
// Butang radio sebenar (tersembunyi secara visual) di dalam setiap kad -
// boleh diakses dengan papan kekunci (Tab ke kumpulan, anak panah untuk
// bertukar, Space untuk pilih) dan pembaca skrin. Pratonton dilukis dengan
// CSS (warna & corak sebenar design) - ringan, tiada imej/PDF.
function MiniPage({ design }) {
  const c = design.colors;
  return (
    <div className="design-mini" aria-hidden="true" style={{ '--d-primary': c.primary, '--d-secondary': c.secondary, '--d-ink': c.ink, '--d-tab': c.tab, '--d-light': c.light }}>
      <span className="design-mini-banner" style={design.pattern ? { backgroundImage: `${design.pattern}, ${design.pattern}` } : undefined} />
      <span className="design-mini-head-a" />
      <span className="design-mini-head-b" style={design.pattern ? { backgroundImage: design.pattern.replaceAll(c.primary, c.ink) } : undefined} />
      <span className="design-mini-tab" />
      <span className="design-mini-bar" style={c.rule ? { boxShadow: `inset 0 -2px 0 ${c.rule}` } : undefined} />
      <span className="design-mini-lines" />
      <span className="design-mini-photos" />
      <span className="design-mini-footer" style={c.rule ? { boxShadow: `inset 0 2px 0 ${c.rule}` } : undefined} />
    </div>
  );
}

export default function DesignPicker({ value, onChange, allowRandom = true, error }) {
  const name = 'design_choice';
  return (
    <fieldset className="design-picker">
      <legend>Pilih Reka Bentuk OPR</legend>
      <span className="field-hint">
        {allowRandom
          ? 'Pilih satu reka bentuk, atau biarkan sistem memilih secara rawak. Susun atur, gambar dan kandungan adalah sama - hanya warna berbeza.'
          : 'Reka bentuk semasa dikekalkan. Anda boleh memilih reka bentuk lain sebagai sebahagian daripada pembetulan.'}
      </span>

      {allowRandom && (
        <label className={`design-card design-card-random${value === RANDOM_DESIGN ? ' is-selected' : ''}`}>
          <input
            type="radio"
            name={name}
            value={RANDOM_DESIGN}
            checked={value === RANDOM_DESIGN}
            onChange={() => onChange(RANDOM_DESIGN)}
          />
          <span className="design-random-icon" aria-hidden="true">
            {/* Kemas Kini 6: satu petak bagi setiap design (dijana daripada senarai). */}
            {DESIGN_OPTIONS.map((d) => (
              <span key={d.id} style={{ background: d.colors.primary }} />
            ))}
          </span>
          <span className="design-card-text">
            <strong>Random</strong>
            <span>Sistem memilih satu daripada {DESIGN_OPTIONS.length} reka bentuk secara rawak (peluang sama)</span>
          </span>
        </label>
      )}

      <div className="design-grid">
        {DESIGN_OPTIONS.map((d) => (
          <label key={d.id} className={`design-card${value === d.id ? ' is-selected' : ''}`}>
            <input type="radio" name={name} value={d.id} checked={value === d.id} onChange={() => onChange(d.id)} />
            <MiniPage design={d} />
            <span className="design-card-text">
              <strong>{d.label}</strong>
              <span>{d.note}</span>
            </span>
          </label>
        ))}
      </div>
      {error && <span className="form-error">{error}</span>}
    </fieldset>
  );
}
