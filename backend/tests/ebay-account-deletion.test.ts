import Fastify from 'fastify';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { accountDeletionRoutes } from '../src/modules/ebay/account-deletion-routes.js';
import { VerificationTokenSchema } from '../src/modules/ebay/account-deletion.js';

const database = vi.hoisted(() => ({ query: vi.fn(), getClient: vi.fn() }));
vi.mock('../src/config/database.js', () => database);
const token = 'test_verification_token_not_a_secret_1234';
const message = {
  metadata: { topic: 'MARKETPLACE_ACCOUNT_DELETION', schemaVersion: '1.0', deprecated: false },
  notification: { notificationId: 'test-event', eventDate: '2026-01-01T00:00:00Z',
    publishDate: '2026-01-01T00:00:01Z', publishAttemptCount: 1,
    data: { username: 'test-account-marker', userId: 'test-user-marker', eiasToken: 'test-eias-marker' } },
};
const apps: ReturnType<typeof Fastify>[] = [];
async function appFor(verificationToken: string | undefined = token, logOutcome = vi.fn()) {
  const app = Fastify(); apps.push(app);
  app.post('/ordinary', request => request.body);
  await app.register(accountDeletionRoutes, { prefix: '/api', verificationToken, logOutcome });
  return { app, logOutcome };
}
afterEach(async () => { await Promise.all(apps.splice(0).map(app => app.close())); vi.clearAllMocks(); });
const path = '/api/ebay/account-deletion';

describe('account deletion routes', () => {
  it('returns the exact challenge digest using configured endpoint, ignoring Host headers', async () => {
    const { app } = await appFor();
    const result = await app.inject({ url: `${path}?challenge_code=123`, headers: { host: 'attacker.invalid', 'x-forwarded-host': 'attacker.invalid' } });
    expect(result.statusCode).toBe(200);
    expect(result.headers['content-type']).toContain('application/json');
    // Independently calculated with Python hashlib; fixed fixture catches ordering/URL mistakes.
    expect(result.json()).toEqual({ challengeResponse: '219c4a0961e7279bf0f36d8d23a742cc1c78dd1398553cf00deb6281fbd3e453' });
  });
  it.each(['', '?challenge_code=', '?challenge_code=%20', '?challenge_code=a&challenge_code=b'])('rejects invalid challenge %s', async query => {
    const { app } = await appFor();
    expect((await app.inject(`${path}${query}`)).statusCode).toBe(400);
  });
  it.each(['short', 'x'.repeat(81), 'x'.repeat(31) + '!'])('rejects invalid token constraints', verificationToken => {
    expect(VerificationTokenSchema.safeParse(verificationToken).success).toBe(false);
  });
  it('acknowledges repeated notifications without DB access or account logging', async () => {
    const { app, logOutcome } = await appFor();
    for (let i = 0; i < 2; i++) {
      const result = await app.inject({ method: 'POST', url: path, payload: message });
      expect(result.statusCode).toBe(204); expect(result.body).toBe('');
    }
    expect(database.query).not.toHaveBeenCalled(); expect(database.getClient).not.toHaveBeenCalled();
    expect(logOutcome.mock.calls).toEqual([['no_associated_account_data_stored'], ['no_associated_account_data_stored']]);
  });
  it.each([{}, { ...message, metadata: { ...message.metadata, topic: 'OTHER' } }])('rejects malformed envelope/wrong topic', async payload => {
    const { app } = await appFor();
    expect((await app.inject({ method: 'POST', url: path, payload })).statusCode).toBe(400);
  });
  it('rejects malformed JSON and oversized bodies with sanitized errors', async () => {
    const { app } = await appFor();
    for (const [payload, status] of [['{"test-account-marker":', 400], [JSON.stringify({ ...message, padding: 'x'.repeat(65536) }), 413]] as const) {
      const result = await app.inject({ method: 'POST', url: path, payload, headers: { 'content-type': 'application/json' } });
      expect(result.statusCode).toBe(status); expect(result.body).not.toContain('test-account-marker');
    }
  });
  it('returns 503 without token configuration and keeps application startup working', async () => {
    const { app } = await appFor('');
    for (const request of [{ url: `${path}?challenge_code=123` }, { method: 'POST' as const, url: path, payload: message }]) {
      const result = await app.inject(request);
      expect(result.statusCode).toBe(503);
      expect(result.body).not.toContain(token);
    }
    expect((await app.inject({ method: 'POST', url: '/ordinary', payload: { ok: true } })).statusCode).toBe(200);
  });
  it('does not require signature/authentication for receipt-only acknowledgement', async () => {
    const { app } = await appFor();
    const result = await app.inject({ method: 'POST', url: path, payload: message,
      headers: { 'x-ebay-signature': 'not-authenticated' } });
    expect(result.statusCode).toBe(204);
  });
  it('keeps existing JSON routes and errors unaffected', async () => {
    const { app } = await appFor();
    expect((await app.inject({ method: 'POST', url: '/ordinary', payload: { ordinary: true } })).json()).toEqual({ ordinary: true });
    expect((await app.inject('/does-not-exist')).statusCode).toBe(404);
  });
});
