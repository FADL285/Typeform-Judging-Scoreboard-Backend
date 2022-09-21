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

// 404 Page Not Found
app.use((req, res) =>
  res.status(404).json({
    message: 'Oops! You are lost, Go to home page 🌏',
    statusCode: 404
  })
);

// 500 Internal Server Error
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    message: 'Oops! Something went wrong, Try again later',
    statusCode: 500
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
