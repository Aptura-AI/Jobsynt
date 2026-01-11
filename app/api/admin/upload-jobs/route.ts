// app/api/admin/upload-jobs/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

/* ======================================================
   LOCAL TYPES / CONSTANTS (NO EXTERNAL DEPENDENCIES)
   ====================================================== */

type JobType =
  | 'full-time'
  | 'part-time'
  | 'contract'
  | 'w2-contract'
  | 'c2c'
  | '1099';

const DEFAULT_JOB_TYPE: JobType = 'full-time';

function isValidJobType(value: string): value is JobType {
  return [
    'full-time',
    'part-time',
    'contract',
    'w2-contract',
    'c2c',
    '1099',
  ].includes(value);
}

/* ======================================================
   AUTH / SUPABASE (INLINE, USED)
   ====================================================== */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

function verifyToken(token: string): { role?: string } | null {
  try {
    const decoded = JSON.parse(
      Buffer.from(token.split('.')[1], 'base64').toString()
    ) as { role?: string };
    return decoded;
  } catch {
    return null;
  }
}

/* ======================================================
   NORMALIZATION HELPERS (ALL USED, NO `any`)
   ====================================================== */

function normalizeExcelRow(
  row: Record<string, unknown>
): Record<string, unknown> {
  const normalized: Record<string, unknown> = {};
  for (const key of Object.keys(row)) {
    normalized[key.toLowerCase().trim()] = row[key];
  }
  return normalized;
}

function parseSkills(value: unknown): string[] {
  if (!value) return [];
  return String(value)
    .split(/[,;|]/)
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);
}

function parseExperience(value: unknown): number {
  const match = String(value ?? '').match(/(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

function parseIsRemote(value: unknown, location: string): boolean {
  const v = String(value ?? '').toLowerCase();
  if (['yes', 'true', '1', 'remote'].includes(v)) return true;
  if (['no', 'false', '0'].includes(v)) return false;
  return location.toLowerCase().includes('remote');
}

function parseDate(value: unknown): string | null {
  if (!value) return null;
  const d = new Date(String(value));
  return isNaN(d.getTime()) ? null : d.toISOString().split('T')[0];
}

function isOlderThan30Days(dateStr: string): boolean {
  const d = new Date(dateStr);
  const diff =
    (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24);
  return diff > 30;
}

function normalizeJobType(value: unknown): JobType {
  const v = String(value ?? '').toLowerCase();
  if (isValidJobType(v)) return v;
  if (v.includes('c2c')) return 'c2c';
  if (v.includes('1099')) return '1099';
  if (v.includes('w2')) return 'w2-contract';
  if (v.includes('contract')) return 'contract';
  return DEFAULT_JOB_TYPE;
}

/* ======================================================
   SKILL / PLATFORM EXTRACTION (USED)
   ====================================================== */

function extractSkillsFromJobDescription(description: string): {
  primary_skill: string | null;
  secondary_skills: string[];
} {
  const words = description
    .toLowerCase()
    .split(/[\s,.;()]+/)
    .filter(w => w.length > 2);

  const unique = [...new Set(words)];
  return {
    primary_skill: unique[0] ?? null,
    secondary_skills: unique.slice(1, 6),
  };
}

function extractPlatformFromJob(
  title: string,
  skills: string[]
): string | null {
  const text = `${title} ${skills.join(' ')}`.toLowerCase();
  if (text.includes('react')) return 'react';
  if (text.includes('java')) return 'java';
  if (text.includes('python')) return 'python';
  return null;
}

function extractSecondaryPlatforms(
  _title: string,
  skills: string[]
): string[] {
  return skills.slice(1, 4);
}

/* ======================================================
   MAIN HANDLER
   ====================================================== */

export async function POST(req: NextRequest) {
  const rawToken = cookies().get('jobsynth_token')?.value;
  if (!rawToken || verifyToken(rawToken)?.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const buffer = Buffer.from(await file.arrayBuffer());
  const ext = file.name.split('.').pop()?.toLowerCase();

  let rows: Record<string, unknown>[] = [];

  if (ext === 'csv') {
    const parsed = Papa.parse<Record<string, unknown>>(
      buffer.toString('utf-8'),
      { header: true, skipEmptyLines: true }
    );
    rows = parsed.data;
  } else if (ext === 'xlsx' || ext === 'xls') {
    const wb = XLSX.read(buffer, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
  } else {
    return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 });
  }

  for (const raw of rows) {
    const r = normalizeExcelRow(raw);

    const title = String(r.title ?? '').trim();
    const company = String(r.company ?? '').trim();
    const url = String(r.url ?? '').trim();
    if (!title || !company || !url.startsWith('http')) continue;

    const posted =
      parseDate(r.posted_date) ??
      new Date().toISOString().split('T')[0];
    if (isOlderThan30Days(posted)) continue;

    let must = parseSkills(r.must_have_skills);
    let good = parseSkills(r.good_to_have_skills);

    const desc = String(r.description ?? '');
    if (!must.length && desc) {
      const extracted = extractSkillsFromJobDescription(desc);
      if (extracted.primary_skill) {
        must = [extracted.primary_skill];
      }
      good.push(...extracted.secondary_skills);
    }

    const allSkills = [...new Set([...must, ...good])];
    const primaryPlatform =
      extractPlatformFromJob(title, must.length ? must : allSkills);

    const location = String(r.location ?? '');
    const isRemote = parseIsRemote(r.is_remote, location);
    const workLocationType: 'Remote' | 'Hybrid' | 'Onsite' =
      isRemote ? 'Remote' : location.toLowerCase().includes('hybrid')
        ? 'Hybrid'
        : 'Onsite';

    await supabase.from('scraped_jobs').upsert(
      {
        title,
        company,
        url,
        description: desc,
        must_have_skills: must.join(', '),
        good_to_have_skills: good.join(', '),
        primary_platform: primaryPlatform,
        job_type: normalizeJobType(r.job_type),
        required_years_experience: parseExperience(
          r.required_years_experience
        ),
        location,
        work_location_type: workLocationType,
        posted_date: posted,
        is_active: true,
        uploaded_by: 'recruiter',
      },
      { onConflict: 'url' }
    );
  }

  return NextResponse.json({ success: true });
}
