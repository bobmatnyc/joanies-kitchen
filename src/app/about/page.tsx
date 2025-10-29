import { BookOpen } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: "About Joanie | Joanie's Kitchen",
  description:
    "Meet Joanie — a trained chef, lifelong gardener, and volunteer firefighter who cooks from her terraced home overlooking the Hudson River, turning 'nothing in the fridge' into something unforgettable.",
};

// ISR: Revalidate about page daily
// This is mostly static content that rarely changes
export const revalidate = 86400; // 24 hours

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-jk-linen">
      {/* Header */}
      <div className="bg-jk-olive text-jk-linen py-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="font-heading text-6xl text-jk-linen mb-4">About Joanie</h1>
          <p className="text-2xl text-jk-sage italic font-body">
            Cook With What You Have. Waste Nothing.
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-5xl mx-auto px-4 py-16">
        <div className="bg-white border-2 border-jk-sage rounded-jk p-8 lg:p-12 mb-12 shadow-sm">
          {/* Portrait */}
          <div className="float-left mr-8 mb-6 w-64 lg:w-80">
            <img
              src="/joanie-portrait.png"
              alt="Joanie in her kitchen"
              className="w-full rounded-jk border-4 border-jk-sage shadow-md"
            />
            <p className="text-sm text-jk-clay italic mt-2 text-center font-body">
              Joanie in her element — cooking with the seasons
            </p>
          </div>

          <div className="font-body text-lg text-jk-charcoal/80 space-y-6 leading-relaxed">
            <p>
              Joanie grew up in upstate New York, where she helped her dad run his children's
              clothing store — an early lesson in creativity, community, and persistence. After
              studying at Brandeis and the London School of Economics, she launched a fast-paced
              career as a bond trader in London and New York. But Joanie's path has always been full
              of twists, each one adding another layer of texture to her story.
            </p>

            <p>
              She's raised two wonderful sons, run a carpet wholesale business, worked as an energy
              auditor, and now serves as a volunteer firefighter in Hastings-on-Hudson — where she
              lives with her partner, Masa, in a home nestled in the hills overlooking the Hudson
              River. When she's not cooking or tending her garden, you'll find her paddleboarding on
              the river or sharing glimpses of her life at{' '}
              <a
                href="https://www.instagram.com/terracesonward/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-jk-tomato hover:text-jk-tomato/80 underline"
              >
                @terracesonward
              </a>
              .
            </p>

            <p>
              Cooking has been her lifelong rhythm. Joanie began experimenting in her London
              kitchen, later trained in culinary school, and spent time as a professional chef. Her
              food is deeply personal — inspired by what's growing, what's on hand, and who's at the
              table.
            </p>

            <div className="clear-both"></div>

            <p>
              Her love of growing things runs deep, too. When she lived in Dobbs Ferry, her small
              farm,{' '}
              <a
                href="https://www.facebook.com/langdonfarm/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-jk-tomato hover:text-jk-tomato/80 underline"
              >
                Langdon Farms
              </a>
              , was beloved by local restaurants for its famous tomatoes and vibrant produce. Today
              in Hastings, she and Masa cultivate an eclectic mix of tomatoes, ground cherries,
              eggplant, peppers, watermelon, squash, kale, collards, figs, cucumbers, and shiso —
              always enough to share.
            </p>

            <p>
              Joanie is known for her "nothing in the fridge" challenge — the art of transforming a
              handful of odds and ends into an extraordinary meal. Her cooking is jazz-like:
              instinctive, improvisational, and full of heart. Whether it's her fiery tom yum soup,
              ground lamb in delicata squash, or silky mapo tofu, Joanie's food celebrates what's
              real, seasonal, and joyful — from garden to table.
            </p>

            <blockquote className="border-l-4 border-jk-tomato pl-6 py-4 my-8 italic text-jk-clay text-2xl font-body">
              "Cooking is like jazz — you just start with what you have, listen, and let it flow."
            </blockquote>

            <h3 className="font-heading text-3xl text-jk-olive mt-12 mb-4">
              What You'll Find Here
            </h3>

            <p>
              This site helps you cook resourcefully with what you have. Browse 3,200+ flexible
              recipes where substitutions are encouraged, not exceptions. You'll find Joanie's
              personal favorites in <strong className="text-jk-tomato">Joanie's Collection</strong>{' '}
              — seasonal, adaptable recipes tested in her own "nothing in the fridge" challenges.
            </p>

            <p>
              Whether you're looking for a simple weeknight dinner or a special occasion feast, we
              hope these recipes inspire you to slow down, cook with care, and enjoy the ritual of
              making a meal from scratch. And if you try something, we'd love to hear about it.
            </p>

            <p className="font-heading text-3xl text-jk-olive mt-8">Welcome to Joanie's Kitchen.</p>

            <p className="font-heading text-2xl text-jk-clay italic">— Joanie</p>
          </div>
        </div>

        {/* Photo Gallery Link */}
        <div className="mb-12 bg-gradient-to-br from-jk-tomato to-jk-clay rounded-jk p-8 text-center">
          <h3 className="font-heading text-2xl text-jk-linen mb-3">Moments from the Kitchen</h3>
          <p className="text-jk-linen/90 mb-6 max-w-2xl mx-auto font-body">
            Explore photos from Joanie's kitchen, garden, and table — where fresh ingredients become
            unforgettable meals.
          </p>
          <Link href="/about/photos">
            <Button
              variant="outline"
              size="lg"
              className="bg-jk-linen hover:bg-white text-jk-tomato border-2 border-jk-linen hover:border-white font-ui font-medium text-lg px-8 py-6 rounded-jk"
            >
              View Photo Gallery
            </Button>
          </Link>
        </div>

        {/* Product Roadmap Link */}
        <div className="mb-12 bg-gradient-to-br from-jk-olive to-jk-clay rounded-jk p-8 text-center">
          <h3 className="font-heading text-2xl text-jk-linen mb-3">Building in the Open</h3>
          <p className="text-jk-linen/90 mb-6 max-w-2xl mx-auto font-body">
            Joanie's Kitchen is growing every day. See what we've built, what we're working on, and
            where we're headed on our journey to version 1.0.
          </p>
          <Link href="/about/roadmap">
            <Button
              variant="outline"
              size="lg"
              className="bg-jk-linen hover:bg-white text-jk-olive border-2 border-jk-linen hover:border-white font-ui font-medium text-lg px-8 py-6 rounded-jk"
            >
              View Product Roadmap
            </Button>
          </Link>
        </div>

        {/* Call to Action */}
        <div className="text-center">
          <Link href="/recipes">
            <Button
              size="lg"
              className="bg-jk-tomato hover:bg-jk-tomato/90 text-white font-ui font-medium text-xl px-8 py-6 rounded-jk"
            >
              <BookOpen className="h-5 w-5 mr-2" />
              Start Cooking with the Seasons
            </Button>
          </Link>
        </div>
      </div>
    </main>
  );
}
