import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const hash = await bcrypt.hash('admin123', 12);
  const user = await prisma.user.upsert({
    where:  { email: 'admin@oj.dev' },
    update: { role: 'admin' },
    create: { email: 'admin@oj.dev', username: 'admin', passwordHash: hash, role: 'admin' },
  });
  console.log('Admin ready:', user.email, '| role:', user.role);
  await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
