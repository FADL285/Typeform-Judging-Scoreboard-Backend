import { Router } from 'express';
import {
  getAllFormsResponses,
  getFormResponsesById,
  getFormsIdentifiers
} from '../handlers/index.js';

const router = Router();

router.get('/', async (req, res, next) => {
  // Get forms identifiers
  try {
    const formsIdentifiers = await getFormsIdentifiers();
    res.json({
      data: formsIdentifiers,
      statusCode: 200
    });
  } catch (error) {
    next(error);
  }
});

// Get all forms responses
router.get('/all', async (req, res, next) => {
  try {
    const formsResponses = await getAllFormsResponses();
    res.json({
      data: formsResponses,
      statusCode: 200
    });
  } catch (error) {
    next(error);
  }
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

export default router;
