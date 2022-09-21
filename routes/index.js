import { Router } from 'express';
import getResponse from '../controllers/index.js';

const router = Router();

router.get('/', async (req, res) => {
  const response = await getResponse();
  res.send(response);
});

// 404 Page Not Found
router.use((req, res) =>
  res.status(404).json({
    message: 'Oops! You are lost, Go to home page 🌏',
    statusCode: 404
  })
);

// 500 Internal Server Error
router.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    message: 'Oops! Something went wrong, Try again later',
    statusCode: 500
  });
});

export default router;
