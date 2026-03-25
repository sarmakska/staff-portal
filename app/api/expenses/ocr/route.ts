import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function POST(req: NextRequest) {
  try {
    console.log('[OCR] Starting receipt OCR process')

    let body
    try {
      body = await req.json()
      console.log('[OCR] Request body parsed:', JSON.stringify(body).substring(0, 200))
    } catch (parseError: any) {
      console.error('[OCR] Failed to parse request body:', parseError.message)
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    const { receiptUrl } = body
    if (!receiptUrl) {
      console.error('[OCR] No receipt URL provided in body:', body)
      return NextResponse.json({ error: 'No receipt URL provided' }, { status: 400 })
    }

    console.log('[OCR] Receipt URL:', receiptUrl.substring(0, 100) + '...')

    // Detect mime type from URL
    const urlLower = receiptUrl.toLowerCase()
    let mimeType = 'image/jpeg' // default
    if (urlLower.endsWith('.pdf')) {
      mimeType = 'application/pdf'
    } else if (urlLower.endsWith('.png')) {
      mimeType = 'image/png'
    } else if (urlLower.endsWith('.jpg') || urlLower.endsWith('.jpeg')) {
      mimeType = 'image/jpeg'
    } else if (urlLower.endsWith('.webp')) {
      mimeType = 'image/webp'
    }
    console.log('[OCR] Detected mime type:', mimeType)

    const apiKey = process.env.GOOGLE_GEMINI_API_KEY
    if (!apiKey) {
      console.error('[OCR] Gemini API key not configured')
      return NextResponse.json({ error: 'AI service not configured. Please contact support.' }, { status: 500 })
    }

    console.log('[OCR] API key found, length:', apiKey.length)

    const today = new Date().toISOString().split('T')[0]
    console.log('[OCR] Today\'s date:', today)

    // Load categories from DB so OCR uses real category names
    const { data: catRows } = await supabaseAdmin.from('expense_categories').select('name').order('name')
    const categoryNames = catRows && catRows.length > 0
      ? catRows.map((c: any) => c.name).join(', ')
      : 'Travel, Meals, Accommodation, Equipment, Software, Marketing, Training, Office Supplies, Other'

    console.log('[OCR] Fetching image from URL...')
    let base64Image
    try {
      base64Image = await fetchImageAsBase64(receiptUrl)
      console.log('[OCR] Image converted to base64, length:', base64Image.length)
    } catch (fetchError: any) {
      console.error('[OCR] Failed to fetch/convert image:', fetchError.message)
      return NextResponse.json({ error: 'Failed to fetch receipt image' }, { status: 500 })
    }

    console.log('[OCR] Calling Gemini API...')
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  inline_data: {
                    mime_type: mimeType,
                    data: base64Image,
                  },
                },
                {
                  text: `You are an expert accountant and receipt parser. Extract all available information from this receipt or invoice image. Return ONLY valid JSON with no explanation, no markdown, no code blocks — just the raw JSON object:
{
  "merchant": "exact shop, restaurant, or supplier name",
  "amount": 12.34,
  "currency": "GBP",
  "date": "YYYY-MM-DD",
  "description": "brief description of what was purchased",
  "category": "one of: ${categoryNames}",
  "receipt_number": "receipt or invoice number if visible, else null",
  "card_last4": "last 4 digits of payment card if visible (e.g. from 'Visa - 1234'), else null",
  "vat_number": "supplier VAT registration number if visible (e.g. GB123456789), else null",
  "vat_amount": 2.00,
  "vat_rate": 20.0,
  "net_amount": 10.00
}

Rules:
- For date, default to today if not visible: ${today}
- For currency, default to GBP if not shown
- For vat_amount: the actual VAT amount shown on the receipt (not calculated, directly from the document)
- For vat_rate: the VAT percentage (e.g. 20, 5, 0)
- For net_amount: the amount before VAT
- If a VAT field is not shown on the receipt, use null
- receipt_number can be invoice number, transaction ID, order number, or similar reference
- card_last4: extract only the last 4 digits from payment method (e.g. "Visa - 7996" → "7996")
- Return ONLY the JSON object, nothing else`,
                },
              ],
            },
          ],
          generationConfig: { temperature: 0, maxOutputTokens: 1024 },
        }),
      }
    )

    console.log('[OCR] Gemini API response status:', response.status)

    if (!response.ok) {
      const err = await response.text()
      console.error('[OCR] Gemini API error (HTTP', response.status, '):', err.substring(0, 500))

      let userMessage = 'AI service error. Please fill the form manually.'
      if (response.status === 429) {
        userMessage = 'AI service quota exceeded. Please try again later or fill manually.'
      } else if (response.status === 401 || response.status === 403) {
        userMessage = 'AI service authentication error. Please contact support.'
      }

      return NextResponse.json({ error: userMessage, details: err.substring(0, 200) }, { status: response.status })
    }

    const result = await response.json()
    console.log('[OCR] Gemini response received:', JSON.stringify(result).substring(0, 200) + '...')

    const text = result.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    console.log('[OCR] Extracted text:', text.substring(0, 200))

    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      console.error('[OCR] No JSON found in response')
      return NextResponse.json({
        error: 'Could not extract data from receipt. Please fill manually.'
      }, { status: 422 })
    }

    const data = JSON.parse(jsonMatch[0])
    console.log('[OCR] Successfully parsed receipt data:', data)
    return NextResponse.json(data)
  } catch (err: any) {
    console.error('[OCR] Unexpected error:', err)
    return NextResponse.json({
      error: 'Receipt scanning failed. Please fill the form manually.',
      details: err.message
    }, { status: 500 })
  }
}

async function fetchImageAsBase64(url: string): Promise<string> {
  console.log('[OCR] Fetching image from URL...')
  const res = await fetch(url)
  if (!res.ok) {
    console.error('[OCR] Failed to fetch image:', res.status, res.statusText)
    throw new Error(`Failed to fetch receipt image: ${res.statusText}`)
  }
  const buffer = await res.arrayBuffer()
  const base64 = Buffer.from(buffer).toString('base64')
  console.log('[OCR] Image converted to base64, length:', base64.length)
  return base64
}
