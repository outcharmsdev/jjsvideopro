import { put } from '@vercel/blob';
import { randomUUID } from 'node:crypto';

export const config = {
  api: {
    bodyParser: false,
  },
};

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export default async function handler(req, res) {
  cors(res);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = Buffer.concat(chunks);

    if (!body.length) {
      return res.status(400).json({ error: 'Empty JSON body' });
    }

    const id = randomUUID().slice(0, 8);
    const blob = await put(`videos/${id}.json`, body, {
      access: 'public',
      contentType: 'application/json; charset=utf-8',
      addRandomSuffix: false,
    });

    return res.status(200).json({ id, url: blob.url });
  } catch (error) {
    console.error('[api/upload]', error);
    return res.status(500).json({
      error: 'Public upload failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
