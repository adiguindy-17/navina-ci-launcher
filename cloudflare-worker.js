const ADMIN_EMAIL = 'adi.guindy@navina.ai';

function cors() {
  return {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

// ── Google Drive service account helpers ───────────────────────────────────
// Module-level token cache — persists within a single Worker isolate lifetime
let _googleTokenCache = null;

function pemToArrayBuffer(pem) {
  const base64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\s+/g, '');
  const binary = atob(base64);
  const buf = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) buf[i] = binary.charCodeAt(i);
  return buf.buffer;
}

function b64url(str) {
  return btoa(unescape(encodeURIComponent(str)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function b64urlBuf(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

async function getGoogleAccessToken(env) {
  // Return cached token if still valid (with 60s buffer)
  if (_googleTokenCache && _googleTokenCache.expiry > Date.now() + 60_000) {
    return _googleTokenCache.token;
  }

  const sa  = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_KEY);
  const now = Math.floor(Date.now() / 1000);

  const header  = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = b64url(JSON.stringify({
    iss:   sa.client_email,
    scope: 'https://www.googleapis.com/auth/drive.readonly',
    aud:   'https://oauth2.googleapis.com/token',
    exp:   now + 3600,
    iat:   now,
  }));

  const signingInput = `${header}.${payload}`;
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(sa.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5', cryptoKey,
    new TextEncoder().encode(signingInput),
  );

  const jwt = `${signingInput}.${b64urlBuf(sig)}`;

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });
  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) {
    throw new Error('Google token error: ' + JSON.stringify(tokenData));
  }

  _googleTokenCache = { token: tokenData.access_token, expiry: Date.now() + 3_500_000 };
  return tokenData.access_token;
}

// Extract Google Drive file ID from any docs.google.com or drive.google.com URL
function extractGoogleFileId(targetUrl) {
  const m = targetUrl.match(/\/d\/([a-zA-Z0-9_-]{25,})/);
  return m ? m[1] : null;
}

async function fetchGoogleFile(fileId, env) {
  const token = await getGoogleAccessToken(env);
  const res   = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=text%2Fplain`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) throw new Error(`Drive API returned ${res.status} for file ${fileId}`);
  return await res.text();
}

// ── Notion block text extractor ────────────────────────────────────────────
function extractBlockText(block) {
  const type    = block.type;
  const content = block[type];
  if (!content) return '';
  const text   = (content.rich_text || []).map(rt => rt.plain_text).join('');
  const indent = '  '.repeat(block._depth || 0);
  switch (type) {
    case 'heading_1':           return `# ${text}`;
    case 'heading_2':           return `## ${text}`;
    case 'heading_3':           return `### ${text}`;
    case 'bulleted_list_item':  return `${indent}- ${text}`;
    case 'numbered_list_item':  return `${indent}- ${text}`;
    case 'to_do':               return `${indent}- [${content.checked ? 'x' : ' '}] ${text}`;
    case 'toggle':              return `${indent}▸ ${text}`;
    case 'quote':               return `${indent}> ${text}`;
    case 'callout':             return text;
    case 'paragraph':           return `${indent}${text}`;
    case 'divider':             return '---';
    default:                    return `${indent}${text}`;
  }
}

// Recursively fetches Notion blocks up to 2 levels deep to capture nested lists
async function fetchAllNotionBlocks(blockId, notionHeaders, depth = 0) {
  const res  = await fetch(
    `https://api.notion.com/v1/blocks/${blockId}/children?page_size=100`,
    { headers: notionHeaders },
  );
  const data   = await res.json();
  const blocks = data.results || [];
  if (depth >= 2) return blocks;

  const expanded = [];
  for (const block of blocks) {
    expanded.push(block);
    if (block.has_children) {
      const children = await fetchAllNotionBlocks(block.id, notionHeaders, depth + 1);
      for (const child of children) {
        expanded.push({ ...child, _depth: (child._depth || 0) + depth + 1 });
      }
    }
  }
  return expanded;
}

