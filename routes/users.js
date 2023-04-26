"use strict";

/** Routes for users. */

const jsonschema = require("jsonschema");

const express = require("express");
const { isAdmin, userOrAdmin, ensureLoggedIn } = require("../middleware/auth");
const { BadRequestError } = require("../expressError");
const User = require("../models/user");
const { createToken } = require("../helpers/tokens");
const userNewSchema = require("../schemas/userNew.json");
const userUpdateSchema = require("../schemas/userUpdate.json");
const userSetPassword = require("../schemas/userSetPassword.json");
const makePassword = require('generate-password');

const router = express.Router();


/** POST / { user }  => { user, token }
 *
 * Adds a new user. This is not the registration endpoint --- instead, this is
 * only for admin users to add new users. The new user being added can be an
 * admin.
 *
 * This returns the newly created user and an authentication token for them.
 * However, the user will be forced to set their own password once accessing
 * the API for the first time.
 *  {user: { username, firstName, lastName, email, isAdmin }, token }
 *
 * Authorization required: isAdmin
 **/

router.post("/", isAdmin, async function (req, res, next) {
  try {
    const validator = jsonschema.validate(req.body, userNewSchema);
    if (!validator.valid) {
      const errs = validator.errors.map(e => e.stack);
      throw new BadRequestError(errs);
    }

    const password = makePassword.generate({
      length: 15,
      numbers: true
    });

    req.body.password = password;
    const user = await User.register(req.body);
    const token = createToken(user);
    return res.status(201).json({ user, token });
  } catch (err) {
    return next(err);
  }
});

/** POST /:username/password => { token }
 * 
 * Allow user to set their own password if their account was originally created by
 * an admin.
 */

router.patch('/:username/password', ensureLoggedIn, async function(req, res, next) {
  try {
    const validator = jsonschema.validate(req.body, userSetPassword);
    if (!validator.valid) {
      const errs = validator.errors.map(e => e.stack);
      throw new BadRequestError(errs);
    }
    const user = await User.setPassword(req.params.username, req.body.password);
    const token = createToken(user);
    return res.json({ token });
  } catch (err) {
    return next(err);
  }
});

/** POST /:username/jobs/:id  => { applied: id }
 *
 * Creates a new entry in the applications table for the passed user and passed job id. 
 *
 * This returns confirmation that the job was applied for along with the job id.
 *  {applied: { jobId: id }
 *
 * Authorization required: is requesting user (i.e. is :username) or is admin
 **/

router.post('/:username/jobs/:id', userOrAdmin, async function(req, res, next) {
  try {
     const application = await User.applyForJob(req.params.username, req.params.id)
     return res.status(201).json({applied: application.jobId});
  } catch (err) {
    return next(err);
  }
});


/** GET / => { users: [ {username, firstName, lastName, email, jobs: [jobId, jobId...] } ...] }
 *
 * Returns list of all users and list of any jobs (jobIds) they have applied for.
 *
 * Authorization required: login
 **/

router.get("/", ensureLoggedIn, async function (req, res, next) {
  try {
    const users = await User.findAll();
    return res.json({ users });
  } catch (err) {
    return next(err);
  }
});


/** GET /[username] => { user }
 *
 * Returns { username, firstName, lastName, isAdmin }
 *
 * Authorization required: is user or isAdmin
 **/

router.get("/:username", userOrAdmin, async function (req, res, next) {
  try {
    const user = await User.get(req.params.username);
    return res.json({ user });
  } catch (err) {
    return next(err);
  }
});


/** PATCH /[username] { user } => { user }
 *
 * Data can include:
 *   { firstName, lastName, password, email }
 *
 * Returns { username, firstName, lastName, email, isAdmin }
 *
 * Authorization required: is user or isAdmin
 **/

router.patch("/:username", userOrAdmin, async function (req, res, next) {
  try {
    const validator = jsonschema.validate(req.body, userUpdateSchema);
    if (!validator.valid) {
      const errs = validator.errors.map(e => e.stack);
      throw new BadRequestError(errs);
    }

    const user = await User.update(req.params.username, req.body);
    return res.json({ user });
  } catch (err) {
    return next(err);
  }
});


/** DELETE /[username]  =>  { deleted: username }
 *
 * Authorization required: is user or isAdmin
 **/

router.delete("/:username", userOrAdmin, async function (req, res, next) {
  try {
    await User.remove(req.params.username);
    return res.json({ deleted: req.params.username });
  } catch (err) {
    return next(err);
  }
});


module.exports = router;
