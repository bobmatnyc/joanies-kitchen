'use client';

import dynamic from 'next/dynamic';

const Toaster = dynamic(() => import('sonner').then((mod) => mod.Toaster), { ssr: false });

export function ToastProvider() {
  return (
    <Toaster
      position="bottom-right"
      toastOptions={{
        duration: 4000,
      }}
    />
  );
}
