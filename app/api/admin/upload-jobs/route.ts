import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession();
    const isMasterAdmin = (session as any)?.admin_master === true || 
      (session?.user?.email?.toLowerCase() === 'info@jobsynt.com' && session?.user?.role === 'admin');

    if (!isMasterAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File;
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const buffer = Buffer.from(await file.arrayBuffer());
    const fileExt = file.name.split('.').pop()?.toLowerCase();

    let rows: any[] = [];

    if (fileExt === 'csv') {
      const text = buffer.toString('utf-8');
      const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
      rows = parsed.data as any[];
    } else if (fileExt === 'xlsx' || fileExt === 'xls') {
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      rows = XLSX.utils.sheet_to_json(worksheet);
    } else {
      return NextResponse.json({ error: 'Unsupported file type. Use .xlsx or .csv' }, { status: 400 });
    }

    if (rows.length === 0) {
      return NextResponse.json({ error: 'No data found in file' }, { status: 400 });
    }

    // Normalize column names (case-insensitive)
    const normalizeKey = (key: string) => {
      const lower = key.toLowerCase().trim();
      const mapping: Record<string, string> = {
        'job title': 'title',
        'title': 'title',
        'company': 'company',
        'location': 'location',
        'job type': 'job_type',
        'pay rate': 'pay_rate',
        'rate': 'pay_rate',
        'posted date': 'posted_date',
        'date': 'posted_date',
        'source': 'source',
        'job link': 'job_link',
        'link': 'job_link',
        'url': 'job_link',
        'key requirements': 'key_requirements',
        'requirements': 'key_requirements',
        'description': 'key_requirements',
      };
      return mapping[lower] || lower;
    };

    const normalizedRows = rows.map(row => {
      const normalized: any = {};
      for (const [key, value] of Object.entries(row)) {
        const normKey = normalizeKey(key);
        normalized[normKey] = value;
      }
      return normalized;
    });

    let success = 0;
    const errors: string[] = [];

    for (const row of normalizedRows) {
      try {
        if (!row.title || !row.company) {
          errors.push(`Skipped row: Missing title or company`);
          continue;
        }

        const jobData = {
          title: String(row.title || '').trim(),
          company: String(row.company || '').trim(),
          location: String(row.location || '').trim() || 'Remote',
          url: String(row.job_link || row.url || '').trim() || null,
          description: String(row.key_requirements || row.description || '').trim() || null,
          salary: String(row.pay_rate || row.rate || '').trim() || null,
          posted_date: row.posted_date ? new Date(row.posted_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
          source: String(row.source || 'manual').trim(),
          profile_id: null,
          is_constant_search: false,
          is_real: true,
        };

        const { error } = await supabase
          .from('scraped_jobs')
          .upsert(jobData, { onConflict: 'url' });

        if (error) {
          errors.push(`Error inserting "${row.title}": ${error.message}`);
        } else {
          success++;
        }
      } catch (err: any) {
        errors.push(`Error processing row: ${err.message}`);
      }
    }

    return NextResponse.json({
      success,
      errors: errors.slice(0, 50), // Limit errors
      total: rows.length,
    });
  } catch (error: any) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: error.message || 'Upload failed' }, { status: 500 });
  }
}

