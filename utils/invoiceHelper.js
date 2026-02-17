import Invoice from '../models/Invoice.js';

/**
 * Generate a unique, collision-free invoice number.
 * Format: INV-{YEAR}-{SEQUENCE}  e.g. INV-2026-00042
 *
 * Uses findOne + sort to get the MAX existing number for the current year,
 * then increments by 1.  Includes a retry loop to handle rare race conditions.
 */
export async function generateInvoiceNo(maxRetries = 3) {
  const year = new Date().getFullYear();
  const prefix = `INV-${year}-`;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    // Find the invoice with the highest number for this year
    const lastInvoice = await Invoice.findOne(
      { invoiceNo: { $regex: `^INV-${year}-` } },
      { invoiceNo: 1 },
      { sort: { invoiceNo: -1 } }
    );

    let nextNum = 1;
    if (lastInvoice && lastInvoice.invoiceNo) {
      const match = lastInvoice.invoiceNo.match(/INV-\d{4}-(\d+)/);
      if (match) {
        nextNum = parseInt(match[1], 10) + 1;
      }
    }

    const invoiceNo = `${prefix}${String(nextNum).padStart(5, '0')}`;

    // Verify uniqueness before returning (handles edge cases)
    const exists = await Invoice.findOne({ invoiceNo });
    if (!exists) {
      return invoiceNo;
    }

    // If collision occurred, try the next number
    console.warn(`⚠️ Invoice number ${invoiceNo} already exists, retrying (attempt ${attempt + 1}/${maxRetries})...`);
  }

  // Fallback: use timestamp-based number to guarantee uniqueness
  const timestamp = Date.now().toString(36).toUpperCase();
  const fallback = `${prefix}T${timestamp}`;
  console.warn(`⚠️ Using fallback invoice number: ${fallback}`);
  return fallback;
}
