/**
 * The configuration file.
 */

module.exports = {
  LOG_LEVEL: process.env.LOG_LEVEL || 'debug',
  PORT: process.env.PORT || 3000,
  API_VERSION: process.env.API_VERSION || 'v5',
  AUTH_SECRET: process.env.AUTH_SECRET || 'mysecret',
  VALID_ISSUERS: process.env.VALID_ISSUERS || '["https://api.topcoder-dev.com", "https://api.topcoder.com", "https://topcoder-dev.auth0.com/"]',

  // used to get M2M token
  AUTH0_URL: process.env.AUTH0_URL,
  AUTH0_PROXY_SERVER_URL: process.env.AUTH0_PROXY_SERVER_URL,
  AUTH0_AUDIENCE: process.env.AUTH0_AUDIENCE || 'https://www.topcoder-dev.com',
  TOKEN_CACHE_TIME: process.env.TOKEN_CACHE_TIME,
  AUTH0_CLIENT_ID: process.env.AUTH0_CLIENT_ID,
  AUTH0_CLIENT_SECRET: process.env.AUTH0_CLIENT_SECRET,

  // bus API config params
  BUSAPI_URL: process.env.BUSAPI_URL || 'https://api.topcoder-dev.com/v5',
  KAFKA_ERROR_TOPIC: process.env.KAFKA_ERROR_TOPIC || 'common.error.reporting',

  AMAZON: {
    AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID || 'FAKE_ACCESS_KEY',
    AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY || 'FAKE_SECRET_ACCESS_KEY',
    AWS_REGION: process.env.AWS_REGION || 'ap-northeast-1',
    IS_LOCAL_DB: process.env.IS_LOCAL_DB ? process.env.IS_LOCAL_DB === 'true' : true,
    DYNAMODB_URL: process.env.DYNAMODB_URL || 'http://localhost:7777',
    PHOTO_S3_BUCKET: process.env.PHOTO_S3_BUCKET || 'my-testing-bucket-12345',
    S3_API_VERSION: process.env.S3_API_VERSION || '2006-03-01'
  },

  ES: {
    // above AWS_REGION, AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are used if we use AWS ES
    HOST: process.env.ES_HOST || 'localhost:9200',
    API_VERSION: process.env.ES_API_VERSION || '6.8',
    // member index
    ES_INDEX: process.env.ES_INDEX || 'member',
    // member type, ES 6.x accepts only 1 Type per index and it's mandatory to define it
    ES_TYPE: process.env.ES_TYPE || '_doc',
    MEMBER_TRAIT_ES_INDEX: process.env.MEMBER_TRAIT_ES_INDEX || 'member_trait',
    MEMBER_TRAIT_ES_TYPE: process.env.MEMBER_TRAIT_ES_TYPE || '_doc'
  },

  // health check timeout in milliseconds
  HEALTH_CHECK_TIMEOUT: process.env.HEALTH_CHECK_TIMEOUT || 3000,

  // file upload max size in bytes
  FILE_UPLOAD_SIZE_LIMIT: process.env.FILE_UPLOAD_SIZE_LIMIT
    ? Number(process.env.FILE_UPLOAD_SIZE_LIMIT) : 10 * 1024 * 1024, // 10M
  // member identifiable info fields, only admin, M2M, or member himself can get these fields
  ID_FIELDS: process.env.ID_FIELDS ? process.env.ID_FIELDS.split(',') : ['email', 'addresses'],
  // photo URL template, its <key> will be replaced with S3 object key,
  // the URL is specific to AWS region and bucket, you may go to AWS console S3 service to
  // see bucket object URL to get the URL structure
  PHOTO_URL_TEMPLATE: process.env.PHOTO_URL_TEMPLATE || 'https://s3.amazonaws.com/some-bucket/<key>',
  // verify token expiration in minutes
  VERIFY_TOKEN_EXPIRATION: process.env.VERIFY_TOKEN_EXPIRATION || 60,
  // the <emailVerifyToken> will be replaced with generated verify token
  EMAIL_VERIFY_AGREE_URL: process.env.EMAIL_VERIFY_AGREE_URL ||
    'http://www.topcoder-dev.com/settings/account/changeEmail?action=verify&token=<emailVerifyToken>',
  EMAIL_VERIFY_DISAGREE_URL: process.env.EMAIL_VERIFY_DISAGREE_URL ||
    'http://www.topcoder-dev.com/settings/account/changeEmail?action=cancel',

  SCOPES: {
    MEMBERS: {
      READ: process.env.SCOPE_MEMBERS_READ || 'read:members',
      UPDATE: process.env.SCOPE_MEMBERS_UPDATE || 'update:members',
      ALL: process.env.SCOPE_MEMBERS_ALL || 'all:members'
    }
  },
  // only admin and M2M can view these fields for search members API
  SEARCH_MEMBERS_ADMIN_ONLY_FIELDS: process.env.SEARCH_MEMBERS_ADMIN_ONLY_FIELDS
    ? process.env.SEARCH_MEMBERS_ADMIN_ONLY_FIELDS.split(',') : ['firstName', 'lastName']
}
