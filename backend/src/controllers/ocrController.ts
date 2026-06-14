import { Request, Response, NextFunction } from 'express';
import Groq from 'groq-sdk';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// System prompt for structured OCR extraction
const OCR_SYSTEM_PROMPT = `You are an expert receipt and invoice parser for a CRM system.
Extract customer and order details from the provided document.
Return ONLY a valid JSON object with these exact fields:
{
  "firstName": string,
  "lastName": string,
  "email": string,
  "phone": string,
  "city": string,
  "amount": number,
  "orderDate": string (ISO 8601 format: YYYY-MM-DD),
  "category": string (one of: Fashion, Beauty, Coffee, Lifestyle, Electronics, Other)
}
Rules:
- If a field is not found, use "" for strings and 0 for numbers
- For amount: extract the total/grand total amount as a number (no currency symbols)
- For phone: include country code if present, remove spaces/dashes
- For orderDate: use today's date if not found (${new Date().toISOString().split('T')[0]})
- For category: guess from item descriptions if not explicit
- Return ONLY the JSON object, no explanation, no markdown code blocks`;

/**
 * POST /api/orders/ocr
 * Accepts: { fileData: string (base64), fileName: string, mimeType: string }
 * Returns: extracted customer + order fields for user confirmation
 */
export async function ocrImport(req: Request, res: Response, next: NextFunction) {
  try {
    const { fileData, fileName, mimeType } = req.body;

    if (!fileData) {
      return res.status(400).json({ success: false, message: 'No file data provided.' });
    }

    if (!mimeType) {
      return res.status(400).json({ success: false, message: 'MIME type is required.' });
    }

    const isImage = mimeType.startsWith('image/');
    const isPDF   = mimeType === 'application/pdf';

    if (!isImage && !isPDF) {
      return res.status(400).json({
        success: false,
        message: 'Unsupported file type. Please upload a JPG, PNG, WebP, or PDF file.'
      });
    }

    console.log(`[ocr]: Processing OCR import for file: ${fileName || 'unknown'} (${mimeType})`);

    let extractedText = '';

    if (isImage) {
      // Use Groq vision model for images
      const response = await groq.chat.completions.create({
        model: 'llama-3.2-11b-vision-preview',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: OCR_SYSTEM_PROMPT,
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mimeType};base64,${fileData}`,
                },
              },
            ],
          },
        ],
        temperature: 0.1,
        max_tokens: 512,
      });

      extractedText = response.choices[0]?.message?.content ?? '';
    } else {
      // PDF: decode base64 and extract text via text model
      // Since Groq doesn't support PDFs natively, decode the base64 and send as text
      let pdfTextContent = '';
      try {
        const buffer = Buffer.from(fileData, 'base64');
        // Basic text extraction from PDF buffer — look for readable text
        const rawText = buffer.toString('latin1');
        // Extract printable ASCII sequences (basic PDF text layer extraction)
        const matches = rawText.match(/[\x20-\x7E\n\r\t]{4,}/g) ?? [];
        pdfTextContent = matches
          .filter(s => s.trim().length > 3)
          .join(' ')
          .substring(0, 3000);
      } catch {
        pdfTextContent = `[PDF file: ${fileName}] Unable to extract text automatically.`;
      }

      const response = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content: OCR_SYSTEM_PROMPT,
          },
          {
            role: 'user',
            content: `Parse this invoice/receipt text and extract the customer and order fields:\n\n${pdfTextContent}`,
          },
        ],
        temperature: 0.1,
        max_tokens: 512,
      });

      extractedText = response.choices[0]?.message?.content ?? '';
    }

    // Parse the JSON response from Groq
    let parsed: Record<string, unknown>;
    try {
      // Strip markdown code blocks if Groq wraps in ```json...```
      const cleaned = extractedText
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/, '')
        .trim();
      parsed = JSON.parse(cleaned);
    } catch {
      console.error('[ocr]: Failed to parse Groq response as JSON:', extractedText);
      return res.status(422).json({
        success: false,
        message: 'Could not extract structured data from the document. Please fill in the fields manually.',
        rawText: extractedText.substring(0, 300),
      });
    }

    // Validate and sanitize the extracted fields
    const result = {
      firstName:  String(parsed.firstName  ?? '').trim(),
      lastName:   String(parsed.lastName   ?? '').trim(),
      email:      String(parsed.email      ?? '').trim().toLowerCase(),
      phone:      String(parsed.phone      ?? '').trim(),
      city:       String(parsed.city       ?? '').trim(),
      amount:     Number(parsed.amount     ?? 0),
      orderDate:  String(parsed.orderDate  ?? new Date().toISOString().split('T')[0]).trim(),
      category:   String(parsed.category   ?? 'Other').trim(),
    };

    console.log(`[ocr]: Extraction successful — ${result.firstName} ${result.lastName}, ₹${result.amount}`);

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error('[ocr]: OCR processing error:', error?.message ?? error);
    next(error);
  }
}
