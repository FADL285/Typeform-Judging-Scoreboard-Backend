import { createClient } from '@typeform/api-client';
import dotenv from 'dotenv';

dotenv.config();

const responsesData = {};
const formsIdentifiers = {};
let ratingQuestions = [];

const typeformAPI = createClient({
  token: process.env.TYPEFORM_PERSONAL_TOKEN
});

// Get Forms IDs from forms Identifiers if exist, else get from typeform
const getForms = async () => {
  if (Object.keys(formsIdentifiers).length === 0) {
    const forms = await typeformAPI.forms.list();
    forms.items.forEach((form) => {
      formsIdentifiers[form.id] = form.title;
    });
  }
  return Object.keys(formsIdentifiers);
};

// Get Teams Names from form question.
const getTeamsNames = (form) => {
  const teams = form.fields.find(
    (field) =>
      field.type === 'picture_choice' || field.type === 'multiple_choice'
  );
  return teams.properties.choices.reduce((teams, team) => {
    teams.push({
      id: team.id,
      title: team.label
    });
    return teams;
  }, []);
};

// Set form rating questions - question id, title and max rating
const setRatingQuestions = (form) => {
  ratingQuestions = [];

  // Get all Groups fields and loop on it
  const groups = form.fields.filter((field) => field.type === 'group');
  groups.forEach((group) => {
    // Get all rating fields and loop on it
    const ratings = group.properties.fields.filter(
      (field) => field.type === 'rating'
    );
    ratings.forEach((rating) => {
      ratingQuestions.push({
        id: rating.id,
        title: rating.title,
        max: rating?.properties?.steps
      });
    });
  });

  return ratingQuestions;
};

// Get form responses and save each response to it's team
const getFormResponses = async (formId) => {
  const responses = await typeformAPI.responses.list({
    uid: formId,
    pageSize: 750
  });

  responses.items.forEach((response) => {
    const teamId = response.answers.find((answer) => answer.type === 'choice')
      ?.choice?.id;
    if (teamId) {
      const team = responsesData[formId].teams.find(
        (team) => team.id === teamId
      );
      team.responses = team.responses || [];
      team.responses.push({
        // return question id and title, rating answer and max rating
        judge: response.hidden?.judge,
        answers: response.answers
          .filter((answer) => answer.field.type === 'rating')
          .map((answer) => ({
            id: answer.field.id,
            rating: answer.number
          }))
      });
    }
  });
};

// Get Details from form ID
const getFormDetails = async (formId) => {
  const form = await typeformAPI.forms.get({ uid: formId });
  // handle form not found
  responsesData[formId] = {
    id: formId,
    title: form.title,
    teams: getTeamsNames(form),
    ratingQuestions: setRatingQuestions(form),
    variables: form.variables
  };

  setRatingQuestions(form);

  await getFormResponses(formId);

  return responsesData[formId];
};

const getFormPref = async (formId) => {
  const form = await typeformAPI.forms.get({ uid: formId });
  // handle form not found
  responsesData[formId] = {
    id: formId,
    title: form.title,
    teams: getTeamsNames(form),
    variables: form.variables
  };

  return responsesData[formId];
};

// Return All responses data
const getAllFormsDetails = async () => {
  const formsIds = await getForms();
  const responses = await Promise.all(
    formsIds.map((formId) => getFormPref(formId))
  );
  return responses;
};

// Get All Responses for specific form
const getFormResponsesById = async (formId) => {
  const form = await getFormDetails(formId);
  return form;
};

export { getAllFormsDetails, getFormResponsesById, getFormPref };
