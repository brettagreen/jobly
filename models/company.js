"use strict";

const db = require("../db");
const { BadRequestError, NotFoundError } = require("../expressError");
const sqlForPartialUpdate = require("../helpers/sql");

/** Related functions for companies. */

class Company {
  /** Create a company (from data), update db, return new company data.
   *
   * data should be { handle, name, description, numEmployees, logoUrl }
   *
   * Returns { handle, name, description, numEmployees, logoUrl }
   *
   * Throws BadRequestError if company already in database.
   * */

  static async create({ handle, name, description, numEmployees, logoUrl }) {
    const duplicateCheck = await db.query(
          `SELECT handle
           FROM companies
           WHERE handle = $1`,
        [handle]);

    if (duplicateCheck.rows[0]) {
      throw new BadRequestError(`Duplicate company: ${handle}`);
    }

    const result = await db.query(
          `INSERT INTO companies
           (handle, name, description, num_employees, logo_url)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING handle, name, description, num_employees AS "numEmployees", logo_url AS "logoUrl"`,
        [
          handle,
          name,
          description,
          numEmployees || null,
          logoUrl || null
        ],
    );

    return result.rows[0];
  }

  /** Find all companies.
   *
   * can filter on name, and minimum and maxiumum number of company employees.
   * e.g. http://localhost:3001/?name=Pep&minEmployees=10
   * Returns [{ handle, name, description, numEmployees, logoUrl }, ...]
   * */

  static async findAll(fields) {
    const where = companyWriteWhere(fields);
    let companiesRes;
    if (where !== null) {
      companiesRes = await db.query(
            `SELECT handle,
                    name,
                    description,
                    num_employees AS "numEmployees",
                    logo_url AS "logoUrl"
            FROM companies
            ${where.where}
            ORDER BY name`, where.values);
      } else {
      companiesRes = await db.query(
            `SELECT handle,
                name,
                description,
                num_employees AS "numEmployees",
                logo_url AS "logoUrl"
        FROM companies
        ORDER BY name`)
      }
    return companiesRes.rows;
  }

  /** Given a company handle, return data about company.
   *
   * Returns { handle, name, description, numEmployees, logoUrl, jobs }
   *   where jobs is [{ id, title, salary, equity, companyHandle }, ...]
   *
   * Throws NotFoundError if not found.
   **/

  static async get(handle) {
    const companyRes = await db.query(
          `SELECT handle,
                  name,
                  description,
                  num_employees AS "numEmployees",
                  logo_url AS "logoUrl"
           FROM companies
           WHERE handle = $1`,
        [handle]);

    const company = companyRes.rows[0];

    if (!company) throw new NotFoundError(`No company: ${handle}`);

    return company;
  }

  /** Update company data with `data`.
   *
   * This is a "partial update" --- it's fine if data doesn't contain all the
   * fields; this only changes provided ones.
   *
   * Data can include: {name, description, numEmployees, logoUrl}
   *
   * Returns {handle, name, description, numEmployees, logoUrl}
   *
   * Throws NotFoundError if not found.
   */

  static async update(handle, data) {
    const { setCols, values } = sqlForPartialUpdate(
        data,
        {
          numEmployees: "num_employees",
          logoUrl: "logo_url",
        });
    const handleVarIdx = "$" + (values.length + 1);

    const querySql = `UPDATE companies 
                      SET ${setCols} 
                      WHERE handle = ${handleVarIdx} 
                      RETURNING handle, 
                                name, 
                                description, 
                                num_employees AS "numEmployees", 
                                logo_url AS "logoUrl"`;
    const result = await db.query(querySql, [...values, handle]);
    const company = result.rows[0];

    if (!company) throw new NotFoundError(`No company: ${handle}`);

    return company;
  }

  /** Delete given company from database; returns undefined.
   *
   * Throws NotFoundError if company not found.
   **/

  static async remove(handle) {
    const result = await db.query(
          `DELETE
           FROM companies
           WHERE handle = $1
           RETURNING handle`,
        [handle]);
    const company = result.rows[0];

    if (!company) throw new NotFoundError(`No company: ${handle}`);
  }
}

function companyWriteWhere({name, min, max}) {
  let where;
  let values = [];

  if (!name && !min && !max) {
    return null;
  }

  if (!name && !min) {
      where = "WHERE num_employees <= $1";
      values.push(max);
  } else if (!name && !max) {
      where = "WHERE num_employees >= $1";
      values.push(min);
  } else if (!name) {
      where = "WHERE num_employees >= $1 AND num_employees <= $2";
      values.push(min, max);
  } else if (!max && !min) {
      where = "WHERE UPPER(name) LIKE UPPER($1)";
      values.push(name);
  } else if (!min) {
    where = "WHERE UPPER(name) LIKE UPPER($1) AND num_employees <= $2";
    values.push(name, max);
  } else {
    where = "WHERE UPPER(name) LIKE UPPER($1) AND num_employees >= $2";
    values.push(name, min); 
  }

  return {where, values};
}

module.exports = Company;
