import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import healthRouter from './routes/health.js';
import productsRouter from './routes/products.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.use('/health', healthRouter);
app.use('/api/products', productsRouter);

export default app;
