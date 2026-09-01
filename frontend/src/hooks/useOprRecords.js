import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client';

const DEBOUNCE_MS = 300;

// Hook khusus Rekod OPR (Fasa v4 + pindaan pagination) - pagination
// bernombor backend-side (bukan "Muat Lebih Banyak") + filter Tahun/Anjuran
// digabung dengan search Nama Program sedia ada.
//
// Reset ke page 1 setiap kali search/Tahun/Anjuran berubah (Bahagian K/AB
// pindaan) - HANYA perubahan page secara eksplisit (klik nombor/‹/›) yang
// mengekalkan page semasa.
export function useOprRecords() {
  const [queryInput, setQueryInput] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [year, setYearState] = useState('');
  const [organizer, setOrganizerState] = useState('');
  const [page, setPage] = useState(1);

  const [records, setRecords] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const abortRef = useRef(null);

  // Debounce HANYA teks carian (menaip pantas) - dropdown/page ialah
  // tindakan diskret, patut segera tanpa lengah.
  useEffect(() => {
    const timeoutId = setTimeout(() => setDebouncedQuery(queryInput.trim()), DEBOUNCE_MS);
    return () => clearTimeout(timeoutId);
  }, [queryInput]);

  // Search/filter berubah -> reset ke page 1 (Bahagian K/AB pindaan pagination).
  useEffect(() => {
    setPage(1);
  }, [debouncedQuery, year, organizer]);

  async function fetchPage(targetPage, signal) {
    return api.searchOpr({ q: debouncedQuery, year, organizer, page: targetPage }, signal);
  }

  useEffect(() => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError('');
    fetchPage(page, controller.signal)
      .then((data) => {
        setRecords(data.records);
        setTotal(data.total);
        setTotalPages(data.totalPages);
      })
      .catch((err) => {
        if (err.name !== 'AbortError') setError(err.message || 'Ralat memuatkan rekod OPR.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQuery, year, organizer, page]);

  // Selepas Admin padam rekod (Bahagian W pindaan pagination): jika page
  // semasa tidak lagi wujud (cth. rekod terakhir pada halaman terakhir
  // dipadam), pindah ke halaman sah terakhir secara automatik.
  const afterDelete = async () => {
    try {
      const data = await fetchPage(page);
      if (data.records.length === 0 && page > 1) {
        const safePage = Math.max(1, data.totalPages);
        const retry = await fetchPage(safePage);
        setRecords(retry.records);
        setTotal(retry.total);
        setTotalPages(retry.totalPages);
        setPage(safePage);
      } else {
        setRecords(data.records);
        setTotal(data.total);
        setTotalPages(data.totalPages);
      }
    } catch (err) {
      setError(err.message || 'Ralat memuatkan semula rekod OPR.');
    }
  };

  return {
    query: queryInput,
    setQuery: setQueryInput,
    year,
    setYear: setYearState,
    organizer,
    setOrganizer: setOrganizerState,
    page,
    setPage,
    records,
    total,
    totalPages,
    loading,
    error,
    afterDelete,
  };
}
