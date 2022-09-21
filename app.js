import express from 'express';
import cors from 'cors';
import routes from './routes/index.js';

const PORT = process.env.PORT || 3000;

const app = express();

// Welcome Response
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to IEEE Vectors Contest API',
    statusCode: 200
  });
});

app.use(cors());
app.use(express.json());
app.use('/api', routes);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
