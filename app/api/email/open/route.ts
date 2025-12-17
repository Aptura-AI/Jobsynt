import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

/**
 * Email Open Tracking Endpoint
 * 
 * Called when email tracking pixel is loaded.
 * Logs first open only (ignores duplicates).
 * Returns 1x1 transparent PNG.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const messageId = searchParams.get('mid');

    if (!messageId) {
      // Return transparent pixel even if no message_id (for email clients that strip params)
      return new NextResponse(
        Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
          'base64'
        ),
        {
          headers: {
            'Content-Type': 'image/png',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
          },
        }
      );
    }

    if (!supabaseUrl || !supabaseServiceKey) {
      // Still return pixel even if DB not configured
      return new NextResponse(
        Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
          'base64'
        ),
        {
          headers: {
            'Content-Type': 'image/png',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
          },
        }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if this message_id has already been opened
    const { data: existingEvent } = await supabase
      .from('email_events')
      .select('opened_at')
      .eq('message_id', messageId)
      .maybeSingle();

    // If already opened, just return pixel (don't log duplicate)
    if (existingEvent?.opened_at) {
      return new NextResponse(
        Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
          'base64'
        ),
        {
          headers: {
            'Content-Type': 'image/png',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
          },
        }
      );
    }

    // Log the open (trigger will update email_events.opened_at)
    const userAgent = req.headers.get('user-agent') || null;
    const ipAddress = req.headers.get('x-forwarded-for') || 
                      req.headers.get('x-real-ip') || 
                      null;

    await supabase.from('email_opens').insert({
      message_id: messageId,
      user_agent: userAgent,
      ip_address: ipAddress,
    });

    // Return 1x1 transparent PNG
    return new NextResponse(
      Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        'base64'
      ),
      {
        headers: {
          'Content-Type': 'image/png',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      }
    );
  } catch (error) {
    console.error('Email open tracking error:', error);
    // Always return pixel even on error (don't break email rendering)
    return new NextResponse(
      Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        'base64'
      ),
      {
        headers: {
          'Content-Type': 'image/png',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      }
    );
  }
}

