/**
 * ChefAvatar Component Examples
 *
 * Visual examples showing different ChefAvatar configurations.
 * Use this as reference when implementing chef avatars.
 */

import { ChefAvatar } from '../ChefAvatar';

export function ChefAvatarExamples() {
  return (
    <div className="p-8 space-y-12 bg-jk-linen min-h-screen">
      <h1 className="text-4xl font-heading text-jk-olive mb-8">ChefAvatar Component Examples</h1>

      {/* Size Variants */}
      <section>
        <h2 className="text-2xl font-heading text-jk-olive mb-4">Size Variants</h2>
        <div className="flex items-end gap-8 p-6 bg-white rounded-lg border border-jk-olive/20">
          <div className="text-center">
            <ChefAvatar size="sm" imageUrl="/joanie-portrait.png" name="Joanie" />
            <p className="mt-2 text-sm text-jk-olive/60">sm (32px)</p>
          </div>
          <div className="text-center">
            <ChefAvatar size="md" imageUrl="/joanie-portrait.png" name="Joanie" />
            <p className="mt-2 text-sm text-jk-olive/60">md (64px)</p>
          </div>
          <div className="text-center">
            <ChefAvatar size="lg" imageUrl="/joanie-portrait.png" name="Joanie" />
            <p className="mt-2 text-sm text-jk-olive/60">lg (100px)</p>
          </div>
          <div className="text-center">
            <ChefAvatar size="xl" imageUrl="/joanie-portrait.png" name="Joanie" />
            <p className="mt-2 text-sm text-jk-olive/60">xl (160-200px)</p>
          </div>
        </div>
      </section>

      {/* With Image */}
      <section>
        <h2 className="text-2xl font-heading text-jk-olive mb-4">With Profile Image</h2>
        <div className="flex items-center gap-6 p-6 bg-white rounded-lg border border-jk-olive/20">
          <ChefAvatar size="lg" imageUrl="/joanie-portrait.png" name="Joanie" />
          <div>
            <h3 className="font-heading text-xl text-jk-olive">Joanie from Joanie's Kitchen</h3>
            <p className="text-jk-olive/60">Profile image loaded from /joanie-portrait.png</p>
          </div>
        </div>
      </section>

      {/* Without Image (Fallback) */}
      <section>
        <h2 className="text-2xl font-heading text-jk-olive mb-4">
          Without Image (Fallback to Initial)
        </h2>
        <div className="flex items-center gap-6 p-6 bg-white rounded-lg border border-jk-olive/20">
          <ChefAvatar size="lg" imageUrl={null} name="Gordon Ramsay" />
          <div>
            <h3 className="font-heading text-xl text-jk-olive">Gordon Ramsay</h3>
            <p className="text-jk-olive/60">
              No image provided - displays first initial with brand colors
            </p>
          </div>
        </div>
      </section>

      {/* Verified Badge */}
      <section>
        <h2 className="text-2xl font-heading text-jk-olive mb-4">Verified Chef Badge</h2>
        <div className="flex items-center gap-6 p-6 bg-white rounded-lg border border-jk-olive/20">
          <ChefAvatar size="lg" imageUrl="/joanie-portrait.png" name="Joanie" verified={true} />
          <div>
            <h3 className="font-heading text-xl text-jk-olive">Verified Chef</h3>
            <p className="text-jk-olive/60">
              Blue checkmark badge appears for verified={'{'}true{'}'}
            </p>
          </div>
        </div>
      </section>

      {/* Multiple Chefs */}
      <section>
        <h2 className="text-2xl font-heading text-jk-olive mb-4">Multiple Chefs (Card Layout)</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Joanie */}
          <div className="flex items-center gap-4 p-4 bg-white rounded-lg border border-jk-olive/20">
            <ChefAvatar size="md" imageUrl="/joanie-portrait.png" name="Joanie" verified={true} />
            <div className="flex-1">
              <h3 className="font-heading text-lg text-jk-olive">Joanie from Joanie's Kitchen</h3>
              <p className="text-sm text-jk-olive/60">Seasonal, garden-to-table</p>
            </div>
          </div>

          {/* Kenji (no image) */}
          <div className="flex items-center gap-4 p-4 bg-white rounded-lg border border-jk-olive/20">
            <ChefAvatar size="md" imageUrl={null} name="J. Kenji López-Alt" verified={true} />
            <div className="flex-1">
              <h3 className="font-heading text-lg text-jk-olive">J. Kenji López-Alt</h3>
              <p className="text-sm text-jk-olive/60">Science, technique</p>
            </div>
          </div>

          {/* Jamie Oliver (no image) */}
          <div className="flex items-center gap-4 p-4 bg-white rounded-lg border border-jk-olive/20">
            <ChefAvatar size="md" imageUrl={null} name="Jamie Oliver" />
            <div className="flex-1">
              <h3 className="font-heading text-lg text-jk-olive">Jamie Oliver</h3>
              <p className="text-sm text-jk-olive/60">Quick meals, healthy</p>
            </div>
          </div>

          {/* Ina Garten (no image) */}
          <div className="flex items-center gap-4 p-4 bg-white rounded-lg border border-jk-olive/20">
            <ChefAvatar size="md" imageUrl={null} name="Ina Garten" verified={true} />
            <div className="flex-1">
              <h3 className="font-heading text-lg text-jk-olive">Ina Garten</h3>
              <p className="text-sm text-jk-olive/60">Comfort food, entertaining</p>
            </div>
          </div>
        </div>
      </section>

      {/* Responsive Demo */}
      <section>
        <h2 className="text-2xl font-heading text-jk-olive mb-4">
          Responsive Layout (Profile Header)
        </h2>
        <div className="p-6 bg-white rounded-lg border-2 border-jk-olive/20 shadow-lg">
          <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
            <ChefAvatar
              size="xl"
              imageUrl="/joanie-portrait.png"
              name="Joanie"
              verified={true}
              className="flex-shrink-0"
            />
            <div className="flex-1 text-center md:text-left">
              <h1 className="text-3xl md:text-4xl font-heading text-jk-olive mb-2">
                Joanie from Joanie's Kitchen
              </h1>
              <p className="text-jk-olive/80 text-lg mb-4">
                Trained chef, lifelong gardener, and volunteer firefighter. Former bond trader
                turned culinary professional. Known for transforming "nothing in the fridge" into
                extraordinary meals.
              </p>
              <div className="flex gap-2 justify-center md:justify-start">
                <span className="px-3 py-1 bg-jk-sage/30 text-jk-olive rounded-full text-sm">
                  seasonal
                </span>
                <span className="px-3 py-1 bg-jk-sage/30 text-jk-olive rounded-full text-sm">
                  garden-to-table
                </span>
                <span className="px-3 py-1 bg-jk-sage/30 text-jk-olive rounded-full text-sm">
                  improvisation
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Code Examples */}
      <section>
        <h2 className="text-2xl font-heading text-jk-olive mb-4">Code Examples</h2>
        <div className="space-y-4">
          <div className="p-4 bg-jk-charcoal rounded-lg">
            <pre className="text-jk-linen text-sm overflow-x-auto">
              <code>{`// Basic usage
<ChefAvatar
  size="md"
  imageUrl="/joanie-portrait.png"
  name="Joanie"
/>

// With verified badge
<ChefAvatar
  size="lg"
  imageUrl="/chef-images/kenji.png"
  name="Kenji López-Alt"
  verified={true}
/>

// Fallback (no image)
<ChefAvatar
  size="md"
  imageUrl={null}
  name="Gordon Ramsay"
/>`}</code>
            </pre>
          </div>
        </div>
      </section>
    </div>
  );
}
