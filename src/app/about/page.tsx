import Link from "next/link";
import { Button } from "@/components/ui/button";
import { BookOpen } from "lucide-react";

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-jk-linen">
      {/* Header */}
      <div className="bg-jk-olive text-jk-linen py-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="font-heading text-6xl text-jk-linen mb-4">About Joanie</h1>
          <p className="text-2xl text-jk-sage italic font-body">
            From Garden to Table — with Heart and Soil
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
            <h2 className="font-heading text-4xl text-jk-olive mb-6">
              A Kitchen Born from the Garden
            </h2>

            <p>
              I grew up with my hands in the soil, learning that the best meals
              begin long before they reach the kitchen. My grandmother taught me
              to cook with what the season offers, to honor the ingredients, and
              to never rush a good meal.
            </p>

            <p>
              Those early lessons shaped everything I do today. I learned that
              a ripe tomato still warm from the sun needs nothing more than a
              pinch of salt. That fresh herbs from the garden can transform
              the simplest dish. That cooking is as much about patience and
              respect as it is about technique.
            </p>

            <p>
              Today, I continue that tradition, sharing recipes that connect us
              to the earth and to each other. Whether you're planting your first
              tomato or cooking your hundredth Sunday roast, you'll find
              inspiration here — and perhaps a reminder that the best cooking
              comes from the heart.
            </p>

            <div className="clear-both"></div>

            <h3 className="font-heading text-3xl text-jk-olive mt-12 mb-4">
              My Kitchen Philosophy
            </h3>

            <ul className="space-y-3 ml-6">
              <li className="flex items-start gap-3">
                <span className="text-jk-tomato text-2xl">•</span>
                <span>
                  <strong className="text-jk-olive">Cook with the seasons.</strong>
                  {' '}When you work with nature's rhythms, ingredients taste better
                  and cooking feels easier.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-jk-tomato text-2xl">•</span>
                <span>
                  <strong className="text-jk-olive">Keep it simple.</strong>
                  {' '}Great cooking doesn't require complicated techniques —
                  just good ingredients and a little care.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-jk-tomato text-2xl">•</span>
                <span>
                  <strong className="text-jk-olive">Trust your hands.</strong>
                  {' '}Recipes are guides, but your senses — taste, smell, touch —
                  are the real teachers.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-jk-tomato text-2xl">•</span>
                <span>
                  <strong className="text-jk-olive">Feed people you love.</strong>
                  {' '}Cooking is an act of generosity. Make food that brings
                  people together.
                </span>
              </li>
            </ul>

            <blockquote className="border-l-4 border-jk-tomato pl-6 py-4 my-8 italic text-jk-clay text-2xl font-body">
              "The garden teaches patience. The kitchen teaches creativity.
              Together, they teach us to live well."
            </blockquote>

            <h3 className="font-heading text-3xl text-jk-olive mt-12 mb-4">
              What You'll Find Here
            </h3>

            <p>
              Every recipe on this site comes from my kitchen and my garden.
              You'll find seasonal favorites, family traditions, and new
              discoveries — all tested, tasted, and loved. Whether you're
              looking for a simple weeknight dinner or a special occasion
              feast, there's something here for you.
            </p>

            <p>
              I hope these recipes inspire you to slow down, cook with care,
              and enjoy the ritual of making a meal from scratch. And if you
              try something, I'd love to hear about it.
            </p>

            <p className="font-heading text-3xl text-jk-olive mt-8">
              Welcome to Joanie's Kitchen.
            </p>

            <p className="font-heading text-2xl text-jk-clay italic">
              — Joanie
            </p>
          </div>
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
