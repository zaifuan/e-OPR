// Senarai nombor halaman untuk dipaparkan, dengan ellipsis jika totalPages
// banyak (Bahagian P pindaan pagination). Contoh: current=6, total=20 ->
// [1, '...', 4, 5, 6, 7, 8, '...', 20].
function getPageNumbers(current, total) {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const pages = new Set([1, total, current]);
  for (let offset = 1; offset <= 2; offset += 1) {
    if (current - offset >= 1) pages.add(current - offset);
    if (current + offset <= total) pages.add(current + offset);
  }

  const sorted = Array.from(pages).sort((a, b) => a - b);
  const result = [];
  let prev = null;
  for (const p of sorted) {
    if (prev !== null && p - prev > 1) {
      result.push(`ellipsis-${p}`);
    }
    result.push(p);
    prev = p;
  }
  return result;
}

export default function Pagination({ page, totalPages, onPageChange }) {
  // Satu halaman sahaja - sembunyikan navigation sepenuhnya (Bahagian T pindaan).
  if (totalPages <= 1) return null;

  const pageNumbers = getPageNumbers(page, totalPages);

  return (
    <nav className="pagination" aria-label="Navigasi halaman Rekod OPR">
      <button
        type="button"
        className="pagination-nav"
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        aria-label="Halaman sebelumnya"
      >
        ‹
      </button>

      {pageNumbers.map((p) =>
        typeof p === 'number' ? (
          <button
            key={p}
            type="button"
            className={`pagination-page${p === page ? ' is-active' : ''}`}
            onClick={() => onPageChange(p)}
            aria-current={p === page ? 'page' : undefined}
          >
            {p}
          </button>
        ) : (
          <span key={p} className="pagination-ellipsis" aria-hidden="true">
            …
          </span>
        )
      )}

      <button
        type="button"
        className="pagination-nav"
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
        aria-label="Halaman seterusnya"
      >
        ›
      </button>
    </nav>
  );
}
