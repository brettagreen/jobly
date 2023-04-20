"use strict";

const db = require("../db.js");
const { BadRequestError, NotFoundError } = require("../expressError");
const Job = require("./job.js");
const {
  commonBeforeAll, 
  commonBeforeEach,
  commonAfterEach,
  commonAfterAll
} = require("./_testCommon");

beforeAll(commonBeforeAll);
beforeEach(commonBeforeEach);
afterEach(commonAfterEach);
afterAll(commonAfterAll);

/************************************** create */

describe("create", function () {
  const newJob = {
    title: "executioner",
    salary: 1500,
    equity: .1,
    companyHandle: 'c1',
  };

  test("works", async function () {
    let job =  await Job.create(newJob);
    expect(job).toEqual({
        title: "executioner",
        salary: 1500,
        equity: "0.1",
        companyHandle: 'c1',
      });

    const result = await db.query(
          `SELECT title, salary, equity, company_handle AS "companyHandle"
           FROM jobs
           WHERE title = 'executioner' AND company_handle = 'c1'`);
    expect(result.rows).toEqual([
      {
        title: "executioner",
        salary: 1500,
        equity: "0.1",
        companyHandle: 'c1'
      },
    ]);
  });

  test("works with same title @ diff companies", async function () {
    await Job.create(newJob);
    await Job.create({
        title: 'executioner',
        salary: 45000,
        equity: .9,
        companyHandle: 'c2'
    });

    const result = await db.query(
          `SELECT title, salary, equity, company_handle AS "companyHandle"
           FROM jobs
           WHERE title = 'executioner'`);
    expect(result.rows).toEqual([
      {
        title: "executioner",
        salary: 1500,
        equity: "0.1",
        companyHandle: 'c1'
      },
      {
        title: "executioner",
        salary: 45000,
        equity: "0.9",
        companyHandle: 'c2'
      }
    ]);
  });

  test("bad request with dupe", async function () {
    try {
      await Job.create(newJob);
      await Job.create(newJob);
    } catch (err) {
      console.log(err);
      expect(err instanceof BadRequestError).toBeTruthy();
    }
  });
});

/************************************** findAll */

