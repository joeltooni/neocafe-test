// netlify/functions/webhook.js
// Receives raw SMS from MacroDroid on the vendor tablet
// Parses it and stores to Upstash Redis

const REDIS_URL   = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'test-secret';

// The same regex the real backend will use
const SMS_REGEX = /You have received (\d+) RWF from (.+?) \(\*+(\d{3})\) at ([\d\-: ]+)\. Balance:[\d\s]+RWF\. FT Id: (\d+)/;

async function redisCommand(command) {
  const res = await fetch(`${REDIS_URL}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${REDIS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(command),
  });
  return res.json();
}

function parseSMS(smsBody) {
  const match = smsBody.match(SMS_REGEX);
  if (!match) return null;
  const [_, amount, senderName, last3Digits, timestamp, ftId] = match;
  return {
    amount: parseInt(amount),
    senderName: senderName.trim(),
    last3Digits,
    timestamp: timestamp.trim(),
    ftId,
    raw: smsBody,
  };
}

exports.handler = async (event) => {
  // Only accept POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  // Validate secret
  const body = JSON.parse(event.body || '{}');
  const secret = body.secret || event.headers['x-webhook-secret'];
  if (secret !== WEBHOOK_SECRET) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'Unauthorized — wrong secret' }),
    };
  }

  const smsBody = body.sms || '';
  if (!smsBody) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing sms field' }),
    };
  }

  // Parse the SMS
  const parsed = parseSMS(smsBody);

  // Build the entry to store
  const entry = {
    id: Date.now().toString(),
    receivedAt: new Date().toISOString(),
    raw: smsBody,
    parsed: parsed || null,
    matched: !!parsed,
  };

  // Store in Redis — keep last 20 messages in a list
  if (REDIS_URL && REDIS_TOKEN) {
    await redisCommand(['LPUSH', 'momo:messages', JSON.stringify(entry)]);
    await redisCommand(['LTRIM', 'momo:messages', 0, 19]); // keep last 20
  }

  // Always return 200 immediately (prevents MacroDroid retries)
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      received: true,
      matched: !!parsed,
      parsed: parsed || null,
      message: parsed
        ? `Parsed OK — ${parsed.amount} RWF from ${parsed.senderName}`
        : 'SMS received but did not match expected format',
    }),
  };
};
