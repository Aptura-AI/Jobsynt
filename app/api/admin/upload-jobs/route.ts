import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

/* ======================================================
   SUPABASE
====================================================== */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/* ======================================================
   AUTH
====================================================== */

function verifyAdmin(token: string): boolean {
  try {
    const decoded = JSON.parse(
      Buffer.from(token.split('.')[1], 'base64').toString()
    );
    return decoded?.role === 'admin';
  } catch {
    return false;
  }
}

/* ======================================================
   HELPERS
====================================================== */

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[\s_]+/g, '');
}

function normalizeRow(
  row: Record<string, unknown>
): Record<string, unknown> {
  const normalized: Record<string, unknown> = {};
  for (const key in row) {
    normalized[normalizeKey(key)] = row[key];
  }
  return normalized;
}

function parsePostedDate(value: unknown): string {
  if (!value) return new Date().toISOString().split('T')[0];

  const str = String(value).toLowerCase().trim();
  const match = str.match(/(\d+)\s*days?\s*ago/);

  if (match) {
    const days = parseInt(match[1], 10);
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString().split('T')[0];
  }

  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    return d.toISOString().split('T')[0];
  }

  return new Date().toISOString().split('T')[0];
}

function resolveWorkLocationType(
  location: string,
  explicit?: string
): 'Remote' | 'Hybrid' | 'Onsite' {
  const text = `${location} ${explicit ?? ''}`.toLowerCase();
  if (text.includes('remote')) return 'Remote';
  if (text.includes('hybrid')) return 'Hybrid';
  return 'Onsite';
}

function parseSkills(value: unknown): string {
  if (!value) return '';
  return String(value)
    .split(/[,;|]/)
    .map(v => v.trim())
    .filter(Boolean)
    .join(', ');
}

/* ======================================================
   ROUTE
====================================================== */

export async function POST(req: NextRequest) {
  const token = cookies().get('jobsynth_token')?.value;
  if (!token || !verifyAdmin(token)) {
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

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  let total = 0;
  let inserted = 0;
  const rejected: { row: number; reason: string }[] = [];

  for (let i = 0; i < rows.length; i++) {
    total++;
    const r = normalizeRow(rows[i]);

    const title = String(r.title ?? '').trim();
    const company = String(r.company ?? '').trim();
    const url = String(r.url ?? '').trim();

    if (!title || !company || !url || !url.startsWith('http')) {
      rejected.push({
        row: i + 1,
        reason: 'Missing title, company, or valid URL',
      });
      continue;
    }

    const location = String(r.location ?? '');
    const workLocationType = resolveWorkLocationType(
      location,
      String(r.locationtype ?? '')
    );

    const payload = {
      title,
      company,
      url,
      location,
      description: String(r.description ?? ''),
      posted_date: parsePostedDate(r.posteddate),
      job_type: String(r.jobtype ?? '').toLowerCase() || null,
      required_years_experience: Number(r.requiredyearsexperience ?? 0),
      pay_rate_min: r.payratemin ? Number(r.payratemin) : null,
      pay_rate_max: r.payratemax ? Number(r.payratemax) : null,
      must_have_skills: parseSkills(r.musthaveskills),
      good_to_have_skills: parseSkills(r.goodtohaveskills),
      source: String(r.source ?? 'upload'),
      uploaded_by: String(r.uploadedby ?? 'admin'),
      is_active: true,
      work_location_type: workLocationType,
    };

    const { error } = await supabase
      .from('scraped_jobs')
      .upsert(payload, { onConflict: 'url' });

    if (error) {
      rejected.push({
        row: i + 1,
        reason: error.message,
      });
      continue;
    }

    inserted++;
  }

  return NextResponse.json({
    success: true,
    total,
    inserted,
    rejected_count: rejected.length,
    rejected,
  });
}
