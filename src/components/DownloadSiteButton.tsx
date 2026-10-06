import { useState } from 'react';
import type { Design, FieldValues } from '../lib/types';
import { buildSiteZip, canExport, saveBlob } from '../lib/siteExport';
import { Button } from './ui';

const MESSAGES: Record<string, string> = {
  ENGINE_UNAVAILABLE: 'The website engine could not be loaded. Refresh the page and try again.',
  ENGINE_TIMEOUT: 'The website engine took too long to load. Refresh the page and try again.',
  DESIGN_UNAVAILABLE: "This client’s saved design is not available in the engine (template, theme or palette not found).",
};

export function DownloadSiteButton({ fields, sel, design, submittedOn, className = '' }: {
  fields: FieldValues; sel: Record<string, unknown>; design: Design; submittedOn?: string; className?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const blocked = canExport(fields, sel);

  async function run() {
    setError('');
    setBusy(true);
    try {
      const zip = await buildSiteZip(fields, sel, design, submittedOn || '', setProgress);
      saveBlob(zip.blob, zip.filename);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      setError(MESSAGES[msg] ?? (msg && !/^[A-Z_]+$/.test(msg) ? msg : 'Could not build the ZIP. Please try again.'));
    } finally {
      setBusy(false);
      setProgress('');
    }
  }

  return (
    <div className={className}>
      <Button variant="ghost" className="w-full sm:w-auto" loading={busy} loadingText={progress || 'Preparing…'} disabled={!!blocked} title={blocked ?? 'Download the selected design as HTML files'} onClick={run}>
        Download website (ZIP)
      </Button>
      {blocked && <p className="mt-1 text-xs text-muted">{blocked}</p>}
      {error && <p className="mt-1 text-sm text-red-700" role="alert">{error}</p>}
    </div>
  );
}
