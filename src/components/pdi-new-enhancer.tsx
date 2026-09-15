'use client';

import { useEffect } from 'react';

export function PdiNewEnhancer() {
  useEffect(() => {
    const cycleType = document.getElementById('cycleType') as HTMLSelectElement | null;
    const extraordinaryReason = document.getElementById('extraordinaryReason') as HTMLTextAreaElement | null;
    if (!cycleType || !extraordinaryReason) return;

    const field = extraordinaryReason.closest('.field') as HTMLElement | null;

    const syncExtraordinaryReason = () => {
      const isExtraordinary = cycleType.value === 'extraordinary_review';
      if (field) field.style.display = isExtraordinary ? 'grid' : 'none';
      extraordinaryReason.required = isExtraordinary;
      if (!isExtraordinary) extraordinaryReason.value = '';
    };

    syncExtraordinaryReason();
    cycleType.addEventListener('change', syncExtraordinaryReason);
    return () => cycleType.removeEventListener('change', syncExtraordinaryReason);
  }, []);

  return null;
}
