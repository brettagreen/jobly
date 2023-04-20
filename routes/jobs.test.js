"use strict";

process.env.NODE_ENV = 'test';

const request = require("supertest");

const db = require("../db");
const app = require("../app");

const { BadRequestError } = require("../expressError");

const {
  commonBeforeAll,
  commonBeforeEach,
  commonAfterEach,
  commonAfterAll,
  u1Token,
  adminToken
} = require("./_testCommon");
beforeAll(commonBeforeAll);
beforeEach(commonBeforeEach);
afterEach(commonAfterEach);
afterAll(commonAfterAll);

/************************************** POST /jobs */

describe("POST /jobs", function () {
  const newJob = {
    title: "Newest new job",
    salary: 2525,
    equity: .2,
    companyHandle: "c1"
  };

  test("works for admin users", async function () {

    const resp = await request(app)
        .post("/jobs")
        .send(newJob)
        .set("authorization", `Bearer ${adminToken}`);
    expect(resp.statusCode).toEqual(201);
    expect(resp.body).toEqual({
      job: {
        title: "Newest new job",
        salary: 2525,
        equity: "0.2",
        companyHandle: "c1"
      }
    });
  });

  test("doesn't work for non-admin users", async function () {
    const resp = await request(app)
        .post("/jobs")
        .send(newJob)
        .set("authorization", `Bearer ${u1Token}`);
        expect(resp.status).toBe(401);
        expect(resp.body.error.message).toEqual("You need to be an admin to perform this function");
  });

  test("bad request with missing data", async function () {
    const resp = await request(app)
        .post("/jobs")
        .send({
          title: "newest new job of new",
          salary: 10000
        })
        .set("authorization", `Bearer ${adminToken}`);
    expect(resp.statusCode).toEqual(400);
  });

  test("bad request with invalid data", async function () {
    const resp = await request(app)
        .post("/jobs")
        .send({
          title: 'scullery maid',
          salary: "eat more good food", // <-- culprit, should be int
          equity: .99,
          companyHandle: "c2"
        })
        .set("authorization", `Bearer ${adminToken}`);
    expect(resp.statusCode).toEqual(400);
  });
});

/************************************** GET /jobs */

describe("GET /jobs", function () {
  test("ok for anon", async function () {

    const resp = await request(app).get("/jobs");
    expect(resp.body).toEqual({
      jobs:
          [
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
          ]
    });
  });

  test("fails: test next() handler", async function () {
    // there's no normal failure event which will cause this route to fail ---
    // thus making it hard to test that the error-handler works with it. This
    // should cause an error, all right :)
    await db.query("DROP TABLE jobs CASCADE");
    const resp = await request(app)
        .get("/jobs")
        .set("authorization", `Bearer ${u1Token}`);
    expect(resp.statusCode).toEqual(500);
  });
});

describe("GET /jobs?queryStringArgs", function () {
  let resp;
  test("title filter", async function () {
    resp = await request(app).get("/jobs?title=butcher");
    expect(resp.body).toEqual({
      jobs:
          [
            {
                title: 'butcher',
                salary: 20000,
                equity: "0.5",
                companyHandle: 'c2'
            }
          ]
    });
  });

  test("minSalary filter", async function () {
    resp = await request(app).get("/jobs?minSalary=3500");
    expect(resp.body).toEqual({
      jobs:
          [
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
          ]
    });
  });

  test("hasEquity filter", async function () {
    resp = await request(app).get("/jobs?hasEquity=true");
    expect(resp.body).toEqual({
      jobs:
          [
            {
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
            },
          ]
    });
  });

  test("combo filter", async function () {
    resp = await request(app).get("/jobs?minSalary=3500&hasEquity=true");
    expect(resp.body).toEqual({
      jobs:
          [
            {
                title: 'butcher',
                salary: 20000,
                equity: "0.5",
                companyHandle: 'c2'
              }
          ]
    });
  });

  test('irrelevant query params are ignored', async function() {
    resp = await request(app).get("/jobs?location=Montana&minSalary=3500");
    expect(resp.body).toEqual({
      jobs:
          [
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
          ],
    });
  });
});

/************************************** GET /companies/:handle */

describe("GET /jobs/:title", function () {
  test("works for anon", async function () {
    const resp = await request(app).get(`/jobs/jerky%20maker`);
    expect(resp.body).toEqual({
      jobs: [{
        title: 'jerky maker',
        salary: 100,
        equity: "1",
        companyHandle: 'c1'
      }]
    });
  });

  test("not found, no such job", async function () {
    const resp = await request(app).get(`/jobs/beekeeper`);
    expect(resp.statusCode).toEqual(404);
  });
});

/************************************** PATCH /jobs/:title/:companyHandle */

describe("PATCH /jobs/:title/:companyHandle", function () {
  test("works for admin users", async function () {
    const resp = await request(app)
        .patch(`/jobs/jerky%20maker/c1`)
        .send({
          title: "fancy-fresh jerky maker",
        })
        .set("authorization", `Bearer ${adminToken}`);
    expect(resp.body).toEqual({
      job: {
        title: 'fancy-fresh jerky maker',
        salary: 100,
        equity: "1",
        companyHandle: 'c1'
      }
    });
  });

  test("doesn't work for non-admin users", async function () {
    const resp = await request(app)
    .patch(`/jobs/jerky%20maker/c1`)
    .send({
      title: "fancy-fresh jerky maker",
    })
    .set("authorization", `Bearer ${u1Token}`);
    expect(resp.status).toBe(401);
    expect(resp.body.error.message).toEqual("You need to be an admin to perform this function");
  });

  test("unauth for anon", async function () {
    const resp = await request(app)
        .patch(`/jobs/jerky%20maker/c1`)
        .send({
          title: "fancy-fresh jerky maker",
        });
    expect(resp.statusCode).toEqual(401);
  });

  test("no record found for job title/companyHandle combo", async function () {
    const resp = await request(app)
        .patch(`/jobs/caboose%20operator/c4`)
        .send({
          title: "toot toot"
        })
        .set("authorization", `Bearer ${adminToken}`);
    expect(resp.statusCode).toEqual(404);
  });

  /*test("bad request on invalid data", async function () {
    const resp = await request(app)
        .patch(`/jerky%20maker/c1`)
        .send({
          //greater than 1
          equity: 1.1
        })
        .set("authorization", `Bearer ${adminToken}`);
    expect(resp.statusCode).toEqual(400);
  });*/
});

/************************************** DELETE /jobs/:title/:companyHandle */

describe("DELETE /jobs/:title/:companyHandle", function () {
  test("works for admin users", async function () {
    const resp = await request(app)
        .delete(`/jobs/butcher/c2`)
        .set("authorization", `Bearer ${adminToken}`);
    expect(resp.body).toEqual({ deleted: "butcher at c2" });
  });

  test("doesn't work for non-admin users", async function () {
    const resp = await request(app)
        .delete(`/jobs/butcher/c2`)
        .set("authorization", `Bearer ${u1Token}`);
        expect(resp.status).toBe(401);
        expect(resp.body.error.message).toEqual("You need to be an admin to perform this function");
  });

  test("unauth for anon", async function () {
    const resp = await request(app)
        .delete(`/jobs/butcher/c2`);
    expect(resp.statusCode).toEqual(401);
  });

  test("no job by that name at that company", async function () {
    const resp = await request(app)
        .delete(`/jobs/gardener/dirt-farm`)
        .set("authorization", `Bearer ${adminToken}`);
    expect(resp.statusCode).toEqual(404);
  });
});
