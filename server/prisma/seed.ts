import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Seeding database...');

  const user = await prisma.user.upsert({
    where: { email: 'guilherme@localhost' },
    update: {},
    create: {
      email: 'guilherme@localhost',
      stravaAccount: {
        create: {
          stravaAthleteId: 105494700n,
          // tokens will be filled after - OAuth
          accessToken: '',
          refreshToken: '',
          expiresAt: new Date(0),
        },
      },
    },
  });

  console.log(`User created: ${user.id} (${user.email})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });