import type { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import type { Role } from '@prisma/client';
import { env } from '../config/env.js';
import { forbidden, unauthorized } from '../lib/errors.js';

export interface AuthUser {
  id: string;
  email: string;
  role: Role;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export const AUTH_COOKIE = 'dd_token';

export function signToken(user: AuthUser): string {
  return jwt.sign({ sub: user.id, email: user.email, role: user.role }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
}

function readToken(req: Parameters<RequestHandler>[0]): string | undefined {
  const cookie = req.cookies?.[AUTH_COOKIE] as string | undefined;
  if (cookie) return cookie;
  const header = req.headers.authorization;
  return header?.startsWith('Bearer ') ? header.slice(7) : undefined;
}

/** Populates req.user when a valid token is present; never rejects. */
export const optionalAuth: RequestHandler = (req, _res, next) => {
  const token = readToken(req);
  if (token) {
    try {
      const payload = jwt.verify(token, env.JWT_SECRET) as jwt.JwtPayload;
      req.user = { id: payload.sub!, email: payload.email, role: payload.role };
    } catch {
      /* expired or tampered token: treat as anonymous */
    }
  }
  next();
};

export const requireAuth: RequestHandler = (req, res, next) => {
  optionalAuth(req, res, () => (req.user ? next() : next(unauthorized())));
};

export const requireAdmin: RequestHandler = (req, res, next) => {
  requireAuth(req, res, (err?: unknown) => {
    if (err) return next(err);
    return req.user!.role === 'ADMIN' ? next() : next(forbidden('Admin access required'));
  });
};

/** Machine-to-machine auth for n8n callbacks, via a shared `x-api-key` header. */
export const requireServiceKey: RequestHandler = (req, _res, next) => {
  const provided = req.header('x-api-key') ?? '';
  const expected = env.N8N_API_KEY;
  if (
    expected &&
    provided.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected))
  ) {
    return next();
  }
  return next(unauthorized('Invalid service key'));
};
