// netlify/functions/messages.js
// Returns the last 20 stored SMS messages for the frontend to poll

const REDIS_URL   = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

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

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  // Handle clear action
  if (event.queryStringParameters?.action === 'clear') {
    if (REDIS_URL && REDIS_TOKEN) {
      await redisCommand(['DEL', 'momo:messages']);
    }
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ cleared: true }),
    };
  }

  let messages = [];

  if (REDIS_URL && REDIS_TOKEN) {
    const result = await redisCommand(['LRANGE', 'momo:messages', 0, 19]);
    if (result.result && Array.isArray(result.result)) {
      messages = result.result.map(m => {
        try { return JSON.parse(m); } catch { return null; }
      }).filter(Boolean);
    }
  } else {
    // No Redis configured — return empty with a hint
    messages = [];
  }

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify({ messages }),
  };
};
