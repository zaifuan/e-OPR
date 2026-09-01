import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client';

const DEBOUNCE_MS = 300;

// Dikongsi antara RekodOPR.jsx (awam) dan AdminDashboard.jsx (Bahagian 2
// spesifikasi Fasa 5: "Jangan bina search logic kedua") - live search dengan
// debounce + AbortController (elak respons lapuk menimpa hasil terkini) +
// pagination "Muat Lebih Banyak".
//
// hasMore kini berasaskan `total` yang dikembalikan backend (bukan heuristik
// lama "panjang senarai === saiz-halaman") - kekal betul walau saiz halaman
// backend berubah (Fasa Rekod OPR v4 menukar PAGE_SIZE 20->10 pada endpoint
// dikongsi ini).
export function useOprSearch() {
  const [query, setQuery] = useState('');
  const [records, setRecords] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const abortRef = useRef(null);

  useEffect(() => {
    const trimmed = query.trim();
    const timeoutId = setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setLoading(true);
      setError('');
      try {
        const data = trimmed
          ? await api.searchOpr({ q: trimmed, page: 1 }, controller.signal)
          : await api.recentOpr(controller.signal);
        setRecords(data.records);
        setPage(1);
        setHasMore(data.records.length < data.total);
      } catch (err) {
        if (err.name !== 'AbortError') {
          setError(err.message || 'Ralat mencari rekod OPR.');
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(timeoutId);
  }, [query]);

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const data = query.trim()
        ? await api.searchOpr({ q: query.trim(), page: nextPage })
        : await api.recentOpr();
      setRecords((prev) => [...prev, ...data.records]);
      setPage(nextPage);
      setHasMore(records.length + data.records.length < data.total);
    } catch (err) {
      setError(err.message || 'Ralat memuatkan lagi rekod.');
    } finally {
      setLoadingMore(false);
    }
  };

  // Buang satu rekod daripada senarai semasa (selepas padam berjaya) tanpa
  // fetch semula - kekalkan query search semasa (Bahagian 16 spesifikasi Fasa 5).
  const removeRecord = (id) => {
    setRecords((prev) => prev.filter((r) => r.id !== id));
  };

  return { query, setQuery, records, page, hasMore, loading, loadingMore, error, loadMore, removeRecord };
}
