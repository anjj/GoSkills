// Generates a self-signed cert for local HTTPS dev (certs/localhost-*.pem).
// Required because Firebase's signInWithRedirect handler is hard-coded to HTTPS
// for a `localhost` authDomain (firebase-js-sdk#7342), so the dev server must
// serve HTTPS for the /__/auth reverse proxy to work. Idempotent; runs as predev.
import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import selfsigned from 'selfsigned';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const certDir = path.resolve(__dirname, '..', 'certs');
const keyPath = path.join(certDir, 'localhost-key.pem');
const certPath = path.join(certDir, 'localhost-cert.pem');

if (existsSync(keyPath) && existsSync(certPath)) {
  console.log('[gen-cert] certs already exist, skipping');
  process.exit(0);
}

mkdirSync(certDir, { recursive: true });

const pems = await selfsigned.generate(
  [{ name: 'commonName', value: 'localhost' }],
  {
    days: 825,
    keySize: 2048,
    algorithm: 'sha256',
    extensions: [
      { name: 'basicConstraints', cA: true },
      {
        name: 'subjectAltName',
        altNames: [
          { type: 2, value: 'localhost' }, // DNS
          { type: 7, ip: '127.0.0.1' },    // IP
        ],
      },
    ],
  }
);

writeFileSync(keyPath, pems.private);
writeFileSync(certPath, pems.cert);
console.log('[gen-cert] wrote self-signed cert to certs/');
