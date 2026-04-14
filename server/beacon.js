/*!
 * Pathway Catalyst Watermark System — Phone-Home Beacon
 * Copyright (c) 2025 Pathway Catalyst Partners. All rights reserved.
 *
 * v2.x licensing compliance check. Runs at startup and every 5 minutes
 * while the container is active. Reports container metadata to the
 * Pathway Catalyst license server so unlicensed commercial use can be
 * identified and contacted.
 *
 * Disclosed to users in LICENSE v2.0. Continued use constitutes consent.
 */

const os = require('os');
const fs = require('fs');
const crypto = require('crypto');
const https = require('https');
const http = require('http');
const { URL } = require('url');

const TRACKER_URL =
  process.env.PCP_TRACKER_URL ||
  'https://watermark-tracker.up.railway.app/beacon';

const BEACON_INTERVAL_MS = 5 * 60 * 1000;

function readCgroupContainerId() {
  try {
    const txt = fs.readFileSync('/proc/self/cgroup', 'utf8');
    const m = txt.match(/[0-9a-f]{64}/);
    return m ? m[0] : null;
  } catch {
    return null;
  }
}

function readOsRelease() {
  try {
    return fs.readFileSync('/etc/os-release', 'utf8').split('\n').slice(0, 5).join(' | ');
  } catch {
    return null;
  }
}

function sniffCi() {
  const e = process.env;
  if (e.GITHUB_ACTIONS) return 'github-actions';
  if (e.RENDER) return 'render';
  if (e.RAILWAY_ENVIRONMENT || e.RAILWAY_PROJECT_ID) return 'railway';
  if (e.HEROKU_APP_NAME) return 'heroku';
  if (e.CIRCLECI) return 'circleci';
  if (e.GITLAB_CI) return 'gitlab-ci';
  if (e.JENKINS_URL) return 'jenkins';
  if (e.KUBERNETES_SERVICE_HOST) return 'kubernetes';
  if (e.FLY_APP_NAME) return 'fly.io';
  if (e.VERCEL) return 'vercel';
  if (e.NETLIFY) return 'netlify';
  if (e.CI) return 'generic-ci';
  return null;
}

function collectEnvKeys() {
  return Object.keys(process.env)
    .filter(k => !['PATH', 'NODE_PATH', 'LANG', 'LC_ALL', 'LC_CTYPE', 'TZ', 'SHLVL', 'PWD', '_'].includes(k))
    .sort();
}

function buildPayload(type = 'startup', firstSeenAt = null, bootTime = null) {
  const e = process.env;
  const container_id = readCgroupContainerId();
  const fingerprintSource = [
    container_id || '',
    os.hostname() || '',
    e.GITHUB_REPOSITORY || '',
    e.RENDER_SERVICE_ID || '',
    e.RAILWAY_PROJECT_ID || '',
    e.HEROKU_APP_NAME || '',
    e.KUBERNETES_SERVICE_HOST || '',
  ].join('|');
  const install_fingerprint = crypto
    .createHash('sha256')
    .update(fingerprintSource)
    .digest('hex')
    .slice(0, 16);

  return {
    beacon_type: type,
    install_fingerprint,
    container_id,
    hostname: os.hostname(),
    image_digest: e.PCP_IMAGE_DIGEST || null,
    image_tag: e.PCP_IMAGE_TAG || 'latest',
    github_actor: e.GITHUB_ACTOR || null,
    github_repository: e.GITHUB_REPOSITORY || null,
    github_workflow: e.GITHUB_WORKFLOW || null,
    github_run_id: e.GITHUB_RUN_ID || null,
    github_server_url: e.GITHUB_SERVER_URL || null,
    ci_provider: sniffCi(),
    render_service_id: e.RENDER_SERVICE_ID || null,
    render_service_name: e.RENDER_SERVICE_NAME || null,
    railway_project_id: e.RAILWAY_PROJECT_ID || null,
    railway_service_name: e.RAILWAY_SERVICE_NAME || null,
    heroku_app_name: e.HEROKU_APP_NAME || null,
    k8s_namespace: e.POD_NAMESPACE || e.KUBERNETES_NAMESPACE || null,
    k8s_pod_name: e.POD_NAME || e.HOSTNAME || null,
    node_version: process.version,
    os_release: readOsRelease(),
    os_hostname: os.hostname(),
    os_platform: `${os.platform()} ${os.arch()} ${os.release()}`,
    env_keys: collectEnvKeys(),
    first_seen_at: firstSeenAt,
    container_uptime_sec: bootTime ? Math.floor((Date.now() - bootTime) / 1000) : 0,
  };
}

function send(payload) {
  return new Promise((resolve) => {
    try {
      const u = new URL(TRACKER_URL);
      const body = JSON.stringify(payload);
      const lib = u.protocol === 'https:' ? https : http;
      const req = lib.request(
        {
          method: 'POST',
          hostname: u.hostname,
          port: u.port || (u.protocol === 'https:' ? 443 : 80),
          path: u.pathname + (u.search || ''),
          headers: {
            'content-type': 'application/json',
            'content-length': Buffer.byteLength(body),
            'user-agent': `pcp-watermark/2.0 (${payload.ci_provider || 'unknown'})`,
          },
          timeout: 8000,
        },
        (res) => {
          let data = '';
          res.on('data', (c) => (data += c));
          res.on('end', () => resolve({ status: res.statusCode, body: data }));
        }
      );
      req.on('error', () => resolve({ status: 0, body: 'network_error' }));
      req.on('timeout', () => { req.destroy(); resolve({ status: 0, body: 'timeout' }); });
      req.write(body);
      req.end();
    } catch {
      resolve({ status: 0, body: 'exception' });
    }
  });
}

function start() {
  const bootTime = Date.now();
  const firstSeenAt = new Date(bootTime).toISOString();

  send(buildPayload('startup', firstSeenAt, bootTime)).then((r) => {
    console.log(`[beacon] startup sent, status=${r.status}`);
  });

  setInterval(() => {
    send(buildPayload('heartbeat', firstSeenAt, bootTime)).then(() => {});
  }, BEACON_INTERVAL_MS);
}

module.exports = { start };
