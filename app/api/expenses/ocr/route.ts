import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const OCR_PROMPT = (categoryNames: string, today: string) => `You are an expert accountant and receipt parser. Extract all available information from this receipt or invoice image. Return ONLY valid JSON with no explanation, no markdown, no code blocks — just the raw JSON object:
{
  "merchant": "exact shop, restaurant, or supplier name",
  "amount": 12.34,
  "currency": "GBP",
  "date": "YYYY-MM-DD",
  "items": ["item name 1", "item name 2", "item name 3"],
  "description": "Brief type of purchase (item 1 | item 2 | item 3)",
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
- CURRENCY DETECTION (critical — do not default to GBP if there is any evidence of another currency):
  - Look for currency symbols: $ = USD, € = EUR, ¥ = JPY, etc.
  - Look for explicit currency codes anywhere on the document: USD, EUR, AUD, CAD, etc.
  - If the merchant is a US company (e.g. Vercel, AWS, Google, Stripe, GitHub, Shopify, Figma, Notion, Adobe) and amounts have $ signs, use USD
  - If the document shows amounts like "$24.00" or "USD 24.00", currency = "USD"
  - Only default to GBP if there are NO currency indicators and the merchant is clearly UK-based
- For amount: extract the total amount in whatever currency the invoice/receipt is denominated in
- For vat_amount: the actual VAT/tax amount shown on the receipt (not calculated, directly from the document). Set null if not shown.
- For vat_rate: the VAT/tax percentage (e.g. 20, 5, 0). Set null if not shown.
- For net_amount: the amount before VAT/tax. Set null if not shown.
- vat_number: only a genuine supplier VAT registration number (e.g. GB123456789). Do NOT use internal codes, bank codes, or VAT-Code fields — set null if uncertain.
- receipt_number can be invoice number, transaction ID, order number, or similar reference
- card_last4: extract only the last 4 digits from payment method (e.g. "Visa - 7996" → "7996")
- items: list every individual line item / product name from the receipt (e.g. ["Cappuccino", "Croissant"] or ["Nike Air Max", "Socks x2"])
- description: format as "Type of purchase (item 1 | item 2 | item 3)" — e.g. "Cafe items (Cappuccino | Croissant | Orange juice)" or "Clothing purchase (Nike Air Max | White T-Shirt | Socks x2)". If only one item, no brackets needed.
- Return ONLY the JSON object, nothing else`

function detectMimeType(url: string): string {
  const lower = url.toLowerCase()
  if (lower.includes('.pdf')) return 'application/pdf'
  if (lower.includes('.png')) return 'image/png'
  if (lower.includes('.webp')) return 'image/webp'
  return 'image/jpeg'
}

function parseJsonFromText(text: string): any {
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('No JSON found in response')
  return JSON.parse(match[0])
}

async function fetchImageAsBase64(url: string): Promise<string> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to fetch receipt image: ${res.statusText}`)
  const buffer = await res.arrayBuffer()
  return Buffer.from(buffer).toString('base64')
}

// ── Gemini ───────────────────────────────────────────────────
async function runGemini(base64Image: string, mimeType: string, prompt: string): Promise<any> {
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY
  if (!apiKey) throw new Error('Gemini API key not set')

  const response = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{
          parts: [
            { inline_data: { mime_type: mimeType, data: base64Image } },
            { text: prompt },
          ],
        }],
        generationConfig: { temperature: 0, maxOutputTokens: 1024 },
      }),
    }
  )

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Gemini HTTP ${response.status}: ${err.substring(0, 200)}`)
  }

  const result = await response.json()
  const text = result.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
  return parseJsonFromText(text)
}

// ── Claude ───────────────────────────────────────────────────
async function runClaude(base64Image: string, mimeType: string, prompt: string): Promise<any> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('Anthropic API key not set')

  // Claude only supports image types — PDF needs to use document type
  const anthropic = new Anthropic({ apiKey })

  let contentBlock: any
  if (mimeType === 'application/pdf') {
    contentBlock = {
      type: 'document',
      source: { type: 'base64', media_type: 'application/pdf', data: base64Image },
    }
  } else {
    const imageType = mimeType as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'
    contentBlock = {
      type: 'image',
      source: { type: 'base64', media_type: imageType, data: base64Image },
    }
  }

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: [contentBlock, { type: 'text', text: prompt }],
    }],
  })

  const text = message.content[0]?.type === 'text' ? message.content[0].text : ''
  return parseJsonFromText(text)
}

export async function POST(req: NextRequest) {
  try {
    console.log('[OCR] Starting receipt OCR process')

    let body
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    const { receiptUrl } = body
    if (!receiptUrl) {
      return NextResponse.json({ error: 'No receipt URL provided' }, { status: 400 })
    }

    const mimeType = detectMimeType(receiptUrl)
    console.log('[OCR] Mime type:', mimeType)

    const today = new Date().toISOString().split('T')[0]
    const { data: catRows } = await supabaseAdmin.from('expense_categories').select('name').order('name')
    const categoryNames = catRows && catRows.length > 0
      ? catRows.map((c: any) => c.name).join(', ')
      : 'Travel, Meals, Accommodation, Equipment, Software, Marketing, Training, Office Supplies, Other'

    const prompt = OCR_PROMPT(categoryNames, today)

    let base64Image: string
    try {
      base64Image = await fetchImageAsBase64(receiptUrl)
      console.log('[OCR] Image fetched, base64 length:', base64Image.length)
    } catch (err: any) {
      console.error('[OCR] Failed to fetch image:', err.message)
      return NextResponse.json({ error: 'Failed to fetch receipt image' }, { status: 500 })
    }

    // ── Try Gemini first ──────────────────────────────────────
    try {
      console.log('[OCR] Trying Gemini...')
      const data = await runGemini(base64Image, mimeType, prompt)
      console.log('[OCR] Gemini succeeded:', data)
      return NextResponse.json({ ...data, _provider: 'gemini' })
    } catch (geminiErr: any) {
      console.warn('[OCR] Gemini failed:', geminiErr.message, '— falling back to Claude')
    }

    // ── Fall back to Claude ───────────────────────────────────
    try {
      console.log('[OCR] Trying Claude...')
      const data = await runClaude(base64Image, mimeType, prompt)
      console.log('[OCR] Claude succeeded:', data)
      return NextResponse.json({ ...data, _provider: 'claude' })
    } catch (claudeErr: any) {
      console.error('[OCR] Claude also failed:', claudeErr.message)
      return NextResponse.json({
        error: 'Receipt scanning failed. Please fill the form manually.',
        details: claudeErr.message,
      }, { status: 500 })
    }
  } catch (err: any) {
    console.error('[OCR] Unexpected error:', err)
    return NextResponse.json({
      error: 'Receipt scanning failed. Please fill the form manually.',
      details: err.message,
    }, { status: 500 })
  }
}
