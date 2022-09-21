import { Router } from 'express';
import {
  getAllFormsResponses,
  getFormResponsesById,
  getFormsIdentifiers
} from '../handlers/index.js';

const router = Router();

router.get('/', async (req, res) => {
  // Get forms identifiers
  const formsIdentifiers = await getFormsIdentifiers();
  res.json({
    data: formsIdentifiers,
    statusCode: 200
  });
});

// Get all forms responses
router.get('/all', async (req, res) => {
  const formsResponses = await getAllFormsResponses();
  res.json({
    data: formsResponses,
    statusCode: 200
  });
});

// Get form responses by id
router.get('/:formId', async (req, res, next) => {
  try {
    const { formId } = req.params;
    const formResponses = await getFormResponsesById(formId);
    res.json({
      data: formResponses,
      statusCode: 200
    });
  } catch (error) {
    res.json({
      statusCode: 404,
      message: 'Form not found'
    });
  }
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
