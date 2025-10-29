import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "What's in Your Fridge?",
  description:
    "Enter what's in your fridge and find delicious recipes you can make right now. AI-powered matching with smart substitutions for missing ingredients. Zero waste, maximum flavor.",
  openGraph: {
    title: "Cook From Your Fridge | Joanie's Kitchen",
    description:
      "Tell us what you have. We'll find recipes you can make right now with smart substitutions.",
    url: '/fridge',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Cook From Your Fridge',
    description: 'Find recipes for what you have. Stop food waste. Start cooking.',
  },
  alternates: {
    canonical: '/fridge',
  },
};

export default function FridgeLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
