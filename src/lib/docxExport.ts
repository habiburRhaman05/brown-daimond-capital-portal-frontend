import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  WidthType, HeadingLevel, BorderStyle,
} from 'docx';
import { FIELD_GROUPS, WEBSITE_GROUP, contactTimes, teamRows, str } from './fields';
import type { FieldValues, Design } from './types';
import { COMPANY_NAME } from './brand';

const today = () => new Date().toISOString().slice(0, 10);

const NOBORDER = {
  top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
} as const;

function kvRow(label: string, value: string): TableRow {
  return new TableRow({
    children: [
      new TableCell({
        width: { size: 30, type: WidthType.PERCENTAGE },
        borders: NOBORDER,
        children: [new Paragraph({ children: [new TextRun({ text: label, bold: true, size: 20, font: 'Calibri' })] })],
      }),
      new TableCell({
        width: { size: 70, type: WidthType.PERCENTAGE },
        borders: NOBORDER,
        children: [new Paragraph({ children: [new TextRun({ text: value || '—', size: 20, font: 'Calibri' })] })],
      }),
    ],
  });
}

function sectionHeading(text: string): Paragraph {
  return new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 100 }, children: [new TextRun({ text, bold: true, size: 24, font: 'Calibri', color: '1F4A3A' })] });
}

function dateLine(submittedOn: string): Paragraph {
  return new Paragraph({
    spacing: { after: 200 },
    children: [
      new TextRun({ text: `Generated: ${today()}`, size: 18, font: 'Calibri', color: '666666' }),
      ...(submittedOn ? [new TextRun({ text: `   |   Submitted: ${submittedOn}`, size: 18, font: 'Calibri', color: '666666' })] : []),
    ],
  });
}

export async function buildClientInfoDocx(fields: FieldValues, submittedOn: string): Promise<Blob> {
  const sections: (Paragraph | Table)[] = [
    new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: 'Client Information', bold: true, size: 32, font: 'Calibri' })] }),
    new Paragraph({ spacing: { after: 50 }, children: [new TextRun({ text: COMPANY_NAME, size: 20, font: 'Calibri', color: '888888' })] }),
    dateLine(submittedOn),
  ];

  for (const group of FIELD_GROUPS) {
    sections.push(sectionHeading(group.title));
    const rows = group.items.map((f) => kvRow(f.label, str(fields[f.key])));
    if (group.title === 'Contact preferences') {
      rows.push(kvRow('Preferred contact time', contactTimes(fields)));
    }
    sections.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows }));
  }

  const team = teamRows(fields);
  sections.push(sectionHeading('Team'));
  if (team.length === 0) {
    sections.push(new Paragraph({ children: [new TextRun({ text: 'No team members added.', italics: true, size: 20, font: 'Calibri', color: '888888' })] }));
  } else {
    const headerRow = new TableRow({
      children: ['#', 'Name', 'Role / Relationship', 'Phone', 'Email'].map((h) =>
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, size: 18, font: 'Calibri' })] })] }),
      ),
    });
    const dataRows = team.map(
      (r) =>
        new TableRow({
          children: [String(r.row), r.name, [r.role, r.relationship].filter(Boolean).join(' / '), r.phone, r.email].map(
            (v) => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: v || '—', size: 18, font: 'Calibri' })] })] }),
          ),
        }),
    );
    sections.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [headerRow, ...dataRows] }));
  }

  sections.push(sectionHeading(WEBSITE_GROUP.title));
  const wRows = WEBSITE_GROUP.items.map((f) => kvRow(f.label, str(fields[f.key])));
  sections.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: wRows }));

  const doc = new Document({ sections: [{ children: sections }] });
  return await Packer.toBlob(doc);
}

export async function buildWebsiteChoicesDocx(fields: FieldValues, design: Design, submittedOn: string): Promise<Blob> {
  const sections: (Paragraph | Table)[] = [
    new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: 'Website Choices', bold: true, size: 32, font: 'Calibri' })] }),
    new Paragraph({ spacing: { after: 50 }, children: [new TextRun({ text: COMPANY_NAME, size: 20, font: 'Calibri', color: '888888' })] }),
    dateLine(submittedOn),
  ];

  sections.push(sectionHeading('Design'));
  const designRows = [
    kvRow('Template', design.templateLabel || design.template),
    kvRow('Fonts', `${design.fonts}${design.fontPair ? ` (${design.fontPair})` : ''}`),
    kvRow('Colour palette', design.palette),
    kvRow('Site theme', design.theme),
    kvRow('Copy variant', design.variantLabel),
  ];
  sections.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: designRows }));

  if (design.pageNames.some(Boolean)) {
    sections.push(sectionHeading('Pages'));
    const pageRows = design.pageNames.filter(Boolean).map((name, i) => kvRow(`Page ${i + 1}`, name));
    sections.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: pageRows }));
  }

  if (design.heroLabels.length) {
    sections.push(sectionHeading('Hero Images'));
    const heroRows = design.heroLabels.map((label, i) => kvRow(`Page ${i + 1}`, label));
    sections.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: heroRows }));
  }

  sections.push(sectionHeading('Content'));
  const contentRows = [
    kvRow('Domain', str(fields.domainInput)),
    kvRow('Tagline', design.tagline),
    kvRow('Contact button wording', design.cta),
  ];
  sections.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: contentRows }));

  const doc = new Document({ sections: [{ children: sections }] });
  return await Packer.toBlob(doc);
}

export function docxFilename(kind: 'Client Information' | 'Website Choices', businessName: string): string {
  const name = businessName.trim() || 'Client';
  return `${today()} ${kind} - ${name}.docx`;
}
