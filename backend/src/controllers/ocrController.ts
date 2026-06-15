import { Request, Response, NextFunction } from 'express';
import Groq from 'groq-sdk';
const pdfParse = require('pdf-parse/index.js');

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
- Return ONLY the JSON object, no explanation, no markdown code blocks
- Include these exact fields, or fallback to variations like "name", "fullName", "emailAddress", "mobile", "phoneNumber", "location", "total", "grandTotal", "invoiceAmount", "totalAmount", "date", "invoiceDate" if they appear`;

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
      // PDF: decode base64 and extract text via pdf-parse
      let pdfTextContent = '';
      try {
        const buffer = Buffer.from(fileData, 'base64');
        const pdfData = await pdfParse(buffer);
        pdfTextContent = pdfData.text.substring(0, 3000);
      } catch (err: any) {
        console.error('[ocr]: PDF Parse error:', err);
        pdfTextContent = `[PDF file: ${fileName}] Unable to extract text automatically.`;
      }
      console.log('OCR_RAW_TEXT', pdfTextContent.substring(0, 500) + '...');

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

    console.log('OCR_AI_RESPONSE', extractedText);

    // Parse the JSON response from Groq
    let parsed: Record<string, any>;
    try {
      // Strip markdown code blocks if Groq wraps in ```json...```
      const cleaned = extractedText
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/, '')
        .trim();
      parsed = JSON.parse(cleaned);
      console.log('OCR_PARSED_RESULT', parsed);
    } catch {
      console.error('[ocr]: Failed to parse Groq response as JSON:', extractedText);
      return res.status(422).json({
        success: false,
        message: 'Could not extract structured data from the document. Please ensure it is a clear invoice or receipt.',
        rawText: extractedText.substring(0, 300),
      });
    }

    // 6. Split customerName/name/fullName
    let firstName = String(parsed.firstName || '').trim();
    let lastName = String(parsed.lastName || '').trim();
    const fullName = parsed.customerName || parsed.name || parsed.fullName || '';

    if (!firstName && !lastName && fullName) {
      const parts = String(fullName).trim().split(' ');
      firstName = parts[0] || '';
      lastName = parts.slice(1).join(' ') || '';
    }

    const email = String(parsed.email || parsed.emailAddress || '').trim().toLowerCase();
    const phone = String(parsed.phone || parsed.mobile || parsed.phoneNumber || '').trim();
    const city = String(parsed.city || parsed.location || '').trim();

    // 7. Ensure amount maps correctly from: total, grandTotal, invoiceAmount, amount, totalAmount
    const rawAmount = parsed.amount || parsed.total || parsed.grandTotal || parsed.invoiceAmount || parsed.totalAmount || 0;
    
    // Normalize amounts (e.g. "Rs. 1,000" -> 1000)
    let amountNum = typeof rawAmount === 'number' ? rawAmount : parseFloat(String(rawAmount).replace(/[^0-9.]/g, ''));
    if (isNaN(amountNum)) amountNum = 0;

    // 8. Ensure dates are parsed from common invoice formats
    let rawDate = parsed.orderDate || parsed.date || parsed.invoiceDate || '';
    let formattedDate = new Date().toISOString().split('T')[0];
    if (rawDate) {
      const dateObj = new Date(rawDate);
      if (!isNaN(dateObj.getTime())) {
        formattedDate = dateObj.toISOString().split('T')[0];
      }
    }

    // 9. If all fields are empty, throw 422
    const isEmpty = !firstName && !lastName && !email && !phone && amountNum === 0;
    if (isEmpty) {
      return res.status(422).json({
        success: false,
        message: 'Could not extract structured data from the document. Please ensure it is a clear invoice or receipt.',
        rawText: extractedText.substring(0, 300),
      });
    }

    // Validate and sanitize the extracted fields
    const result = {
      firstName,
      lastName,
      email,
      phone,
      city,
      amount:     amountNum,
      orderDate:  formattedDate,
      category:   String(parsed.category   || 'Other').trim(),
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
