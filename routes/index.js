import { Router } from 'express';
import { getAllFormsDetails, getFormResponsesById } from '../handlers/index.js';

const router = Router();

router.get('/', async (req, res, next) => {
  // Get forms identifiers
  try {
    const formsIdentifiers = await getAllFormsDetails();
    res.json({
      data: formsIdentifiers,
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
    console.log(error.stack);
    res.status(404).json({
      message: 'Form not found :(',
      statusCode: 404
    });
  }
});

export default router;
