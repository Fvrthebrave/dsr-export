import express from 'express';
import dotenv from 'dotenv';
import dsrRoutes from './routes/dsr.routes';
import accountRoutes from './routes/account.routes';

dotenv.config();

const app = express();
app.use(express.json());

app.use('/dsr', dsrRoutes);
app.use('/accounts', accountRoutes);

const PORT = 3000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});