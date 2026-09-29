import { Router, type CookieOptions, type Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import type { User } from '@prisma/client';
import { env } from '../../config/env.js';
import { prisma } from '../../lib/prisma.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { badRequest, conflict, unauthorized } from '../../lib/errors.js';
import { validate } from '../../middleware/validate.js';
import { authLimiter } from '../../middleware/rateLimit.js';
import { AUTH_COOKIE, optionalAuth, signToken } from '../../middleware/auth.js';
import { audit, notify, publishEvent } from '../../services/events.js';
import { forgotPasswordSchema, loginSchema, registerSchema, resetPasswordSchema } from './auth.schemas.js';

const router = Router();

const BCRYPT_ROUNDS = 12;
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;
const DUMMY_HASH = bcrypt.hashSync('timing-equaliser', BCRYPT_ROUNDS);
const cookieOptions: CookieOptions = {
  httpOnly: true,
  secure: env.cookieSecure,
  sameSite: 'lax',
  path: '/',
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

export const publicUser = (u: Pick<User, 'id' | 'email' | 'name' | 'role' | 'createdAt'>) => ({
  id: u.id,
  email: u.email,
  name: u.name,
  role: u.role,
  createdAt: u.createdAt,
});

function startSession(res: Response, user: User) {
  res.cookie(AUTH_COOKIE, signToken({ id: user.id, email: user.email, role: user.role }), cookieOptions);
}

const hashToken = (token: string) => crypto.createHash('sha256').update(token).digest('hex');

router.post(
  '/register',
  authLimiter,
  validate({ body: registerSchema }),
  asyncHandler(async (req, res) => {
    const { name, email, password } = req.body;
    if (await prisma.user.findUnique({ where: { email } })) {
      throw conflict('An account with this email already exists');
    }
    const user = await prisma.user.create({
      data: { name, email, passwordHash: await bcrypt.hash(password, BCRYPT_ROUNDS) },
    });
    startSession(res, user);
    await Promise.all([
      notify(user.id, 'WELCOME', `Welcome to DesiDrapes, ${user.name}!`),
      audit('auth.register', { userId: user.id, entity: 'User', entityId: user.id }),
    ]);
    publishEvent('user.registered', { userId: user.id, name: user.name, email: user.email });
    res.status(201).json({ user: publicUser(user) });
  }),
);

router.post(
  '/login',
  authLimiter,
  validate({ body: loginSchema }),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    // Compare even when the user is missing so response timing doesn't reveal which emails exist.
    const valid = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !valid) {
      await audit('auth.login_failed', { metadata: { email } });
      throw unauthorized('Invalid email or password');
    }
    startSession(res, user);
    await audit('auth.login', { userId: user.id, entity: 'User', entityId: user.id });
    res.json({ user: publicUser(user) });
  }),
);

router.post('/logout', optionalAuth, (req, res) => {
  res.clearCookie(AUTH_COOKIE, { ...cookieOptions, maxAge: undefined });
  if (req.user) void audit('auth.logout', { userId: req.user.id });
  res.status(204).end();
});

router.get(
  '/me',
  optionalAuth,
  asyncHandler(async (req, res) => {
    if (!req.user) return res.json({ user: null });
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    res.json({ user: user ? publicUser(user) : null });
  }),
);

router.post(
  '/forgot-password',
  authLimiter,
  validate({ body: forgotPasswordSchema }),
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({ where: { email: req.body.email } });
    if (user) {
      const token = crypto.randomBytes(32).toString('hex');
      await prisma.passwordResetToken.create({
        data: { userId: user.id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS) },
      });
      const resetUrl = `${env.FRONTEND_URL}/reset-password?token=${token}`;
      publishEvent('password.reset_requested', { name: user.name, email: user.email, resetUrl, expiresInMinutes: 60 });
      await audit('auth.password_reset_requested', { userId: user.id });
    }
    // Same response either way so this endpoint can't be used to probe for accounts.
    res.json({ message: 'If an account exists for that email, a reset link has been sent.' });
  }),
);

router.post(
  '/reset-password',
  authLimiter,
  validate({ body: resetPasswordSchema }),
  asyncHandler(async (req, res) => {
    const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash: hashToken(req.body.token) } });
    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw badRequest('This reset link is invalid or has expired');
    }
    await prisma.$transaction([
      prisma.user.update({
        where: { id: record.userId },
        data: { passwordHash: await bcrypt.hash(req.body.password, BCRYPT_ROUNDS) },
      }),
      prisma.passwordResetToken.updateMany({ where: { userId: record.userId, usedAt: null }, data: { usedAt: new Date() } }),
    ]);
    await Promise.all([
      notify(record.userId, 'PASSWORD_RESET', 'Your password was changed.'),
      audit('auth.password_reset', { userId: record.userId }),
    ]);
    res.json({ message: 'Password updated. You can now log in.' });
  }),
);

export default router;
