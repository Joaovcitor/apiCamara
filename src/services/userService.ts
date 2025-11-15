import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

export type CreateUserParams = {
  email: string;
  name?: string;
  role?: Role;
  password: string;
};

export type UpdateUserParams = {
  email?: string;
  name?: string;
  role?: Role;
  password?: string;
};

export class UserService {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
  }

  private toSafe(user: any) {
    if (!user) return null;
    const { passwordHash, ...rest } = user;
    return rest;
  }

  async listUsers(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count(),
    ]);
    return {
      items: items.map((u: any) => this.toSafe(u)),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getUserById(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    return this.toSafe(user);
  }

  async getUserByEmail(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    return user; // retorna com hash para validação de senha
  }

  async createUser(params: CreateUserParams) {
    const exists = await this.prisma.user.findUnique({ where: { email: params.email } });
    if (exists) throw new Error('Email já está em uso');
    const passwordHash = await bcrypt.hash(params.password, 10);
    const user = await this.prisma.user.create({
      data: {
        email: params.email,
        name: params.name || null,
        role: params.role || 'funcionario',
        passwordHash,
      },
    });
    return this.toSafe(user);
  }

  async updateUser(id: string, params: UpdateUserParams) {
    let passwordHash: string | undefined;
    if (typeof params.password === 'string') {
      passwordHash = await bcrypt.hash(params.password, 10);
    }

    const data: any = {};
    if (typeof params.email === 'string') data.email = params.email;
    if (typeof params.name === 'string' || params.name === null) data.name = params.name ?? null;
    if (typeof params.role !== 'undefined') data.role = params.role;
    if (typeof passwordHash !== 'undefined') data.passwordHash = passwordHash;

    const user = await this.prisma.user.update({
      where: { id },
      data,
    });
    return this.toSafe(user);
  }

  async deleteUser(id: string) {
    await this.prisma.user.delete({ where: { id } });
    return true;
  }
}