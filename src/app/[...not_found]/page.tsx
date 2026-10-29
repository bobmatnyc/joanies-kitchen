import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { NOT_FOUND_METADATA } from '@/lib/not-found-metadata';

// #138: this page only ever renders a 404; its own metadata is what the client keeps.
export const metadata: Metadata = NOT_FOUND_METADATA;

export default function CatchAll() {
  notFound();
}
