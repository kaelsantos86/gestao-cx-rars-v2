'use client';

import { useEffect } from 'react';

export function FeedbackNewEnhancer() {
  useEffect(() => {
    const flow = document.getElementById('feedbackFlow') as HTMLSelectElement | null;
    const recognitionMode = document.getElementById('recognitionMode') as HTMLSelectElement | null;
    if (!flow || !recognitionMode) return;

    const orientation = document.querySelector('[data-feedback-flow="orientation"]') as HTMLElement | null;
    const recognition = document.querySelector('[data-feedback-flow="recognition"]') as HTMLElement | null;
    const promotion = document.querySelector('[data-recognition-mode="promotion"]') as HTMLElement | null;

    const setSection = (section: HTMLElement | null, visible: boolean) => {
      if (!section) return;
      section.style.display = visible ? '' : 'none';
      section.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('input, textarea, select').forEach((field) => {
        field.disabled = !visible;
      });
    };

    const sync = () => {
      const isRecognition = flow.value === 'recognition';
      setSection(orientation, !isRecognition);
      setSection(recognition, isRecognition);
      setSection(promotion, isRecognition && recognitionMode.value === 'promotion');
    };

    sync();
    flow.addEventListener('change', sync);
    recognitionMode.addEventListener('change', sync);
    return () => {
      flow.removeEventListener('change', sync);
      recognitionMode.removeEventListener('change', sync);
    };
  }, []);

  return null;
}
