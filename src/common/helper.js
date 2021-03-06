/**
 * This file defines helper methods
 */
const _ = require('lodash')
const constants = require('../../app-constants')
const models = require('../models')
const errors = require('./errors')
const AWS = require('aws-sdk')
const config = require('config')
const busApi = require('topcoder-bus-api-wrapper')
const elasticsearch = require('elasticsearch')
const uuid = require('uuid/v4')
const querystring = require('querystring')

// Bus API Client
let busApiClient

// Elasticsearch client
let esClient

const awsConfig = {
  s3: config.AMAZON.S3_API_VERSION,
  region: config.AMAZON.AWS_REGION
}
if (config.AMAZON.AWS_ACCESS_KEY_ID && config.AMAZON.AWS_SECRET_ACCESS_KEY) {
  awsConfig.accessKeyId = config.AMAZON.AWS_ACCESS_KEY_ID
  awsConfig.secretAccessKey = config.AMAZON.AWS_SECRET_ACCESS_KEY
}
AWS.config.update(awsConfig)

const s3 = new AWS.S3()

/**
 * Wrap async function to standard express function
 * @param {Function} fn the async function
 * @returns {Function} the wrapped function
 */
function wrapExpress (fn) {
  return function (req, res, next) {
    fn(req, res, next).catch(next)
  }
}

/**
 * Wrap all functions from object
 * @param obj the object (controller exports)
 * @returns {Object|Array} the wrapped object
 */
function autoWrapExpress (obj) {
  if (_.isArray(obj)) {
    return obj.map(autoWrapExpress)
  }
  if (_.isFunction(obj)) {
    if (obj.constructor.name === 'AsyncFunction') {
      return wrapExpress(obj)
    }
    return obj
  }
  _.each(obj, (value, key) => {
    obj[key] = autoWrapExpress(value)
  })
  return obj
}

/**
 * Check if the user has admin role
 * @param {Object} authUser the user
 * @returns {Boolean} whether the user has admin role
 */
function hasAdminRole (authUser) {
  if (!authUser.roles) {
    return false
  }
  for (let i = 0; i < authUser.roles.length; i += 1) {
    for (let j = 0; j < constants.ADMIN_ROLES.length; j += 1) {
      if (authUser.roles[i].toLowerCase() === constants.ADMIN_ROLES[j].toLowerCase()) {
        return true
      }
    }
  }
  return false
}

/**
 * Check if exists.
 *
 * @param {Array} source the array in which to search for the term
 * @param {Array | String} term the term to search
 * @returns {Boolean} whether the term is in the source
 */
function checkIfExists (source, term) {
  let terms

  if (!_.isArray(source)) {
    throw new Error('Source argument should be an array')
  }

  source = source.map(s => s.toLowerCase())

  if (_.isString(term)) {
    terms = term.toLowerCase().split(' ')
  } else if (_.isArray(term)) {
    terms = term.map(t => t.toLowerCase())
  } else {
    throw new Error('Term argument should be either a string or an array')
  }

  for (let i = 0; i < terms.length; i++) {
    if (source.includes(terms[i])) {
      return true
    }
  }

  return false
}

/**
 * Get entity by hash key
 * @param {String} modelName the model name
 * @param {String} hashKeyName the hash key name
 * @param {any} value the hash key value
 * @returns {Promise<Object>} the found entity
 */
async function getEntityByHashKey (modelName, hashKeyName, value) {
  return new Promise((resolve, reject) => {
    models[modelName].query(hashKeyName).eq(value).exec((err, result) => {
      if (err) {
        return reject(err)
      }
      if (result && result.length > 0) {
        return resolve(result[0])
      } else {
        return reject(new errors.NotFoundError(`Can not find ${modelName} with ${hashKeyName}: ${value}`))
      }
    })
  })
}

/**
 * Get member by handle
 * @param {String} handle the member handle
 * @returns {Promise<Object>} the member of given handle
 */
