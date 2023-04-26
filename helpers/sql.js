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


module.exports = sqlForPartialUpdate;
