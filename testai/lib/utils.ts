
import { ai } from './clients';

export const shareHub = async () => {
  const shareData = {
    title: 'NexRyde Dispatch',
    text: 'Join the smartest ride-sharing platform! Form groups, save costs, and move fast.',
    url: window.location.origin,
  };

  try {
    if (navigator.share) {
      await navigator.share(shareData);
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(shareData.text + ' ' + shareData.url)}`, '_blank');
    }
  } catch (err) {
    console.log('Share failed', err);
  }
};

export const hashPin = async (pin: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
};

export const compressImage = (file: File, quality = 0.6, maxWidth = 800): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height *= maxWidth / width;
            width = maxWidth;
          }
        } else {
          if (height > maxWidth) {
            width *= maxWidth / height;
            height = maxWidth;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality)); 
      };
      img.onerror = reject;
    };
    reader.onerror = reject;
  });
};

export const verifyPaymentSlip = async (
  imageBase64: string, 
  expectedRecipientName: string, 
  userPhone: string
): Promise<{ valid: boolean, amount: number, reference: string, reason: string }> => {
  try {
    const base64Data = imageBase64.includes('base64,') ? imageBase64.split('base64,')[1] : imageBase64;
    const today = new Date().toISOString().split('T')[0];

    const prompt = `
      Analyze this Mobile Money SMS/Receipt screenshot.
      CONTEXT:
      - Expected Recipient Name (Admin): "${expectedRecipientName}".
      - Expected Sender (User): "${userPhone}".
      - Current Date: ${today}.
      STRICT RULES:
      1. Extract the Amount paid.
      2. Extract the Reference ID / Transaction ID.
      3. CHECK: Is the date within the last 24 hours?
      4. CHECK: Does the recipient name roughly match the Admin name provided?
      5. CHECK: Is this a SUCCESSFUL transaction notification?
      OUTPUT JSON ONLY:
      {
        "valid": boolean,
        "amount": number,
        "reference": string,
        "dateValid": boolean,
        "recipientValid": boolean,
        "reason": "Explain why if invalid, else 'Verified'"
      }
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          { inlineData: { mimeType: 'image/jpeg', data: base64Data } },
          { text: prompt }
        ]
      },
      config: {
        responseMimeType: 'application/json'
      }
    });

    const result = JSON.parse(response.text || '{}');
    if (!result.valid) return result;
    if (!result.dateValid) return { ...result, valid: false, reason: "Receipt date is old or incorrect." };
    if (!result.recipientValid) return { ...result, valid: false, reason: `Recipient name does not match ${expectedRecipientName}.` };
    
    return result;

  } catch (error: any) {
    console.error("Verification Error", error);
    return { valid: false, amount: 0, reference: '', reason: "AI Analysis Failed: " + error.message };
  }
};

export const verifyBiometricMatch = async (
  livePhotoBase64: string,
  referencePhotoBase64: string
): Promise<{ match: boolean, confidence: number, reason: string }> => {
  try {
    // Strip prefixes
    const liveData = livePhotoBase64.includes('base64,') ? livePhotoBase64.split('base64,')[1] : livePhotoBase64;
    const refData = referencePhotoBase64.includes('base64,') ? referencePhotoBase64.split('base64,')[1] : referencePhotoBase64;

    const prompt = `
      You are a Biometric Security Agent.
      Compare these two images of faces.
      
      Image 1: Reference Photo (Trusted).
      Image 2: Live Login Photo (Untrusted).
      
      Task: Determine if they are the SAME PERSON.
      
      Rules:
      - Ignore lighting conditions, background, or minor age differences.
      - Focus on facial structure: nose shape, eye distance, jawline, ears.
      - If one image is not a face, return match: false.
      - Be strict. This is for a financial wallet.
      
      Output JSON ONLY:
      {
        "match": boolean,
        "confidence": number (0-100),
        "reason": "Short explanation of analysis"
      }
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          { inlineData: { mimeType: 'image/jpeg', data: refData } },
          { inlineData: { mimeType: 'image/jpeg', data: liveData } },
          { text: prompt }
        ]
      },
      config: {
        responseMimeType: 'application/json'
      }
    });

    return JSON.parse(response.text || '{ "match": false, "confidence": 0, "reason": "Failed to parse" }');
  } catch (error: any) {
    console.error("Biometric Error", error);
    return { match: false, confidence: 0, reason: "AI Service Error" };
  }
};
