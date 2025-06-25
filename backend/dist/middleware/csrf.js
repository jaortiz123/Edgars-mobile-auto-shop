"use strict";
const csurf = require('csurf');
const csrf = csurf({ cookie: true });
module.exports = csrf;
