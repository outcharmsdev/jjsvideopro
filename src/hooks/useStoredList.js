import { useEffect, useState } from 'react';

export default function useStoredList(key, max) {
  const [list, setList] = useState(() => JSON.parse(localStorage.getItem(key) || '[]'));
  useEffect(() => { localStorage.setItem(key, JSON.stringify(list)); }, [key, list]);
  return {
    list,
    add: (item) => setList((l) => [item, ...l].slice(0, max)),
    remove: (id) => setList((l) => l.filter((i) => i.id !== id)),
    update: (id, patch) => setList((l) => l.map((i) => (i.id === id ? { ...i, ...patch } : i))),
    clear: () => setList([]),
  };
}