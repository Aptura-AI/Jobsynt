import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSession } from '@/lib/auth';
import pdfParse from 'pdf-parse';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

/**
 * Extract text from PDF file
 * 
 * Only PDF files are supported for system stability and data integrity.
 */
async function extractTextFromPDF(file: File): Promise<{ text: string; confidence: 'high' | 'medium' | 'low' }> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    try {
      const data = await pdfParse(buffer);
      const extractedText = data.text.trim();
      
      // Determine confidence based on extracted text length
      let confidence: 'high' | 'medium' | 'low' = 'low';
      if (extractedText.length > 500) {
        confidence = 'high';
      } else if (extractedText.length > 100) {
        confidence = 'medium';
      }
      
      if (extractedText.length === 0) {
        return {
          text: 'Unable to extract text from PDF. Please ensure the PDF has selectable text (not scanned images).',
          confidence: 'low'
        };
      }
      
      return { text: extractedText, confidence };
    } catch (pdfError: any) {
      console.error('PDF parsing error:', pdfError);
      // Fallback to basic extraction
      const uint8Array = new Uint8Array(arrayBuffer);
      const decoder = new TextDecoder('utf-8', { fatal: false });
      const chunks = decoder.decode(uint8Array);
      
      const streamMatches = chunks.match(/stream[\s\S]*?endstream/g);
      let text = '';
      if (streamMatches) {
        streamMatches.forEach(match => {
          const content = match.replace(/stream|endstream/g, '').trim();
          const readable = content.split('').filter(c => {
            const code = c.charCodeAt(0);
            return (code >= 32 && code <= 126) || code === 10 || code === 13;
          }).join('');
          text += readable + ' ';
        });
      }
      
      const fallbackText = text.trim() || 'Unable to extract text from PDF. Please upload a PDF with selectable text.';
      return { text: fallbackText, confidence: 'low' };
    }
  } catch (error: any) {
    console.error('Text extraction error:', error);
    return { 
      text: `Error extracting text from file: ${error.message}`, 
      confidence: 'low' 
    };
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

    // STRICT: Only PDF files allowed
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      return NextResponse.json({ 
        error: 'Only PDF resumes are supported at this time.' 
      }, { status: 400 });
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

    // PART 6: Resume Upload Flow (MANDATORY ORDER)
    // Step 1: Extract text from PDF
    const { text: extractedText, confidence } = await extractTextFromPDF(file);

    // Warn user if confidence is low
    if (confidence === 'low') {
      console.warn(`[Resume Upload] Low confidence text extraction for ${file.name}. Extracted ${extractedText.length} characters.`);
    }

    // Step 2: Upload to Supabase Storage bucket 'resumes' FIRST
    // If this fails, abort entire operation (PART 6 requirement)
    const timestamp = Date.now();
    const filePath = `${profile.id}/${timestamp}_resume.pdf`;

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    // Upload to Supabase Storage - MUST succeed before proceeding
    const supabaseAdmin = createClient(
      supabaseUrl,
      process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseServiceKey
    );

    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from('resumes')
      .upload(filePath, buffer, {
        contentType: 'application/pdf',
        upsert: true,
      });

    // PART 6: If step 2 fails → abort the entire operation
    if (uploadError) {
      console.error('[Resume Upload] Storage upload failed:', uploadError);
      if (uploadError.message.includes('Bucket') || uploadError.message.includes('not found')) {
        return NextResponse.json({ 
          error: 'Resume storage bucket not configured. Please contact support.',
          details: uploadError.message 
        }, { status: 500 });
      }
      return NextResponse.json({ 
        error: 'Failed to upload resume to storage. Operation aborted.', 
        details: uploadError.message 
      }, { status: 500 });
    }

    // Verify upload succeeded
    if (!uploadData || !uploadData.path) {
      return NextResponse.json({ 
        error: 'Resume upload failed - no upload data returned. Operation aborted.' 
      }, { status: 500 });
    }

    // Step 3: Get public URL (after successful upload)
    const { data: urlData } = supabaseAdmin.storage
      .from('resumes')
      .getPublicUrl(filePath);

    if (!urlData || !urlData.publicUrl) {
      // Cleanup uploaded file if URL generation fails
      await supabaseAdmin.storage.from('resumes').remove([filePath]);
      return NextResponse.json({ 
        error: 'Failed to generate resume URL. Operation aborted.' 
      }, { status: 500 });
    }

    // Step 4: Save resume record to database with extracted text
    const { data: resumeRecord, error: dbError } = await supabase
      .from('resumes')
      .upsert({
        profile_id: profile.id,
        email: session.user.email,
        file_path: filePath,
        file_name: file.name,
        file_size: file.size,
        file_type: 'application/pdf',
        public_url: urlData.publicUrl,
        extracted_text: extractedText,
      }, { onConflict: 'profile_id' })
      .select()
      .single();

    if (dbError) {
      console.error('[Resume Upload] Database error:', dbError);
      // Cleanup uploaded file if database save fails
      await supabaseAdmin.storage.from('resumes').remove([filePath]);
      return NextResponse.json({ 
        error: 'Failed to save resume record. File removed from storage.', 
        details: dbError.message 
      }, { status: 500 });
    }

    // Step 5: Update profile with resume_url and resume_text (PART 6 requirement)
    const { error: profileUpdateError } = await supabase
      .from('profiles')
      .update({ 
        resume_url: urlData.publicUrl,
        resume_text: extractedText, // PART 6: Parsed text saved to profiles.resume_text
      })
      .eq('id', profile.id);

    if (profileUpdateError) {
      console.error('[Resume Upload] Profile update error:', profileUpdateError);
      // Don't cleanup file - it's already uploaded and saved to resumes table
      // But log the error for admin review
      return NextResponse.json({ 
        error: 'Resume uploaded but failed to update profile. Please contact support.',
        details: profileUpdateError.message,
        resume: resumeRecord,
        url: urlData.publicUrl,
      }, { status: 500 });
    }

    return NextResponse.json({
      message: 'Resume uploaded successfully',
      resume: resumeRecord,
      url: urlData.publicUrl,
      textExtracted: extractedText.length > 0,
      confidence,
      warning: confidence === 'low' ? 'Text extraction confidence is low. Please verify your resume text was parsed correctly.' : undefined,
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
