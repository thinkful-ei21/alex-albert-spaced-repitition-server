'use strict';

const express = require('express');
const router = express.Router();

const User = require('../models/user.js');
const Questions = require('../models/question.js');

/* ========== POST/CREATE A USER ========== */
router.post('/', (req, res, next) => {
  const { firstName, lastName, username, password } = req.body;
  let questions = [];

  // verify required fields exist
  const requiredFields = ['firstName', 'lastName', 'username', 'password'];
  const missingField = requiredFields.find(field => !(field in req.body));

  if (missingField) {
    return res.status(422).json({
      code: 422,
      reason: 'ValidationError',
      message: 'Missing field',
      location: missingField
    });
  }

  // verify field data type
  const stringFields = ['firstName', 'lastName', 'username', 'password'];
  const nonStringField = stringFields.find(field => field in req.body && typeof req.body[field] !== 'string');

  if (nonStringField) {
    return res.status(422).json({
      code: 422,
      reason: 'ValidationError',
      message: 'Incorrect field type: expected string',
      location: nonStringField
    });
  }

  // verify all fields have no whitespace
  const trimmedFields = ['firstName', 'lastName', 'username', 'password'];
  const nonTrimmedField = trimmedFields.find(field => req.body[field].trim() !== req.body[field]);

  if (nonTrimmedField) {
    return res.status(422).json({
      code: 422,
      reason: 'ValidationError',
      message: 'Cannot start or end with whitespace',
      location: nonTrimmedField
    });
  }

  // verify field lengths
  const sizedFields = {
    username: {
      min: 6
    },
    password: {
      min: 10,
      max: 72
    }
  };
  const tooSmallField = Object.keys(sizedFields).find(
    field => 'min' in sizedFields[field] && req.body[field].trim().length < sizedFields[field].min
  );
  const tooLargeField = Object.keys(sizedFields).find(
    field => 'max' in sizedFields[field] && req.body[field].trim().length > sizedFields[field].max
  );

  if (tooSmallField || tooLargeField) {
    return res.status(422).json({
      code: 422,
      reason: 'ValidationError',
      message: tooSmallField
        ? `Must be at least ${sizedFields[tooSmallField]
          .min} characters long`
        : `Must be at most ${sizedFields[tooLargeField]
          .max} characters long`,
      location: tooSmallField || tooLargeField
    });
  }

  // all validations passed, hash password and create user
  return Questions
    .find()
    .then(results => {
      questions = results.map((question, index) => {
        // delete question.name;
        return {
          question,
          memoryStrength: 1,
          attempts: 0,
          passed: 0,
          next: index === results.length - 1 ? null : index + 1
        };
      });
    })
    .then(() => User.find({username}).count())
    .then(count => {
      if (count > 0) {
        // There is an existing user with the same username
        return Promise.reject({
          code: 422,
          reason: 'ValidationError',
          message: 'Username already taken',
          location: 'username'
        });
      }
      return User.hashPassword(password);
    })
    .then(digest => {
      const newUser = {
        firstName,
        lastName,
        username,
        password: digest,
        questions
      };
      return User.create(newUser);
    })
    .then(user => res.status(201).location(`/api/users/${user.id}`).json(user))
    .catch(err => {
      // Forward validation errors on to the client, otherwise give a 500
      // error because something unexpected has happened
      if (err.reason === 'ValidationError') {
        return res.status(err.code).json(err);
      }
      console.log(err);
      res.status(500).json({code: 500, message: 'Internal server error'});
    });
});

module.exports = router;
