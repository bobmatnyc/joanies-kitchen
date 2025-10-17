'use client';

import dynamic from 'next/dynamic';

export const Dialog = dynamic(() => import('./dialog').then((mod) => ({ default: mod.Dialog })), {
  ssr: false,
});

export const DialogContent = dynamic(
  () => import('./dialog').then((mod) => ({ default: mod.DialogContent })),
  { ssr: false }
);

export const DialogDescription = dynamic(
  () => import('./dialog').then((mod) => ({ default: mod.DialogDescription })),
  { ssr: false }
);

export const DialogFooter = dynamic(
  () => import('./dialog').then((mod) => ({ default: mod.DialogFooter })),
  { ssr: false }
);

export const DialogHeader = dynamic(
  () => import('./dialog').then((mod) => ({ default: mod.DialogHeader })),
  { ssr: false }
);

export const DialogTitle = dynamic(
  () => import('./dialog').then((mod) => ({ default: mod.DialogTitle })),
  { ssr: false }
);

export const DialogTrigger = dynamic(
  () => import('./dialog').then((mod) => ({ default: mod.DialogTrigger })),
  { ssr: false }
);
