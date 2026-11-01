import 'dotenv/config';
import { createAuth } from './auth.js';
import { trustedProxies } from './proxy-config.js';
import express from 'express';
import cors from 'cors';
import routes from './routes/index.js';
import { validateTypeformConfig } from './handlers/index.js';
validateTypeformConfig(process.env);

const PORT = process.env.PORT || 3000;

const app = express();
app.set('trust proxy', trustedProxies(process.env.SCOREBOARD_TRUST_PROXY));

// Welcome Response
app.get('/', (req, res) => {
  res.json({
    message:
      'Welcome to Typeform Judging Board System API, Created by Mohamed Fadl <Mohamed.Fadl2852@gmail.com>',
    statusCode: 200
  });
});

app.use(cors());
app.use(express.json({ limit: '4kb' }));
const auth = createAuth({
  username: process.env.SCOREBOARD_USER,
  password: process.env.SCOREBOARD_PASSWORD,
  secret: process.env.SCOREBOARD_SESSION_SECRET,
});
app.post('/api/auth', auth.login);
app.use('/api', auth.requireAuth);
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
