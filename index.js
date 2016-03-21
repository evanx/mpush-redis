
global.assert = require('assert');
global.lodash = require('lodash');
var bunyan = require('bunyan');
var logger = bunyan.createLogger({name: 'entry', level: 'debug'});
require("babel-polyfill");
require('babel-core/register');
logger.debug('babel');
var App = require('./src/App');
logger.debug('App');
global.app = new App();
global.app.start().then(function() {
   logger.info('started');
}).catch(function(err) {
   logger.error(err);
   setTimeout(function() {
      global.app.end();
   }, 1000);
});
