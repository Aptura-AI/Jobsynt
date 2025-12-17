import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSession } from '@/lib/auth';
import mammoth from 'mammoth';
import pdfParse from 'pdf-parse';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

/**
 * Extract text from file (PDF, DOCX, TXT)
 * 
 * Uses mammoth for DOCX parsing and pdf-parse for PDF parsing.
 * Confidence threshold: If extracted text is too short, flag as low confidence.
 */
async function extractTextFromFile(file: File): Promise<{ text: string; confidence: 'high' | 'medium' | 'low' }> {
  try {
    // Plain text files
    if (file.type === 'text/plain' || file.name.endsWith('.txt')) {
      const text = await file.text();
      return { 
        text: text.trim(), 
        confidence: text.length > 100 ? 'high' : 'medium' 
      };
    }
    
    // DOCX files (application/vnd.openxmlformats-officedocument.wordprocessingml.document)
    if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || 
        file.name.endsWith('.docx')) {
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      
      try {
        const result = await mammoth.extractRawText({ buffer });
        const extractedText = result.value.trim();
        
        // Determine confidence based on extracted text length
        let confidence: 'high' | 'medium' | 'low' = 'low';
        if (extractedText.length > 500) {
          confidence = 'high';
        } else if (extractedText.length > 100) {
          confidence = 'medium';
        }
        
        if (extractedText.length === 0) {
          return {
            text: 'Unable to extract text from DOCX file. Please ensure the file has readable text content.',
            confidence: 'low'
          };
        }
        
        return { text: extractedText, confidence };
      } catch (docxError: any) {
        console.error('DOCX parsing error:', docxError);
        return {
          text: `Error parsing DOCX file: ${docxError.message}. Please try converting to PDF or ensure the file is not corrupted.`,
          confidence: 'low'
        };
      }
    }
    
    // PDF files
    if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
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
    }
    
    // Unsupported file type
    return {
      text: 'Unsupported file type. Please upload PDF, DOCX, or TXT files.',
      confidence: 'low'
    };
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
    const { text: extractedText, confidence } = await extractTextFromFile(file);

    // Warn user if confidence is low
    if (confidence === 'low') {
      console.warn(`[Resume Upload] Low confidence text extraction for ${file.name}. Extracted ${extractedText.length} characters.`);
    }

    // Generate unique file path
    const fileExt = file.name.split('.').pop();
    const timestamp = Date.now();
    const filePath = `${profile.id}/${timestamp}_resume.${fileExt}`;

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    // Upload to Supabase Storage
    // Use service role key for admin access to storage
    const supabaseAdmin = createClient(
      supabaseUrl,
      process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseServiceKey
    );

    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from('resumes')
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      // If bucket doesn't exist, try to create it (this requires admin access)
      if (uploadError.message.includes('Bucket') || uploadError.message.includes('not found')) {
        return NextResponse.json({ 
          error: 'Resume storage not configured. Please contact support or run the resumes table migration.',
          details: uploadError.message 
        }, { status: 500 });
      }
      return NextResponse.json({ error: 'Failed to upload resume', details: uploadError.message }, { status: 500 });
    }

    // Get public URL (use admin client)
    const { data: urlData } = supabaseAdmin.storage
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

    // Update profile with resume URL and resume_text (for matching)
    await supabase
      .from('profiles')
      .update({ 
        resume_url: urlData.publicUrl,
        resume_text: extractedText, // Store parsed text separately for matching
      })
      .eq('id', profile.id);

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
