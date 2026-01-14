import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

/* ===================== CONFIG ===================== */

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/* ===================== HELPERS ===================== */

const normalizeKey = (key: string) =>
  key.toLowerCase().replace(/[\s_-]/g, '');

const normalizeRow = (row: Record<string, unknown>) => {
  const out: Record<string, unknown> = {};
  for (const k in row) {
    out[normalizeKey(k)] = row[k];
  }
  return out;
};

const parseRelativeDate = (value: unknown): string => {
  const today = new Date();
  const v = String(value ?? '').toLowerCase();

  const match = v.match(/(\d+)\s*day/);
  if (match) {
    today.setDate(today.getDate() - Number(match[1]));
    return today.toISOString().split('T')[0];
  }

  const d = new Date(v);
  return isNaN(d.getTime())
    ? new Date().toISOString().split('T')[0]
    : d.toISOString().split('T')[0];
};

const parseBool = (v: unknown) =>
  ['true', 'yes', '1', 'remote'].includes(String(v).toLowerCase());

/* ===================== ROUTE ===================== */

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
    rows = parsed.data;
  } else {
    const wb = XLSX.read(buffer, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    rows = XLSX.utils.sheet_to_json(ws, { defval: '' }) as Record<string, unknown>[];
  }

  let inserted = 0;
  let rejected = 0;
  const errors: { row: number; reason: string }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const r = normalizeRow(rows[i]);

    const title = String(r.title ?? '').trim();
    const company = String(r.company ?? '').trim();
    const url = String(r.url ?? '').trim();

    if (!title || !company || !url.startsWith('http')) {
      rejected++;
      errors.push({ row: i + 1, reason: 'Missing title, company, or valid URL' });
      continue;
    }

    const payload = {
      title,
      company,
      url,
      location: String(r.location ?? ''),
      description: String(r.description ?? ''),
      posted_date: parseRelativeDate(r.posteddate),
      source: String(r.source ?? 'manual'),
      uploaded_by: String(r.uploadedby ?? 'recruiter'),
      job_type: String(r.jobtype ?? null),
      required_years_experience: Number(r.requiredyearsexperience ?? 0),
      pay_rate_min: r.payratemin ? Number(r.payratemin) : null,
      pay_rate_max: r.payratemax ? Number(r.payratemax) : null,
      must_have_skills: String(r.musthaveskills ?? ''),
      good_to_have_skills: String(r.goodtohaveskills ?? ''),
      is_remote: parseBool(r.isremote),
      work_location_type:
        String(r.locationtype ?? '').toLowerCase() === 'remote'
          ? 'Remote'
          : String(r.locationtype ?? '').toLowerCase() === 'hybrid'
          ? 'Hybrid'
          : 'Onsite',
      target_candidate_id: r.id || r.targetcandidateid || null,
      is_active: true,
    };

    const { error } = await supabase
      .from('scraped_jobs')
      .insert(payload);

    if (error) {
      rejected++;
      errors.push({ row: i + 1, reason: error.message });
    } else {
      inserted++;
    }
  }

  return NextResponse.json({
    success: true,
    total: rows.length,
    inserted,
    rejected,
    errors,
  });
}