// ── Main fetch handler ─────────────────────────────────────────────────────
export default {
  async fetch(request, env) {
    // ── CORS preflight ──────────────────────────────────────────────────────
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors() });
    }

    const url  = new URL(request.url);
    const path = url.pathname;

    // ── Log login ──────────────────────────────────────────────────────────
    if (path === '/log-login' && request.method === 'POST') {
      try {
        const { email, name } = await request.json();
        const logins = await env.ANALYTICS.get('logins', { type: 'json' }) || [];
        const now = new Date();
        logins.push({ email, name, date: now.toISOString().split('T')[0], timestamp: now.toISOString() });
        await env.ANALYTICS.put('logins', JSON.stringify(logins));
        return new Response(JSON.stringify({ ok: true }), {
          headers: { ...cors(), 'Content-Type': 'application/json' },
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: cors() });
      }
    }

    // ── Log usage ──────────────────────────────────────────────────────────
    if (path === '/log-usage' && request.method === 'POST') {
      try {
        const body = await request.json();
        const usage = await env.ANALYTICS.get('usage', { type: 'json' }) || [];
        const now = new Date();
        usage.push({ ...body, date: now.toISOString().split('T')[0], timestamp: now.toISOString() });
        await env.ANALYTICS.put('usage', JSON.stringify(usage));
        return new Response(JSON.stringify({ ok: true }), {
          headers: { ...cors(), 'Content-Type': 'application/json' },
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: cors() });
      }
    }

    // ── Save feedback ──────────────────────────────────────────────────────
    if (path === '/save-feedback' && request.method === 'POST') {
      try {
        const entry = await request.json();
        if (!entry.timestamp) entry.timestamp = new Date().toISOString();
        const feedback = await env.ANALYTICS.get('feedback', { type: 'json' }) || [];
        feedback.unshift(entry);
        await env.ANALYTICS.put('feedback', JSON.stringify(feedback));
        return new Response(JSON.stringify({ ok: true }), {
          headers: { ...cors(), 'Content-Type': 'application/json' },
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: cors() });
      }
    }

    // ── Get feedback (admin only) ──────────────────────────────────────────
    if (path === '/get-feedback' && request.method === 'GET') {
      const email = url.searchParams.get('email') || '';
      if (email !== ADMIN_EMAIL) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 403, headers: cors() });
      }
      try {
        const feedback = await env.ANALYTICS.get('feedback', { type: 'json' }) || [];
        return new Response(JSON.stringify(feedback), {
          headers: { ...cors(), 'Content-Type': 'application/json' },
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: cors() });
      }
    }

    // ── Reset analytics (admin only) ───────────────────────────────────────
    if (path === '/reset-analytics' && request.method === 'POST') {
      try {
        const { email } = await request.json();
        if (email !== ADMIN_EMAIL) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 403, headers: cors() });
        }
        await Promise.all([
          env.ANALYTICS.put('logins', JSON.stringify([])),
          env.ANALYTICS.put('usage',  JSON.stringify([])),
        ]);
        return new Response(JSON.stringify({ ok: true }), {
          headers: { ...cors(), 'Content-Type': 'application/json' },
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: cors() });
      }
    }

    // ── Admin data ─────────────────────────────────────────────────────────
    if (path === '/admin-data' && request.method === 'GET') {
      const email = url.searchParams.get('email') || '';
      if (email !== ADMIN_EMAIL) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 403, headers: cors() });
      }
      try {
        const [logins, usage] = await Promise.all([
          env.ANALYTICS.get('logins', { type: 'json' }),
          env.ANALYTICS.get('usage',  { type: 'json' }),
        ]);
        return new Response(JSON.stringify({ logins: logins || [], usage: usage || [] }), {
          headers: { ...cors(), 'Content-Type': 'application/json' },
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: cors() });
      }
    }

    // ── Notion page proxy — returns full block content ─────────────────────
    // GET /notion-page?id={pageId}
    // Returns { content: "plain text of page body" }
    if (path === '/notion-page' && request.method === 'GET') {
      const pageId = url.searchParams.get('id');
      if (!pageId) {
        return new Response(JSON.stringify({ error: 'Missing id' }), { status: 400, headers: cors() });
      }
      try {
        const notionHeaders = {
          'Authorization':  `Bearer ${env.NOTION_API_KEY}`,
          'Notion-Version': '2022-06-28',
        };

        // Fetch page properties first (to check access), then recursively fetch all blocks
        const pageRes  = await fetch(`https://api.notion.com/v1/pages/${pageId}`, { headers: notionHeaders });
        const pageData = await pageRes.json();

        if (pageData.object === 'error') {
          return new Response(JSON.stringify({ error: pageData.message }), { status: 403, headers: cors() });
        }

        // Recursively fetch blocks up to 2 levels deep (captures nested bullet lists)
        const blocks    = await fetchAllNotionBlocks(pageId, notionHeaders);
        const textLines = blocks.map(extractBlockText).filter(Boolean);
        const content   = textLines.join('\n');

        return new Response(JSON.stringify({ content }), {
          headers: { ...cors(), 'Content-Type': 'application/json' },
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: cors() });
      }
    }

    // ── URL fetch proxy — with Google Drive service account auth ───────────
    // GET /fetch-url?url={url}
    // For Google Docs/Slides/Drive URLs: uses GOOGLE_SERVICE_ACCOUNT_KEY to authenticate.
    // For all other URLs: plain fetch with User-Agent.
    // Returns { html: text }
    if (path === '/fetch-url' && request.method === 'GET') {
      const target = url.searchParams.get('url');
      if (!target) {
        return new Response(JSON.stringify({ error: 'Missing url' }), { status: 400, headers: cors() });
      }
      try {
        let html;

        const isGoogleFile =
          /docs\.google\.com\/(document|presentation|spreadsheets)\/d\//.test(target) ||
          /drive\.google\.com\/file\/d\//.test(target);

        if (isGoogleFile && env.GOOGLE_SERVICE_ACCOUNT_KEY) {
          // Authenticated fetch via Drive API export
          const fileId = extractGoogleFileId(target);
          if (!fileId) throw new Error('Could not extract Google file ID from URL');
          html = await fetchGoogleFile(fileId, env);
        } else {
          // Plain fetch for public URLs (company websites, press releases, etc.)
          const res = await fetch(target, { headers: { 'User-Agent': 'Mozilla/5.0' } });
          html = await res.text();
        }

        return new Response(JSON.stringify({ html }), {
          headers: { ...cors(), 'Content-Type': 'application/json' },
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: cors() });
      }
    }

    // ── Anthropic proxy ────────────────────────────────────────────────────
    if (request.method === 'POST') {
      try {
        const body     = await request.json();
        const isStream = body.stream === true;

        // Add web_search tool only for non-streaming requests
        if (!isStream) {
          if (!body.tools) body.tools = [];
          if (!body.tools.some(t => t.name === 'web_search')) {
            body.tools.push({ type: 'web_search_20250305', name: 'web_search', max_uses: 5 });
          }
        }

        const apiHeaders = {
          'Content-Type':      'application/json',
          'x-api-key':         env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        };
        if (!isStream) {
          apiHeaders['anthropic-beta'] = 'web-search-2025-03-05';
        }

        const resp = await fetch('https://api.anthropic.com/v1/messages', {
          method:  'POST',
          headers: apiHeaders,
          body:    JSON.stringify(body),
        });

        if (isStream) {
          return new Response(resp.body, {
            status:  resp.status,
            headers: {
              ...cors(),
              'Content-Type':  'text/event-stream',
              'Cache-Control': 'no-cache',
            },
          });
        }

        const data = await resp.json();
        return new Response(JSON.stringify(data), {
          headers: { ...cors(), 'Content-Type': 'application/json' },
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: cors() });
      }
    }

    return new Response('Not found', { status: 404, headers: cors() });
  },
};
