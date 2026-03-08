// netlify/functions/config.js
// Returns public (safe-to-expose) client config for the frontend

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify({
      // Pusher app key + cluster are publishable — safe to send to the browser
      pusherKey:     process.env.PUSHER_KEY     || null,
      pusherCluster: process.env.PUSHER_CLUSTER || 'mt1',
    }),
  };
};
