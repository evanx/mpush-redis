
const promisify = require('es6-promisify');
const redisLib = require('redis');
const bunyan = require('bunyan');

class App {

   async start() {
      this.logger = this.createLogger(module.filename);
      this.config = await this.loadConfig();
      this.logger.info('start', this.config);
      this.redis = this.createRedis(this.config.redis);
      this.logger.info('started', await this.redis('time', []));
      setTimeout(() => {
         this.end();
      }, 4000);
   }

   async end() {
      this.logger.info('end');
      this.redisClient.quit();
   }

   async loadConfig() {
      this.logger.info('loadConfig', process.argv);
      const config = {
         redis: process.env.redis || 'redis://localhost:6379'
      };
      return config;
   }

   createRedis(redisConfig) {
      this.redisClient = redisLib.createClient(redisConfig);
      return promisify(this.redisClient.send_command.bind(this.redisClient));
   }

   createLogger(filename) {
      const name = filename.match(/([^\/\\]+)\.[a-z0-9]+/)[1];
      return bunyan.createLogger({name});
   }
}

module.exports = App;