async function getMemberByHandle (handle) {
  return new Promise((resolve, reject) => {
    models.Member.query('handleLower').eq(handle.toLowerCase()).exec((err, result) => {
      if (err) {
        return reject(err)
      }
      if (result && result.length > 0) {
        return resolve(result[0])
      } else {
        return reject(new errors.NotFoundError(`Member with handle: "${handle}" doesn't exist`))
      }
    })
  })
}

/**
 * Create item in database
 * @param {Object} modelName The dynamoose model name
 * @param {Object} data The create data object
 * @returns {Promise<Object>} the created object
 */
async function create (modelName, data) {
  return new Promise((resolve, reject) => {
    const dbItem = new models[modelName](data)
    dbItem.save((err) => {
      if (err) {
        return reject(err)
      } else {
        return resolve(dbItem)
      }
    })
  })
}

/**
 * Update item in database
 * @param {Object} dbItem The Dynamo database item
 * @param {Object} data The updated data object
 * @returns {Promise<Object>} the updated object
 */
async function update (dbItem, data) {
  Object.keys(data).forEach((key) => {
    dbItem[key] = data[key]
  })
  return new Promise((resolve, reject) => {
    dbItem.save((err) => {
      if (err) {
        return reject(err)
      } else {
        return resolve(dbItem)
      }
    })
  })
}

/**
 * Get data collection by scan parameters
 * @param {Object} modelName The dynamoose model name
 * @param {Object} scanParams The scan parameters object
 * @returns {Promise<Array>} the found objects
 */
async function scan (modelName, scanParams) {
  return new Promise((resolve, reject) => {
    models[modelName].scan(scanParams).exec((err, result) => {
      if (err) {
        return reject(err)
      } else {
        return resolve(result.count === 0 ? [] : result)
      }
    })
  })
}

/**
 * Get data collection by Dynamoose query
 * @param {Object} modelName The dynamoose model name
 * @param {Object} queryParams The query parameters object
 * @returns {Promise<Array>} the found objects
 */
async function query (modelName, queryParams) {
  return new Promise((resolve, reject) => {
    models[modelName].query(queryParams).exec((err, result) => {
      if (err) {
        return reject(err)
      } else {
        return resolve(result || [])
      }
    })
  })
}

/**
 * Upload photo to S3
 * @param {Buffer} data the file data
 * @param {String} mimetype the MIME type
 * @param {String} fileName the original file name
 * @return {Promise<String>} the uploaded photo URL
 */
async function uploadPhotoToS3 (data, mimetype, fileName) {
  // generate S3 key
  const key = uuid()
  const params = {
    Bucket: config.AMAZON.PHOTO_S3_BUCKET,
    Key: key,
    Body: data,
    ContentType: mimetype,
    ACL: 'public-read',
    Metadata: {
      fileName
    }
  }
  // Upload to S3
  await s3.upload(params).promise()
  // construct photo URL
  return config.PHOTO_URL_TEMPLATE.replace('<key>', key)
}

/**
 * Get Bus API Client
 * @return {Object} Bus API Client Instance
 */
function getBusApiClient () {
  // if there is no bus API client instance, then create a new instance
  if (!busApiClient) {
    busApiClient = busApi(_.pick(config,
      ['AUTH0_URL', 'AUTH0_AUDIENCE', 'TOKEN_CACHE_TIME',
        'AUTH0_CLIENT_ID', 'AUTH0_CLIENT_SECRET', 'BUSAPI_URL',
        'KAFKA_ERROR_TOPIC', 'AUTH0_PROXY_SERVER_URL']))
  }

  return busApiClient
}

/**
 * Post bus event.
 * @param {String} topic the event topic
 * @param {Object} payload the event payload
 */
async function postBusEvent (topic, payload) {
  const client = getBusApiClient()
  await client.postEvent({
    topic,
    originator: constants.EVENT_ORIGINATOR,
    timestamp: new Date().toISOString(),
    'mime-type': constants.EVENT_MIME_TYPE,
    payload
  })
}

