const swaggerUi = require('swagger-ui-express')
const express = require('express')

const router = express.Router()

const spec = {
  openapi: '3.0.0',
  info: {
    title: 'API Docs',
    version: '1.0.0',
  },
}

router.use('/', swaggerUi.serve, swaggerUi.setup(spec))

module.exports = router
