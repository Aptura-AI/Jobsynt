import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSession } from '@/lib/auth';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Simple text extraction for PDFs (basic implementation)
async function extractTextFromFile(file: File): Promise<string> {
  try {
    if (file.type === 'text/plain' || file.name.endsWith('.txt')) {
      return await file.text();
    }
    
    // For PDFs, try basic extraction
    // In production, use pdf-parse or similar library
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    // Basic PDF text extraction (simplified - use pdf-parse in production)
    let text = '';
    const decoder = new TextDecoder('utf-8', { fatal: false });
    const chunks = decoder.decode(uint8Array);
    
    // Extract text between stream markers (basic approach)
    const streamMatches = chunks.match(/stream[\s\S]*?endstream/g);
    if (streamMatches) {
      streamMatches.forEach(match => {
        const content = match.replace(/stream|endstream/g, '').trim();
        // Filter out binary data and keep readable text
        const readable = content.split('').filter(c => {
          const code = c.charCodeAt(0);
          return (code >= 32 && code <= 126) || code === 10 || code === 13;
        }).join('');
        text += readable + ' ';
      });
    }
    
    return text.trim() || 'Unable to extract text from PDF. Please upload a text file or ensure PDF has selectable text.';
  } catch (error) {
    console.error('Text extraction error:', error);
    return 'Error extracting text from file';
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];
    if (!allowedTypes.includes(file.type) && !file.name.match(/\.(pdf|doc|docx|txt)$/i)) {
      return NextResponse.json({ error: 'Invalid file type. Please upload PDF, DOC, DOCX, or TXT' }, { status: 400 });
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large. Maximum size is 10MB' }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', session.user.email)
      .maybeSingle();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profile not found. Please complete your profile first.' }, { status: 400 });
    }

    // Extract text from file
    const extractedText = await extractTextFromFile(file);

    // Generate unique file path
    const fileExt = file.name.split('.').pop();
    const timestamp = Date.now();
    const filePath = `${profile.id}/${timestamp}_resume.${fileExt}`;

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('resumes')
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return NextResponse.json({ error: 'Failed to upload resume', details: uploadError.message }, { status: 500 });
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('resumes')
      .getPublicUrl(filePath);

    // Save resume record to database with extracted text
    const { data: resumeRecord, error: dbError } = await supabase
      .from('resumes')
      .upsert({
        profile_id: profile.id,
        email: session.user.email,
        file_path: filePath,
        file_name: file.name,
        file_size: file.size,
        file_type: file.type,
        public_url: urlData.publicUrl,
        extracted_text: extractedText,
      }, { onConflict: 'profile_id' })
      .select()
      .single();

    if (dbError) {
      console.error('Database error:', dbError);
      // Try to clean up uploaded file
      await supabase.storage.from('resumes').remove([filePath]);
      return NextResponse.json({ error: 'Failed to save resume record', details: dbError.message }, { status: 500 });
    }

    // Update profile with resume URL
    await supabase
      .from('profiles')
      .update({ resume_url: urlData.publicUrl })
      .eq('id', profile.id);

    return NextResponse.json({
      message: 'Resume uploaded successfully',
      resume: resumeRecord,
      url: urlData.publicUrl,
    });
  } catch (error: any) {
    console.error('Resume upload error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

// GET - Fetch user's resumes
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ resumes: [] });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', session.user.email)
      .maybeSingle();

    if (!profile) {
      return NextResponse.json({ resumes: [] });
    }

    const { data: resumes, error } = await supabase
      .from('resumes')
      .select('*')
      .eq('profile_id', profile.id)
      .order('uploaded_at', { ascending: false });

    if (error) {
      console.error('Error fetching resumes:', error);
      return NextResponse.json({ resumes: [] });
    }

    return NextResponse.json({ resumes: resumes || [] });
  } catch (error: any) {
    console.error('Resumes GET error:', error);
    return NextResponse.json({ resumes: [] });
  }
}
