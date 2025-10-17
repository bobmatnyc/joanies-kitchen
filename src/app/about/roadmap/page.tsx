import fs from 'node:fs';
import path from 'node:path';
import { marked } from 'marked';
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: "Roadmap | Joanie's Kitchen",
  description: 'Track our journey from concept to version 1.0 and beyond',
};

export default async function RoadmapPage() {
  // Read ROADMAP.md from project root
  const roadmapPath = path.join(process.cwd(), 'ROADMAP.md');
  const roadmapContent = fs.readFileSync(roadmapPath, 'utf-8');

  // Convert markdown to HTML
  const htmlContent = await marked(roadmapContent);

  return (
    <main className="min-h-screen bg-jk-linen">
      {/* Header */}
      <div className="bg-jk-olive py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <nav className="mb-6">
              <Link
                href="/about"
                className="text-jk-linen/70 hover:text-jk-linen transition-colors text-sm font-semibold"
              >
                ← Back to About
              </Link>
            </nav>
            <h1 className="text-5xl font-heading text-jk-linen mb-4">Product Roadmap</h1>
            <p className="text-xl text-jk-sage">
              Our journey from garden to table, one version at a time
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-12">
        {/* Version Badge */}
        <div className="max-w-4xl mx-auto mb-12 p-6 bg-white border-2 border-jk-sage rounded-lg shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-jk-clay font-semibold uppercase tracking-wide mb-1">
                Current Version
              </div>
              <div className="text-4xl font-heading text-jk-olive">0.4.0</div>
              <div className="text-jk-charcoal/70 mt-2">Scale & Performance Release</div>
            </div>
            <div className="text-right">
              <div className="text-sm text-jk-clay font-semibold uppercase tracking-wide mb-1">
                Target
              </div>
              <div className="text-4xl font-heading text-jk-tomato">1.0.0</div>
              <div className="text-jk-charcoal/70 mt-2">Production Release</div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mt-6">
            <div className="flex justify-between text-sm text-jk-charcoal/70 mb-2">
              <span>Progress to 1.0</span>
              <span>40%</span>
            </div>
            <div className="h-3 bg-jk-sage/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-jk-olive to-jk-clay transition-all duration-500"
                style={{ width: '40%' }}
              />
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="max-w-4xl mx-auto mb-8 flex flex-wrap gap-6 text-sm bg-white p-4 rounded-lg border border-jk-sage/30">
          <div className="flex items-center gap-2">
            <span className="text-2xl">✅</span>
            <span className="text-jk-charcoal/70 font-medium">Completed</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-2xl">🔄</span>
            <span className="text-jk-charcoal/70 font-medium">In Progress</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-2xl">⏳</span>
            <span className="text-jk-charcoal/70 font-medium">Planned</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-2xl">🚧</span>
            <span className="text-jk-charcoal/70 font-medium">Under Development</span>
          </div>
        </div>

        {/* Markdown Content */}
        <div
          className="prose prose-lg prose-jk max-w-4xl mx-auto
                     prose-headings:font-heading prose-headings:text-jk-olive
                     prose-h2:text-3xl prose-h2:mb-6 prose-h2:mt-12 prose-h2:border-b prose-h2:border-jk-sage/30 prose-h2:pb-3
                     prose-h3:text-xl prose-h3:mb-4 prose-h3:mt-6 prose-h3:text-jk-clay
                     prose-p:text-jk-charcoal/90 prose-p:leading-relaxed
                     prose-li:text-jk-charcoal/90 prose-li:leading-relaxed
                     prose-ul:my-4
                     prose-a:text-jk-clay prose-a:no-underline hover:prose-a:underline
                     prose-strong:text-jk-olive prose-strong:font-semibold
                     prose-code:text-jk-tomato prose-code:bg-jk-linen prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm
                     prose-pre:bg-jk-charcoal prose-pre:text-jk-linen
                     prose-hr:border-jk-sage/30 prose-hr:my-8
                     prose-em:text-jk-clay prose-em:italic"
          dangerouslySetInnerHTML={{ __html: htmlContent }}
        />

        {/* Call to Action */}
        <div className="max-w-4xl mx-auto mt-12 p-8 bg-gradient-to-br from-jk-olive to-jk-clay rounded-lg text-center">
          <h3 className="text-2xl font-heading text-jk-linen mb-3">Want to contribute?</h3>
          <p className="text-jk-linen/90 mb-6 max-w-2xl mx-auto">
            We're building Joanie's Kitchen in public. Check back regularly for updates, or follow
            our progress on GitHub.
          </p>
          <Link
            href="/about"
            className="inline-block bg-jk-tomato text-white px-6 py-3 rounded-lg font-semibold hover:bg-jk-tomato/90 transition-colors"
          >
            Learn More About Joanie's Kitchen
          </Link>
        </div>
      </div>
    </main>
  );
}
