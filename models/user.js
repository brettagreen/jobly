"use strict";

const db = require("../db");
const bcrypt = require("bcrypt");
const { sqlForPartialUpdate } = require("../helpers/sql");
const {
  NotFoundError,
  BadRequestError,
  UnauthorizedError,
} = require("../expressError");

const { BCRYPT_WORK_FACTOR } = require("../config.js");

/** Related functions for users. */

class User {
  /** authenticate user with username, password.
   *
   * Returns { username, first_name, last_name, email, is_admin }
   *
   * Throws UnauthorizedError is user not found or wrong password.
   **/

  static async authenticate(username, password) {
    // try to find the user first
    const result = await db.query(
          `SELECT username,
                  password,
                  first_name AS "firstName",
                  last_name AS "lastName",
                  email,
                  is_admin AS "isAdmin"
           FROM users
           WHERE username = $1`,
        [username],
    );

    const user = result.rows[0];

    if (user) {
      // compare hashed password to a new hash from password
      const isValid = await bcrypt.compare(password, user.password);
      if (isValid === true) {
        user.setPassword = true;
        delete user.password;
        return user;
      }
    }

    throw new UnauthorizedError("Invalid username/password");
  }

  /** Register user with data.
   *
   * Returns { username, firstName, lastName, email, isAdmin }
   *
   * Throws BadRequestError on duplicates.
   **/

  static async register({ username, password, firstName, lastName, email, isAdmin, setPassword=false }) {
    const duplicateCheck = await db.query(
          `SELECT username
           FROM users
           WHERE username = $1`,
        [username],
    );

    if (duplicateCheck.rows[0]) {
      throw new BadRequestError(`Duplicate username: ${username}`);
    }

    const hashedPassword = await bcrypt.hash(password, BCRYPT_WORK_FACTOR);

    const result = await db.query(
          `INSERT INTO users
           (username,
            password,
            first_name,
            last_name,
            email,
            is_admin,
            set_password)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING username, first_name AS "firstName", last_name AS "lastName",
           email, is_admin AS "isAdmin", set_password AS "setPassword"`,
        [
          username,
          hashedPassword,
          firstName,
          lastName,
          email,
          isAdmin,
          setPassword
        ],
    );

    const user = result.rows[0];

    return user;
  }

  /** Set hashed verion of user password
   * 
   * returns user object with username, isAdmin, and setPassword properties
   */

  static async setPassword(username, password) {
    const hashedPassword = await bcrypt.hash(password, BCRYPT_WORK_FACTOR);
    
    const result = await db.query(
          `UPDATE users
           SET password = $1, set_password = $2
           WHERE username = $3
           RETURNING username, is_admin AS "isAdmin", set_password AS "setPassword"`, [hashedPassword, true, username]
    );

    if (!result.rows[0]) {
      throw new BadRequestError('unable to set new password. please try again.');
    }

    return result.rows[0];
  }

  /** Find all users.
   *
   * Returns [{ username, first_name, last_name, email, is_admin }, ...]
   **/

  static async findAll() {
    const result = await db.query(
          `SELECT username,
                  first_name AS "firstName",
                  last_name AS "lastName",
                  email,
                  is_admin AS "isAdmin"
           FROM users
           ORDER BY username`,
    );

    let appQuery;
    let json = [];
    for (let row of result.rows) {
      row.jobs = [];
      appQuery = await db.query(
        `SELECT job_id AS "jobId"
        FROM applications
        WHERE username = $1`, [row.username]);
      if (!appQuery.rows[0]) {
        json.push(row);
      } else {
        for (let appRow of appQuery.rows) {
          row.jobs.push(appRow.jobId);
        };
        json.push(row);
      }
    }

    return json;
  }

  /** Given a username, return data about user.
   *
   * Returns { username, first_name, last_name, is_admin, jobs }
   *   where jobs is { id, title, company_handle, company_name, state }
   *
   * Throws NotFoundError if user not found.
   **/

  static async get(username) {
    const userRes = await db.query(
          `SELECT username,
                  first_name AS "firstName",
                  last_name AS "lastName",
                  email,
                  is_admin AS "isAdmin"
           FROM users
           WHERE username = $1`,
        [username]
    );

    const user = userRes.rows[0];

    if (!user) throw new NotFoundError(`No user: ${username}`);

    const appQuery = await db.query(
      `SELECT job_id AS "jobId"
      FROM applications
      WHERE username = $1`, [username]);
    
    user.jobs = []
    
    if (!appQuery.rows[0]) {
      return user;
    } else {
      for (let row of appQuery.rows) {
        user.jobs.push(row.jobId);
      }
    }

    return user;
  }

  /** Update user data with `data`.
   *
   * This is a "partial update" --- it's fine if data doesn't contain
   * all the fields; this only changes provided ones.
   *
   * Data can include:
   *   { firstName, lastName, password, email, isAdmin }
   *
   * Returns { username, firstName, lastName, email, isAdmin }
   *
   * Throws NotFoundError if not found.
   *
   * WARNING: this function can set a new password or make a user an admin.
   * Callers of this function must be certain they have validated inputs to this
   * or a serious security risks are opened.
   */

  static async update(username, data) {
    if (data.password) {
      data.password = await bcrypt.hash(data.password, BCRYPT_WORK_FACTOR);
    }

    const { setCols, values } = sqlForPartialUpdate(
        data,
        {
          firstName: "first_name",
          lastName: "last_name",
          isAdmin: "is_admin",
        });
    const usernameVarIdx = "$" + (values.length + 1);

    const querySql = `UPDATE users 
                      SET ${setCols} 
                      WHERE username = ${usernameVarIdx} 
                      RETURNING username,
                                first_name AS "firstName",
                                last_name AS "lastName",
                                email,
                                is_admin AS "isAdmin"`;
    const result = await db.query(querySql, [...values, username]);
    const user = result.rows[0];

    if (!user) throw new NotFoundError(`No user: ${username}`);

    delete user.password;
    return user;
  }

  static async applyForJob(username, jobId) {
    jobId = parseInt(jobId);

    if (isNaN(jobId)) {
      throw new BadRequestError(`id in url - /users/username/jobs/id - must be a number`);
    }

    const duplicateCheck = await db.query(
      `SELECT username, job_id
       FROM applications
       WHERE username = $1 AND job_id = $2`,
      [username, jobId]
    );

    if (duplicateCheck.rows[0]) {
      throw new BadRequestError(`Duplicate application: ${username}` + ' for jobId ' + `${jobId}`);
    }

    const checkUsername = await db.query(`SELECT username from users WHERE username = $1`, [username]);
    if (!checkUsername.rows[0]) {
      throw new BadRequestError('that username does not exist');
    }

    const checkJobId = await db.query(`SELECT id from jobs WHERE id = $1`, [jobId]);
    if (!checkJobId.rows[0]) {
      throw new BadRequestError('no job with that jobId exists');
    }
    
    const result = await db.query(
          `INSERT INTO applications
          (username, job_id)
          VALUES ($1, $2)
          RETURNING username, job_id AS "jobId"`,
        [
          username,
          jobId
        ]
    );

    return result.rows[0];
}

  /** Delete given user from database; returns undefined. */

  static async remove(username) {
    let result = await db.query(
          `DELETE
           FROM users
           WHERE username = $1
           RETURNING username`,
        [username],
    );
    const user = result.rows[0];

    if (!user) throw new NotFoundError(`No user: ${username}`);
  }
}


module.exports = User;
