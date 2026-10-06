import { Link } from 'react-router-dom';
import { COMPANY_NAME, MAILING_ADDRESS, SUPPORT_EMAIL } from '../lib/brand';

// Placeholder copy only — Brown Diamond Capital is sending the final wording for both pages
// (Sprint 2.2 Review & Updates, section 3). Swap PRIVACY_BODY / TERMS_BODY below when it arrives.

function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-5">
      <Link to="/login" className="text-sm text-brand hover:underline">&larr; Back to sign in</Link>
      <h1 className="mt-4 text-2xl font-semibold">{title}</h1>
      <div className="mt-6 space-y-4 text-sm leading-relaxed text-ink">{children}</div>
      <p className="mt-8 border-t border-line pt-4 text-xs text-muted">{COMPANY_NAME}, {MAILING_ADDRESS}</p>
    </div>
  );
}

export function PrivacyPolicy() {
  return (
    <LegalPage title="Privacy Policy">
      <p className="rounded-md bg-paper px-3 py-2 text-xs text-muted">
        This page is a placeholder. Final wording from {COMPANY_NAME} will replace this text.
      </p>
      <p>
        The {COMPANY_NAME} client portal collects the information you submit on the Your Information
        page, including your name, date of birth, mailing address, contact details and business
        information, in order to prepare the services and materials you have requested. We use this
        information only for that purpose and for communicating with you about your account.
      </p>
      <p>
        Questions about this policy or your data can be sent to{' '}
        <a href={`mailto:${SUPPORT_EMAIL}`} className="text-brand hover:underline">{SUPPORT_EMAIL}</a>.
      </p>
    </LegalPage>
  );
}

export function TermsOfUse() {
  return (
    <LegalPage title="Terms of Use">
      <p className="rounded-md bg-paper px-3 py-2 text-xs text-muted">
        This page is a placeholder. Final wording from {COMPANY_NAME} will replace this text.
      </p>
      <p>
        Use of the {COMPANY_NAME} client portal is subject to these terms. The portal is provided to
        clients engaged with {COMPANY_NAME} for the purpose of submitting business information and
        website preferences. Accounts and the information submitted through them are for the client's
        own use and may not be shared with unauthorized parties.
      </p>
      <p>
        Questions about these terms can be sent to{' '}
        <a href={`mailto:${SUPPORT_EMAIL}`} className="text-brand hover:underline">{SUPPORT_EMAIL}</a>.
      </p>
    </LegalPage>
  );
}
