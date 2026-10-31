import type { Metadata } from 'next';
import { socialImages } from '@/lib/default-og-image';

// #256: this segment's openGraph/twitter replace the root ones whole, so name the default image.
const social = socialImages();

export const metadata: Metadata = {
  title: "What's in Your Fridge?",
  description:
    "Enter what's in your fridge and find delicious recipes you can make right now. AI-powered matching with smart substitutions for missing ingredients. Zero waste, maximum flavor.",
  openGraph: {
    title: "Cook From Your Fridge | Joanie's Kitchen",
    description:
      "Tell us what you have. We'll find recipes you can make right now with smart substitutions.",
    url: '/fridge',
    images: social.openGraph,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Cook From Your Fridge',
    description: 'Find recipes for what you have. Stop food waste. Start cooking.',
    images: social.twitter,
  },
  alternates: {
    canonical: '/fridge',
  },
};

export default function FridgeLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
