"use strict";

const db = require("../db");
const { BadRequestError, NotFoundError } = require("../expressError");
const { sqlForPartialUpdate, jobWriteWhere } = require("../helpers/sql");

/** Related functions for companies. */

class Job {
  /** Create a job (from data), update db, return new job data.
   *
   * data should be { title, salary, equity, companyHandle }
   *
   * Returns { title, salary, equity, companyHandle }
   *
   * Throws BadRequestError if record with combo of title and companyHandle is already in db.
   * */

  static async create({ title, salary, equity, companyHandle }) {
    const duplicateCheck = await db.query(
          `SELECT title, company_handle
           FROM jobs
           WHERE title=$1 AND company_handle=$2`,
        [title, companyHandle]);

    if (duplicateCheck.rows[0]) {
      throw new BadRequestError(`Duplicate job listing: ${title} at ${companyHandle}`);
    }

    const result = await db.query(
          `INSERT INTO jobs
           (title, salary, equity, company_handle)
           VALUES ($1, $2, $3, $4)
           RETURNING title, salary, equity, company_handle AS "companyHandle"`,
        [
          title,
          salary || null,
          equity || null,
          companyHandle
        ]
    );
    return result.rows[0];
  }

  /** Find all jobs.
   *
   * can filter on title, minSalary, hasEquity
   * e.g. http://localhost:3001/?title=plumber&minSalary=1000
   * Returns [{ title, salary, equity, companyHandle }, ...]
   * */

  static async findAll(fields) {
    const where = jobWriteWhere(fields);
    console.log('where value', where);
    let jobsRes;
    if (where !== null) {
      jobsRes = await db.query(
            `SELECT title,
                    salary,
                    equity,
                    company_handle AS "companyHandle"
            FROM jobs
            ${where.where}
            ORDER BY title, company_handle`, where.values);
      } else {
      jobsRes = await db.query(
            `SELECT title,
                salary,
                equity,
                company_handle AS "companyHandle"
        FROM jobs
        ORDER BY title, company_handle`);
      }
    return jobsRes.rows;
  }

  /** Given a job title, return data about jobs with that title at any/all companies.
   *
   * Returns [{ title, salary, equity, companyHandle }, ...]
   *
   * Throws NotFoundError if not found.
   **/

  static async get(title) {
    const jobsRes = await db.query(
          `SELECT title,
                  salary,
                  equity,
                  company_handle AS "companyHandle"
           FROM jobs
           WHERE title = $1`,
        [title]);

    const jobs = jobsRes.rows;

    if (!jobs[0]) throw new NotFoundError(`No jobs by that title: ${title}`);

    return jobs;
  }

  /** Update job data with `data`.
   *
   * This is a "partial update" --- it's fine if data doesn't contain all the
   * fields; this only changes provided ones.
   *
   * Data can include: {title, salary, equity}
   *
   * Returns {title, salary, equity, companyHandle}
   * Throws NotFoundError if not found.
   */

  static async update(title, companyHandle, data) {
    const { setCols, values } = sqlForPartialUpdate(
        data,
        {
          companyHandle: "company_handle"
        });
    const handleTitleIdx = "$" + (values.length + 1);
    const handleCompIdx = "$" + (values.length + 2);

    const querySql = `UPDATE jobs
                      SET ${setCols} 
                      WHERE title = ${handleTitleIdx} 
                      AND company_handle = ${handleCompIdx}
                      RETURNING title, 
                                salary, 
                                equity, 
                                company_handle AS "companyHandle"`;
    const result = await db.query(querySql, [...values, title, companyHandle]);
    const job = result.rows[0];

    if (!job) throw new NotFoundError(`No job by that title - ${title} - at ${companyHandle}`);

    return job;
  }

  /** Delete given job from database; returns undefined.
   *
   * Throws NotFoundError if job is not found.
   **/

  static async remove(title, companyHandle) {
    const result = await db.query(
          `DELETE
           FROM jobs
           WHERE title = $1
           AND company_handle = $2
           RETURNING title`,
        [title, companyHandle]);
    if (!result.rows[0]) throw new NotFoundError(`No job by that title - ${title} - at ${companyHandle}`);
  }
}


module.exports = Job;
