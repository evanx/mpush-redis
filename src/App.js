
const bluebird = require('bluebird');
const redisLib = require('redis');
const bunyan = require('bunyan');

const demoConfig = {
   redis: 'redis://localhost:6379',
   redisNamespace: 'demo:mpush',
   popTimeout: 10,
   in: 'demo:mpush:in',
   pending: 'demo:mpush:pending',
   out: ['demo:mpush:out1', 'demo:mpush:out2']
};

class App {

   assertConfig() {
      this.assertString(this.config.redis, 'redis');
      this.assertString(this.config.redisNamespace, 'redisNamespace');
      this.assertString(this.config.in, 'in');
      this.assertString(this.config.in, 'pending');
      this.assertInt(this.config.popTimeout, 'popTimeout');
      this.assertStringArray(this.config.out, 'out');
   }

   async start() {
      this.logger = this.createLogger(module.filename);
      this.config = await this.loadConfig();
      if (!this.config) {
         throw 'Not configured';
      }
      this.logger.info('start', this.config);
      this.assertConfig();
      bluebird.promisifyAll(redisLib.RedisClient.prototype);
      bluebird.promisifyAll(redisLib.Multi.prototype);
      this.redisClient = redisLib.createClient(this.config.redis);
      this.logger.info('started', await this.redisClient.timeAsync());
      this.run();
   }

   async run() {
      this.logger.info('run');
      while (!this.ended) {
         try {
            await this.pop();
         } catch (err) {
            this.logger.warn(err);
            this.ended = true;
         }
      }
      this.end();
   }

   redisKey(...values) {
      return [this.config.redisNamespace, ...values].join(':');
   }

   async pop() {
      this.logger.info('brpoplpush', this.config.in, this.config.pending, this.config.popTimeout);
      const message = await this.redisClient.brpoplpushAsync(this.config.in, this.config.pending, this.config.popTimeout);
      const id = await this.redisClient.incrAsync(this.redisKey('id'));
      if (message) {
         this.logger.info('lpush', message, id, this.config.out.join(' '));
         await Promise.all(this.config.out.map(async out => {
            this.logger.info('lpush', out, message);
            await this.redisClient.lpushAsync(out, message);
         }));
         await this.redisClient.lremAsync(this.config.pending, 1, message);
      }
   }

   async end() {
      this.logger.info('end');
      if (this.redisClient) {
         this.redisClient.quit();
      }
   }

   async loadConfig() {
      if (process.argv.length === 3) {
         if (process.argv[2] === 'demo') {
            return demoConfig;
         }
      }
   }

   createLogger(filename) {
      const name = filename.match(/([^\/\\]+)\.[a-z0-9]+/)[1];
      return bunyan.createLogger({name});
   }

   assertString(value, name) {
      assert(value, name);
      assert(typeof value === 'string', name);
   }

   assertInt(value, name) {
      assert(value, name);
      assert(Number.isInteger(value), name);
   }


   assertStringArray(value, name) {
      this.assertArray(value, name);
      value.forEach(item => {
         this.assertString(item, name);
      });
   }

   assertArray(value, name) {
      assert(value, name);
      assert(lodash.isArray(value), 'not array: ' + name);
      assert(!lodash.isEmpty(value), 'empty: ' + name);
   }

}

module.exports = App;
