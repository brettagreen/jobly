"use strict";

/** Convenience middleware to handle common auth cases in routes. */

const jwt = require("jsonwebtoken");
const { SECRET_KEY } = require("../config");
const { UnauthorizedError } = require("../expressError");


/** Middleware: Authenticate user.
 *
 * If a token was provided, verify it, and, if valid, store the token payload
 * on res.locals (this will include the username and isAdmin field.)
 *
 * It's not an error if no token was provided or if the token is not valid.
 */

function authenticateJWT(req, res, next) {
  try {
    const authHeader = req.headers && req.headers.authorization;
    if (authHeader) {
      const token = authHeader.replace(/^[Bb]earer /, "").trim();
      res.locals.user = jwt.verify(token, SECRET_KEY);
      //user was created by admin and hasn't set their own password yet
      if (!res.locals.user.setPassword && req.originalUrl !== `/users/${res.locals.user.username}/password`) {
        return res.send(`HEY THERE! Please go to /users/${res.locals.user.username}/password to set your own password.
                        Then you can continue to use the site!`);
      }
    }
    return next();
  } catch (err) {
    return next();
  }
}

/** Middleware to use to ensure user is logged in and/or an admin.
 *
 * If not, raises Unauthorized.
 */

function ensureLoggedIn(req, res, next) {
  try {
    if (!res.locals.user) throw new UnauthorizedError();
    return next();
  } catch (err) {
    return next(err);
  }
}

function isAdmin(req, res, next) {
  try {
    if (!res.locals.user || !res.locals.user.isAdmin) {
      throw new UnauthorizedError("You need to be an admin to perform this function");
    }
    return next();
  } catch (err) {
    return next(err);
  }
}

function userOrAdmin(req, res, next) {
  try {
    if (!res.locals.user || (!res.locals.user.isAdmin && res.locals.user.username !== req.params.username)) {
      throw new UnauthorizedError("You lack the requisite credentials :p")
    }
    return next();
  } catch (err) {
    return next(err);
  }
}


module.exports = {
  authenticateJWT,
  ensureLoggedIn,
  isAdmin,
  userOrAdmin
};
