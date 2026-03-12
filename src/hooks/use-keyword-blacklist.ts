import { useCallback, useMemo, useState } from "react";

import {
  addKeywordToBlacklist,
  readKeywordBlacklist,
  removeKeywordFromBlacklist,
  normalizeWord,
} from "@/utils/keywords";

export function useKeywordBlacklist() {
  const [items, setItems] = useState<string[]>(() => readKeywordBlacklist());

  const add = useCallback((word: string) => {
    const next = addKeywordToBlacklist(word);
    setItems(next);
    return next;
  }, []);

  const remove = useCallback((word: string) => {
    const next = removeKeywordFromBlacklist(word);
    setItems(next);
    return next;
  }, []);

  const has = useCallback((word: string) => {
    const normalized = normalizeWord(word);
    return !!normalized && items.includes(normalized);
  }, [items]);

  const blacklistSet = useMemo(() => new Set(items), [items]);

  return {
    items,
    blacklistSet,
    add,
    remove,
    has,
  };
}
