import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

type Role = 'funcionario' | 'admin';

export interface AuthUser {
  id: string;
  email: string;
  nome?: string;
  role: Role;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

const JWT_SECRET = process.env['JWT_SECRET'] || 'change-me';
const prisma = new PrismaClient();

export function signToken(user: AuthUser): string {
  return jwt.sign(user, JWT_SECRET, { expiresIn: '12h' });
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  // Prioriza cookie httpOnly "authToken"; mantém fallback para Authorization: Bearer
  const cookieToken = (req as any).cookies?.['authToken'];
  const header = req.get('Authorization');
  const headerToken = header && header.startsWith('Bearer ') ? header.slice('Bearer '.length) : undefined;
  const token = cookieToken || headerToken;
  if (!token) {
    res.status(401).json({ success: false, error: 'Não autenticado' });
    return;
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET) as AuthUser;
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ success: false, error: 'Token inválido ou expirado' });
  }
}

export function requireRole(role: Role) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Não autenticado' });
      return;
    }
    if (req.user.role !== role) {
      res.status(403).json({ success: false, error: 'Sem permissão' });
      return;
    }
    next();
  };
}

// Utilitário simples para validar credenciais via env
export async function validateCredentials(email: string, password: string): Promise<AuthUser | null> {
  // 1) Tenta autenticar via banco
  try {
    const dbUser = await prisma.user.findUnique({ where: { email } });
    if (dbUser) {
      const ok = await bcrypt.compare(password, dbUser.passwordHash);
      if (!ok) return null;
      const authUser: AuthUser = {
        id: dbUser.id,
        email: dbUser.email,
        role: dbUser.role as Role,
      };
      if (dbUser.name) authUser.nome = dbUser.name;
      return authUser;
    }
  } catch (e) {
    // falha silenciosa; tenta fallback
  }

  // 2) Fallback: credenciais via variáveis de ambiente
  const adminEmail = process.env['ADMIN_EMAIL'];
  const adminPassword = process.env['ADMIN_PASSWORD'];
  const adminHash = process.env['ADMIN_PASSWORD_HASH']; // opcional: bcrypt hash
  const adminName = process.env['ADMIN_NAME'] || 'Admin Câmara';

  if (!adminEmail || email !== adminEmail) return null;
  if (adminHash) {
    const ok = await bcrypt.compare(password, adminHash);
    if (!ok) return null;
  } else {
    if (!adminPassword || password !== adminPassword) return null;
  }

  return { id: 'admin', email: adminEmail, nome: adminName, role: 'admin' };
}