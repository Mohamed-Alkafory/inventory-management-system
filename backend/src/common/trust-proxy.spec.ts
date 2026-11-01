import express from 'express';
import request from 'supertest';

import { applyTrustProxy } from './trust-proxy.js';

function appWith(hops: number) {
  const app = express();
  applyTrustProxy(app, hops);
  app.get('/ip', (req, res) => {
    res.json({ ip: req.ip });
  });
  return app;
}

describe('applyTrustProxy', () => {
  it('treats 0 (the default) as "do not trust any proxy"', () => {
    const app = express();
    applyTrustProxy(app, 0);

    expect(app.get('trust proxy')).toBe(false);
  });

  it('keeps the socket address when no proxy is trusted', async () => {
    const response = await request(appWith(0))
      .get('/ip')
      .set('X-Forwarded-For', '203.0.113.7');

    expect(response.body.ip).not.toBe('203.0.113.7');
    expect(['127.0.0.1', '::1', '::ffff:127.0.0.1']).toContain(
      response.body.ip,
    );
  });

  it('uses X-Forwarded-For when one proxy hop is trusted', async () => {
    const response = await request(appWith(1))
      .get('/ip')
      .set('X-Forwarded-For', '203.0.113.7');

    expect(response.body.ip).toBe('203.0.113.7');
  });

  it('skips trusted hops and returns the client address with two hops', async () => {
    const response = await request(appWith(2))
      .get('/ip')
      .set('X-Forwarded-For', '203.0.113.7, 10.0.0.1');

    expect(response.body.ip).toBe('203.0.113.7');
  });
});
