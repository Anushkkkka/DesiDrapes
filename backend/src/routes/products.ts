import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

router.get('/', async (_req, res) => {
  try {
    const products = await prisma.product.findMany({
      include: { category: true, inventory: true }
    });

    res.json({ products });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to load products' });
  }
});

export default router;
