import { Link } from 'react-router-dom';
import { COMPANY_NAME, MAILING_ADDRESS } from '../lib/brand';

export function Footer() {
  return (
    <footer className="mx-auto max-w-6xl px-4 py-6 text-xs text-muted sm:px-5">
      <div className="flex flex-wrap items-center justify-center gap-3 border-t border-line pt-4 text-center">
        <span>{COMPANY_NAME}, {MAILING_ADDRESS}</span>
        <span aria-hidden="true">&middot;</span>
        <Link to="/privacy" className="hover:text-ink hover:underline">Privacy Policy</Link>
        <span aria-hidden="true">&middot;</span>
        <Link to="/terms" className="hover:text-ink hover:underline">Terms of Use</Link>
      </div>
    </footer>
  );
}
