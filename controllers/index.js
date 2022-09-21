import { createClient } from '@typeform/api-client';
import dotenv from 'dotenv';

dotenv.config();

const responsesData = {};
const ratingQuestions = {};

const typeformAPI = createClient({
  token: process.env.TYPEFORM_PERSONAL_TOKEN
});

// Get Forms IDs
const getForms = async () => {
  const forms = await typeformAPI.forms.list();
  return forms.items.reduce((ids, form) => {
    ids.push(form.id);
    return ids;
  }, []);
};

// Get Teams Names from form question.
const getTeamsNames = (form) => {
  const teams = form.fields.find(
    (field) =>
      field.type === 'picture_choice' || field.type === 'multiple_choice'
  );
  return teams.properties.choices.reduce((teams, team) => {
    teams[team.id] = {
      title: team.label,
      image: team?.attachment?.href
    };
    return teams;
  }, {});
};

// Set form rating questions - question id, title and max rating
const setRatingQuestions = (form) => {
  form.fields.forEach((field) => {
    if (field.type === 'rating') {
      ratingQuestions[field.id] = {
        title: field.title,
        maxRating: field.properties.steps
      };
    }
  });
};

// Get form responses and save each response to it's team
const getFormResponses = async (formId) => {
  const responses = await typeformAPI.responses.list({
    uid: formId,
    pageSize: 750
  });

  responses.items.forEach((response) => {
    const teamId = response.answers[0].choice?.id;
    if (teamId) {
      responsesData[formId].teams[teamId].responses =
        responsesData[formId].teams[teamId].responses || [];
      responsesData[formId].teams[teamId].responses.push({
        // return question id and title, rating answer and max rating
        judge: response.hidden?.judge,
        answers: response.answers
          .filter((answer) => answer.field.type === 'rating')
          .map((answer) => ({
            id: answer.field.id,
            title: ratingQuestions[answer.field.id].title,
            rating: answer.number,
            maxRating: ratingQuestions[answer.field.id].maxRating
          }))
      });
    }
  });
};

// Get Details from form ID
const getFormDetails = async (formId) => {
  const form = await typeformAPI.forms.get({ uid: formId });
  responsesData[formId] = {
    title: form.title,
    teams: getTeamsNames(form)
  };

  setRatingQuestions(form);

  await getFormResponses(formId);

  return responsesData[formId];
};

// Return responses data
const getResponsesData = async () => {
  const formsIds = await getForms();
  const responses = await Promise.all(
    formsIds.map((formId) => getFormDetails(formId))
  );
  return responses;
};

export default getResponsesData;