describe("findAll", function () {
    let jobs;
    test("works: no filter", async function () {
      jobs = await Job.findAll({undefined, undefined, undefined});
  
      expect(jobs).toEqual([
        {
            title: 'butcher',
            salary: 20000,
            equity: "0.5",
            companyHandle: 'c2'
        },
        {
          title: 'court jester',
          salary: 3500,
          equity: null,
          companyHandle: 'c3'
        },
        {
          title: 'jerky maker',
          salary: 100,
          equity: "1",
          companyHandle: 'c1'
        }
      ]);
    });
  
    test('title filter', async function() {
      jobs = await Job.findAll({title:'%jester%', undefined, undefined});
  
      expect(jobs).toEqual([
        {
          title: "court jester",
          salary: 3500,
          equity: null,
          companyHandle: 'c3'
        }
      ]);
    });
  
    test('minSalary filter', async function() {
      jobs = await Job.findAll({undefined, minSalary: 3500, undefined});
  
      expect(jobs).toEqual([
      {
          title: 'butcher',
          salary: 20000,
          equity: "0.5",
          companyHandle: 'c2'
      },
      {
          title: 'court jester',
          salary: 3500,
          equity: null,
          companyHandle: 'c3'
      }
      ]);
    });
  
    test('hasEquity filter', async function() {
      jobs = await Job.findAll({undefined, undefined, hasEquity: true});
  
      expect(jobs).toEqual([{
          title: 'butcher',
          salary: 20000,
          equity: "0.5",
          companyHandle: 'c2'
      },
      {
          title: 'jerky maker',
          salary: 100,
          equity: "1",
          companyHandle: 'c1'
      }]);
    });
  
    test('combo filter', async function() {
      jobs = await Job.findAll({name: '%jester%', minSalary: 50000, undefined});
  
      expect(jobs).toEqual([]);
    });
  
    test('bad filter, ironically returns all', async function() {
      jobs = await Job.findAll({birthday: 'December 9 2002', recipe: 'flour', hasEquity: false});
  
      expect(jobs).toEqual([{
        title: 'butcher',
        salary: 20000,
        equity: "0.5",
        companyHandle: 'c2'
      },
      {
        title: 'court jester',
        salary: 3500,
        equity: null,
        companyHandle: 'c3'
      },
      {
        title: 'jerky maker',
        salary: 100,
        equity: "1",
      companyHandle: 'c1'
      }]);
    });
  });
  
  /************************************** get */
  
  describe("get", function () {
    test("works", async function () {
      let jobs = await Job.get("jerky maker");
      expect(jobs).toEqual([{
          title: 'jerky maker',
          salary: 100,
          equity: "1",
          companyHandle: 'c1'
      }]);
    });
  
    test("works, return multiple jobs", async function () {
      await Job.create({
          title: 'jerky maker',
          salary: 1,
          equity: "0.5",
          companyHandle: 'c3'
      });
      let jobs = await Job.get("jerky maker");
      expect(jobs).toEqual([{
              title: 'jerky maker',
              salary: 100,
              equity: "1",
              companyHandle: 'c1'
          },
          {
              title: 'jerky maker',
              salary: 1,
              equity: "0.5",
              companyHandle: 'c3'
          }
      ]);
    });
  
    test("not found if no such job", async function () {
      try {
        await Job.get("noJob");
      } catch (err) {
        expect(err instanceof NotFoundError).toBeTruthy();
      }
    });
  });
  
  /************************************** update */
  
  describe("update", function () {
    const updateData = {
      title: "New job title",
      salary: 20000,
      equity: 1
    };
  
    test("works", async function () {
      let job = await Job.update("court jester","c3", updateData);
      expect(job).toEqual({
        companyHandle: 'c3',
        title: "New job title",
        salary: 20000,
        equity: "1"
      });
  
      const result = await db.query(
            `SELECT title, salary, equity, company_handle AS "companyHandle"
             FROM jobs
             WHERE company_handle = 'c3' AND title = '${updateData.title}'`);

      expect(result.rows).toEqual([{
        companyHandle: 'c3',
        title: "New job title",
        salary: 20000,
        equity: "1"
      }]);
    });
  
    test("works: null fields", async function () {
      const updateDataSetNulls = {
        title: "New job title",
        salary: null,
        equity: null
      };
  
      let job = await Job.update("court jester", "c3", updateDataSetNulls);
      expect(job).toEqual({
        companyHandle: "c3",
        ...updateDataSetNulls
      });
  
      const result = await db.query(
            `SELECT title, salary, equity, company_handle AS "companyHandle"
             FROM jobs
             WHERE company_handle = 'c3' AND title = '${updateData.title}'`);
      expect(result.rows).toEqual([{
          companyHandle: 'c3',
          ...updateDataSetNulls
      }]);
    });
  
    test("not found if no job in db", async function () {
      try {
        await Job.update("crime reporter", "c2", updateData);
      } catch (err) {
        expect(err instanceof NotFoundError).toBeTruthy();
      }
    });
  
    test("bad request with no data", async function () {
      try {
        await Job.update("court jester", "c3", {});
      } catch (err) {
        expect(err instanceof BadRequestError).toBeTruthy();
      }
    });
  });
  
  /************************************** remove */
  
  describe("remove", function () {
    test("works", async function () {
      await Job.remove("butcher", "c2");
      const res = await db.query(
          "SELECT title, company_handle FROM jobs WHERE title='butcher' AND company_handle='c2'");
      expect(res.rows.length).toEqual(0);
    });
  
    test("not found if no such job", async function () {
      try {
        await Job.remove("hairdresser", "c1");
      } catch (err) {
        expect(err instanceof NotFoundError).toBeTruthy();
      }
    });
  });
  
