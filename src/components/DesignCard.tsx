import type { Design } from '../lib/types';
import { Card, KV } from './ui';

// What the client picked in the website designer.
export function DesignCard({ design, title = 'Selected website design' }: { design: Design; title?: string }) {
  const chosen = !!design.template;
  return (
    <Card title={title}>
      {!chosen ? (
        <p className="text-sm text-muted">No design has been chosen yet.</p>
      ) : (
        <dl className="divide-y divide-line">
          <KV label="Template">{design.templateLabel}</KV>
          <KV label="Fonts">{`${design.fonts}${design.fontPair ? ` (${design.fontPair})` : ''}`}</KV>
          <KV label="Colour palette">
            <span className="inline-flex items-center gap-2">
              <span className="inline-block h-4 w-4 rounded-full border border-line" style={{ background: design.paletteHex || '#ccc' }} />
              {design.palette}
            </span>
          </KV>
          <KV label="Site theme">{design.theme}</KV>
          <KV label="Copy variant">{design.variantLabel}</KV>
          <KV label="Page names">{design.pageNames.filter(Boolean).join('  ·  ')}</KV>
          <KV label="Hero images">
            {design.heroLabels.length ? (
              <ol className="list-inside list-decimal">
                {design.heroLabels.map((l, i) => (
                  <li key={i}>
                    Page {i + 1}: {l}
                  </li>
                ))}
              </ol>
            ) : (
              ''
            )}
          </KV>
          <KV label="Tagline">{design.tagline}</KV>
          <KV label="Contact button">{design.cta}</KV>
        </dl>
      )}
    </Card>
  );
}
