// app/api/admin/upload-jobs/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

/* ======================================================
   SUPABASE
====================================================== */

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/* ======================================================
   HELPERS
====================================================== */

function normalizeKey(key: string) {
  return key.toLowerCase().replace(/[\s_-]/g, '');
}

function normalizeRow(row: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const k in row) out[normalizeKey(k)] = row[k];
  return out;
}

function parseRelativeDate(value: unknown): string {
  const today = new Date();

  if (!value) return today.toISOString().split('T')[0];

  const str = String(value).toLowerCase();

  const match = str.match(/(\d+)\s*day/);
  if (match) {
    today.setDate(today.getDate() - Number(match[1]));
    return today.toISOString().split('T')[0];
  }

  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }

  return today.toISOString().split('T')[0];
}

function parseSkills(value: unknown) {
  if (!value) return '';
  return String(value)
    .split(/[,;|]/)
    .map(v => v.trim())
    .filter(Boolean)
    .join(', ');
}

/* ======================================================
   MAIN HANDLER
====================================================== */

export async function POST(req: NextRequest) {
  const token = cookies().get('jobsynth_token')?.value;
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get('file');

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const ext = file.name.split('.').pop()?.toLowerCase();

  let rows: Record<string, unknown>[] = [];

if (ext === 'csv') {
  const parsed = Papa.parse<Record<string, unknown>>(buffer.toString(), {
    header: true,
    skipEmptyLines: true,
  });

  rows = parsed.data as Record<string, unknown>[];

} else {
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const ws = wb.Sheets[wb.SheetNames[0]];

  rows = XLSX.utils.sheet_to_json(ws, {
    defval: '',
  }) as Record<string, unknown>[];
}

  let uploaded = 0;
  let rejected = 0;
  const rejected_rows: { row: number; reason: string }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const r = normalizeRow(rows[i]);

    const title = String(r.title || '').trim();
    const company = String(r.company || '').trim();
    const url = String(r.url || '').trim();

    if (!title) {
      rejected++;
      rejected_rows.push({ row: i + 2, reason: 'Missing title' });
      continue;
    }

    if (!company) {
      rejected++;
      rejected_rows.push({ row: i + 2, reason: 'Missing company' });
      continue;
    }

    if (!url.startsWith('http')) {
      rejected++;
      rejected_rows.push({ row: i + 2, reason: 'Invalid or missing URL' });
      continue;
    }

    await supabase.from('scraped_jobs').upsert(
      {
        title,
        company,
        url,
        location: r.location ?? '',
        description: r.description ?? '',
        must_have_skills: parseSkills(r.musthaveskills),
        good_to_have_skills: parseSkills(r.goodtohaveskills),
        job_type: r.jobtype ?? 'contract',
        posted_date: parseRelativeDate(r.posteddate),
        uploaded_by: 'admin',
        is_active: true,
      },
      { onConflict: 'url' }
    );

    uploaded++;
  }

  return NextResponse.json({
    uploaded,
    rejected,
    rejected_rows,
  });
}