/**
 * Get ES Client
 * @return {Object} Elasticsearch Client Instance
 */
function getESClient () {
  if (esClient) {
    return esClient
  }
  const esHost = config.get('ES.HOST')
  // AWS ES configuration is different from other providers
  if (/.*amazonaws.*/.test(esHost)) {
    esClient = elasticsearch.Client({
      apiVersion: config.get('ES.API_VERSION'),
      hosts: esHost,
      connectionClass: require('http-aws-es'), // eslint-disable-line global-require
      amazonES: {
        region: config.get('AMAZON.AWS_REGION'),
        credentials: new AWS.EnvironmentCredentials('AWS')
      }
    })
  } else {
    esClient = new elasticsearch.Client({
      apiVersion: config.get('ES.API_VERSION'),
      hosts: esHost
    })
  }
  return esClient
}

/**
 * Parse comma separated string to return array of values.
 * @param {String} s the string to parse
 * @param {Array} allowedValues the allowed values
 * @returns {Array} the parsed values
 */
function parseCommaSeparatedString (s, allowedValues) {
  if (!s) {
    return null
  }
  const values = s.split(',')
  // used to check duplicate values
  const mapping = {}
  _.forEach(values, (value) => {
    if (value.trim().length === 0) {
      throw new errors.BadRequestError('Empty value.')
    }
    if (allowedValues && !_.includes(allowedValues, value)) {
      throw new errors.BadRequestError(`Invalid value: ${value}`)
    }
    if (mapping[value]) {
      throw new errors.BadRequestError(`Duplicate values: ${value}`)
    }
    mapping[value] = true
  })
  return values
}

/**
 * Get link for a given page.
 * @param {Object} req the HTTP request
 * @param {Number} page the page number
 * @returns {String} link for the page
 */
function getPageLink (req, page) {
  const q = _.assignIn({}, req.query, { page })
  return `${req.protocol}://${req.get('Host')}${req.baseUrl}${req.path}?${querystring.stringify(q)}`
}

/**
 * Set HTTP response headers from result.
 * @param {Object} req the HTTP request
 * @param {Object} res the HTTP response
 * @param {Object} result the operation result
 */
function setResHeaders (req, res, result) {
  const totalPages = Math.ceil(result.total / result.perPage)
  if (result.page > 1) {
    res.set('X-Prev-Page', result.page - 1)
  }
  if (result.page < totalPages) {
    res.set('X-Next-Page', result.page + 1)
  }
  res.set('X-Page', result.page)
  res.set('X-Per-Page', result.perPage)
  res.set('X-Total', result.total)
  res.set('X-Total-Pages', totalPages)
  // set Link header
  if (totalPages > 0) {
    let link = `<${getPageLink(req, 1)}>; rel="first", <${getPageLink(req, totalPages)}>; rel="last"`
    if (result.page > 1) {
      link += `, <${getPageLink(req, result.page - 1)}>; rel="prev"`
    }
    if (result.page < totalPages) {
      link += `, <${getPageLink(req, result.page + 1)}>; rel="next"`
    }
    res.set('Link', link)
  }
}

/**
 * Check whether the current user can manage the member data
 * @param {Object} currentUser the user who performs operation
 * @param {Object} member the member profile data
 * @returns {Boolean} whether the current user can manage the member data
 */
function canManageMember (currentUser, member) {
  // only admin, M2M or member himself can manage the member data
  return currentUser && (currentUser.isMachine || hasAdminRole(currentUser) ||
    (currentUser.handle && currentUser.handle.toLowerCase() === member.handleLower))
}

module.exports = {
  wrapExpress,
  autoWrapExpress,
  checkIfExists,
  hasAdminRole,
  getMemberByHandle,
  getEntityByHashKey,
  create,
  update,
  scan,
  query,
  uploadPhotoToS3,
  postBusEvent,
  getESClient,
  parseCommaSeparatedString,
  setResHeaders,
  canManageMember
}
