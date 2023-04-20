const { BadRequestError } = require("../expressError");

/*
dataToUpdate param takes {columnKey: columnValue} pairs to update taken from the request body.
No particular fields are required, but if zero update fields are provided,
the method throws a 'no data' exception.

jsToSql param maps userFriendly column names to psql_column_names.

The cols method iterates over the extracted columnKey values, and maps each column to its 
respective psql argument position string ('$1', '$2', etc) for placement in the SET portion of the sql update query.
see note below.

These values are then joined by ', ' before being returned to the calling function.

Also returned to the calling function are columnValue arguments.
*/

function sqlForPartialUpdate(dataToUpdate, jsToSql) {
  const keys = Object.keys(dataToUpdate);

  if (keys.length === 0) {
    throw new BadRequestError("No data");
  }

  // {firstName: 'Aliya', age: 32} => ['"first_name"=$1', '"age"=$2']
  const cols = keys.map((colName, idx) =>
      `"${jsToSql[colName] || colName}"=$${idx + 1}`,
  );

  return {
    setCols: cols.join(", "),
    values: Object.values(dataToUpdate),
  };
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

function jobWriteWhere({title, minSalary, hasEquity}) {
  let where;
  let values = [];

  if (!title && !minSalary && !hasEquity) {
    return null;
  }

  if (!title && !minSalary) {
      if (Boolean(hasEquity)) {
        where = "WHERE equity > $1";
        values.push(0);
      } else {
        return null;
      }
  } else if (!title && !hasEquity) {
      where = "WHERE salary >= $1";
      values.push(minSalary);
  } else if (!title) {
      if (Boolean(hasEquity)) {
        where = "WHERE salary >= $1 AND equity > $2";
        values.push(minSalary, 0);
      } else {
        where = "WHERE salary >= $1";
        values.push(minSalary);
      }
  } else if (!hasEquity && !minSalary) {
      where = "WHERE UPPER(title) LIKE UPPER($1)";
      values.push(title);
  } else if (!minSalary) {
    if (Boolean(hasEquity)) {
      where = "WHERE UPPER(title) LIKE UPPER($1) AND equity > $2";
      values.push(title, 0);
    } else {
      where = "WHERE UPPER(title) LIKE UPPER($1)";
      values.push(title);
    }
  } else {
    where = "WHERE UPPER(title) LIKE UPPER($1) AND salary >= $2";
    values.push(title, minSalary); 
  }

  return {where, values};
}


module.exports = { sqlForPartialUpdate, companyWriteWhere, jobWriteWhere };
