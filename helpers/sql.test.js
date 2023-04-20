const { sqlForPartialUpdate, writeWhere } = require("./sql");
const { BadRequestError } = require("../expressError");

describe("sqlForPartialUpdate", function () {
    test("returns [column_name='$1', ...] and column value {}  ", function () {
      const dataToUpdate = {age: 32, jobDescription: "secret agent", annual_salary: 50000};
      const jsToSql = { jobDescription: "job_description" };
      const test = sqlForPartialUpdate(dataToUpdate, jsToSql);
      expect(test).toEqual({
        setCols: "\"age\"=$1, \"job_description\"=$2, \"annual_salary\"=$3",
        values: [32, "secret agent", 50000]
      });
    });

    test("no data throws error", function() {
      const dataToUpdate = {};
      const jsToSql = {};
      expect(() => sqlForPartialUpdate(dataToUpdate, jsToSql)).toThrow(new BadRequestError("No data"));
    });
});
