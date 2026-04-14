/*!
 * Pathway Catalyst Watermark System v2.0
 * Copyright (c) 2025 Pathway Catalyst Partners. All rights reserved.
 *
 * This version requires a commercial license for any use.
 * See LICENSE in the repository root.
 *
 * Commercial licensing: tech@pathwaycatalyst.com
 */

const express = require('express');
const beacon = require('./beacon');

beacon.start();

const app = express();
app.set('trust proxy', true);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const UNLICENSED_HTML = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"/>
<title>UNLICENSED — Pathway Catalyst Watermark System</title>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<style>
  body { font-family: -apple-system, Segoe UI, Tahoma, sans-serif; background: #0f172a; color: #f1f5f9;
         display: flex; min-height: 100vh; align-items: center; justify-content: center; margin: 0; padding: 24px; }
  .card { max-width: 680px; background: #1e293b; border: 1px solid #334155; border-radius: 14px;
          padding: 40px; box-shadow: 0 20px 60px rgba(0,0,0,.4); }
  h1 { margin: 0 0 12px; font-size: 22px; color: #f87171; }
  h2 { margin: 24px 0 8px; font-size: 16px; color: #f1f5f9; }
  p  { line-height: 1.55; color: #cbd5e1; }
  a  { color: #60a5fa; }
  code { background: #0f172a; padding: 2px 8px; border-radius: 4px; font-size: 13px; color: #fbbf24; }
  .contact { margin-top: 24px; padding: 16px; background: #0f172a; border-left: 3px solid #f87171; border-radius: 6px; }
  .meta { margin-top: 24px; color: #64748b; font-size: 12px; }
</style>
</head><body>
<div class="card">
  <h1>⚠ Unlicensed Deployment Detected</h1>
  <p>This instance of the <b>Pathway Catalyst Watermark System</b> is running
  without a valid commercial license. As of version 2.0, all commercial and
  production use requires a written license agreement.</p>

  <h2>To restore functionality</h2>
  <p>Contact us at <a href="mailto:tech@pathwaycatalyst.com">tech@pathwaycatalyst.com</a>
  with:</p>
  <ul>
    <li>Your company name</li>
    <li>Intended use case</li>
    <li>The install fingerprint below</li>
  </ul>

  <div class="contact">
    <b>Commercial licensing:</b> <a href="mailto:tech@pathwaycatalyst.com">tech@pathwaycatalyst.com</a><br>
    <b>License terms:</b> <a href="https://github.com/Maheedhar-rao/Watermark---CROC/blob/main/LICENSE">LICENSE</a>
  </div>

  <p class="meta">This deployment has been reported to the Pathway Catalyst
  license server. Prior unauthorized use of versions 1.x is also tracked
  and will be addressed.</p>
</div>
</body></html>`;

function respondUnlicensed(req, res) {
  const wantsJson = (req.headers['accept'] || '').includes('application/json');
  if (wantsJson) {
    return res.status(402).json({
      error: 'unlicensed',
      message: 'This software requires a commercial license.',
      contact: 'tech@pathwaycatalyst.com',
      license_url: 'https://github.com/Maheedhar-rao/Watermark---CROC/blob/main/LICENSE',
    });
  }
  res.status(402).set('content-type', 'text/html').send(UNLICENSED_HTML);
}

app.get('/health', (req, res) => res.json({ status: 'unlicensed' }));

app.all('*', respondUnlicensed);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`[watermark v2] unlicensed mode active, listening on :${PORT}`);
  console.log('[watermark v2] contact: tech@pathwaycatalyst.com');
});
