"use strict";

/** Routes for jobs */

const jsonschema = require("jsonschema");
const express = require("express");

const { BadRequestError } = require("../expressError");
const { isAdmin } = require("../middleware/auth");
const Job = require("../models/job");

const jobNewSchema = require("../schemas/jobNew.json");
const jobUpdateSchema = require("../schemas/jobUpdate.json");

const router = new express.Router();


/** POST / { job } =>  { job }
 *
 * job should be { title, salary, equity, company_handle }
 *
 * Returns { title, salary, equity, company_handle }
 *
 * Authorization required: isAdmin
 */

router.post("/", isAdmin, async function (req, res, next) {
  try {
    const validator = jsonschema.validate(req.body, jobNewSchema);
    if (!validator.valid) {
      const errs = validator.errors.map(e => e.stack);
      console.log("ERRORS", errs);
      throw new BadRequestError(errs);
    }
    const job = await Job.create(req.body);
    return res.status(201).json({ job });
  } catch (err) {
    return next(err);
  }
});

/** GET /  =>
 *   { jobs: [ { title, salary, equity, company_handle }, ...] }
 *
 * Can filter on provided search filters:
 * - title
 * - minSalary
 * - hasEquity
 *
 * Authorization required: none
 */

router.get("/", async function (req, res, next) {
  const allFields = req.query;
  let title;
  let minSalary;
  let hasEquity;
  try {
    if (allFields) {
      let filteredFields = {};
      Object.keys(allFields).filter((key) => {
        if (['title', 'minSalary', 'hasEquity'].includes(key)) {
          filteredFields[key] = allFields[key];
        }
      });

      if (Object.keys(filteredFields).length > 0) {
        if (filteredFields['title']) {
          title = `%${filteredFields['title']}%`;
        }
        if (filteredFields['minSalary']) {
          minSalary = filteredFields['minSalary'];
        }
        if (filteredFields['hasEquity']) {
          hasEquity = filteredFields['hasEquity'];
        }
      }
    }

    const jobs = await Job.findAll({title, minSalary, hasEquity});
    return res.json({ jobs });
  } catch (err) {
    return next(err);
  }
});

/** GET /[title]  =>  { job }
 *
 * { jobs: [ { title, salary, equity, company_handle }, ...] }
 *
 * Authorization required: none
 */

router.get("/:title", async function (req, res, next) {
  try {
    const jobs = await Job.get(req.params.title);
    return res.json({ jobs });
  } catch (err) {
    return next(err);
  }
});

/** PATCH /[title, companyHandle] { fld1, fld2, ... } => { job }
 *
 * Patches job data.
 *
 * fields can be: { title, salary, equity }
 *
 * Returns { title, salary, equity, companyHandle }
 *
 * Authorization required: isAdmin
 */

router.patch("/:title/:companyHandle", isAdmin, async function (req, res, next) {
  try {
    const validator = jsonschema.validate(req.body, jobUpdateSchema);
    if (!validator.valid) {
      const errs = validator.errors.map(e => e.stack);
      throw new BadRequestError(errs);
    }

    const job = await Job.update(req.params.title, req.params.companyHandle, req.body);
    return res.json({ job });
  } catch (err) {
    return next(err);
  }
});

/** DELETE /[title, companyHandle]  =>  {deleted: title at companyHandle}
 *
 * Authorization: isAdmin
 */

router.delete("/:title/:companyHandle", isAdmin, async function (req, res, next) {
  try {
    await Job.remove(req.params.title, req.params.companyHandle);
    return res.json({ deleted: req.params.title + " at " + req.params.companyHandle });
  } catch (err) {
    return next(err);
  }
});


module.exports = router;
