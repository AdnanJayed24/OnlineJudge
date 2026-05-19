import jwt from 'jsonwebtoken';
import { env } from '../config/env';

export function signAccess(payload: object): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, { expiresIn: '15m' });
}

export function signRefresh(payload: object): string {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, { expiresIn: '7d' });
}

export function verifyAccess(token: string): jwt.JwtPayload {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as jwt.JwtPayload;
}

export function verifyRefresh(token: string): jwt.JwtPayload {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as jwt.JwtPayload;
}
