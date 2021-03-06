
let should = require('should');
let _ = require('lodash');
let yaml = require('js-yaml');
let path = require('path');
let fs = require('fs');

let config = yaml.safeLoad(fs.readFileSync(path.join(__dirname, '..', 'config.yml'), 'utf-8'));

let SERVER = exports.SERVER = _.pick(config['SERVER'], ['ADDRESS', 'PORT', 'URL_PREFIX', 'SECRET_KEYS', 'MAXAGE']);

// 数据库相关
if ('MONGO_HOST' in process.env) { // for docker
	exports.MONGODB_URL = `mongodb://${process.env['MONGO_HOST']}/${config['MONGODB']['DATABASE']}`;
} else {
	exports.MONGODB_URL = `mongodb://${config['MONGODB']['HOSTNAME']}/${config['MONGODB']['DATABASE']}`;
}

let MYSUBMAIL = exports.MYSUBMAIL = config['MYSUBMAIL'];
let OI_POINTS = exports.OI_POINTS = config['OI_POINTS'];
let ACM_POINTS = exports.ACM_POINTS = config['ACM_POINTS'];
let WOMAN_POINTS = exports.WOMAN_POINTS = config['WOMAN_POINTS'];
let TEAMMEMBER_COEFFS = exports.TEAMMEMBER_COEFFS = config['TEAMMEMBER_COEFFS'];
