import type { FieldValues } from './types';

export interface FieldDef {
  key: string;
  label: string;
  type?: 'text' | 'email' | 'tel' | 'date' | 'textarea' | 'select';
  options?: string[];
}

export const THEMES = [
  'Business Strategy & Operations Consulting',
  'Athlete Career Transition Consulting',
  'Management Consulting',
  'Leadership Development Consulting',
  'NIL Consulting',
];

export const CONTACT_METHODS = ['Email', 'Phone', 'SMS/Text', 'In Person', 'Social Media', 'Zoom'];

export const FIELD_GROUPS: { title: string; items: FieldDef[] }[] = [
  {
    title: 'Personal',
    items: [
      { key: 'legalFirstName', label: 'Legal first name' },
      { key: 'legalLastName', label: 'Legal last name' },
      { key: 'dateOfBirth', label: 'Date of birth', type: 'date' },
      { key: 'personalEmail', label: 'Personal email', type: 'email' },
      { key: 'personalPhone', label: 'Personal phone', type: 'tel' },
    ],
  },
  {
    title: 'Mailing address',
    items: [
      { key: 'mailingStreet', label: 'Street' },
      { key: 'mailingCity', label: 'City' },
      { key: 'mailingState', label: 'State' },
      { key: 'mailingZip', label: 'ZIP' },
    ],
  },
  {
    title: 'Contact preferences',
    items: [{ key: 'preferredContact', label: 'Preferred contact method', type: 'select', options: CONTACT_METHODS }],
  },
  {
    title: 'Business',
    items: [
      { key: 'bizNameInput', label: 'Desired business name' },
      { key: 'backupName1', label: 'Backup name 1' },
      { key: 'backupName2', label: 'Backup name 2' },
      { key: 'themeSelect', label: 'Business theme', type: 'select', options: THEMES },
      { key: 'purposeText', label: 'Business purpose', type: 'textarea' },
      { key: 'naicsField', label: 'NAICS code' },
      { key: 'sicField', label: 'SIC code' },
    ],
  },
];

// Rendered after Team (Sprint 2.2 Review, section 4). Tagline and Contact button wording moved
// to the website design view, since the client chooses them alongside the rest of the design.
export const WEBSITE_GROUP: { title: string; items: FieldDef[] } = {
  title: 'Website',
  items: [{ key: 'domainInput', label: 'Domain choice' }],
};

export const TIMES = [
  { key: 'contactTimeMorning', label: 'Morning' },
  { key: 'contactTimeEvening', label: 'Evening' },
  { key: 'contactTimeNight', label: 'Night' },
] as const;

export function contactTimes(fields: FieldValues): string {
  return TIMES.filter((t) => fields[t.key] === true).map((t) => t.label).join(', ');
}

export interface TeamRow {
  row: number;
  name: string;
  role: string;
  relationship: string;
  phone: string;
  email: string;
}

const s = (v: unknown) => (typeof v === 'string' ? v : '');

export function teamRows(fields: FieldValues): TeamRow[] {
  const rows: TeamRow[] = [];
  for (let i = 1; i <= 5; i++) {
    const r = {
      row: i,
      name: s(fields[`team_name_${i}`]),
      role: s(fields[`team_role_${i}`]),
      relationship: s(fields[`team_relationship_${i}`]),
      phone: s(fields[`team_phone_${i}`]),
      email: s(fields[`team_email_${i}`]),
    };
    if (r.name || r.role || r.relationship || r.phone || r.email) rows.push(r);
  }
  return rows;
}

export const str = s;
