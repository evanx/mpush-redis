
const bluebird = require('bluebird');
const redisLib = require('redis');
const bunyan = require('bunyan');

const Monitor = require('./Monitor');

const demoConfig = {
   redis: 'redis://localhost:6379',
   redisNamespace: 'demo:mpush',
   popTimeout: 10,
   messageExpire: 30,
   messageTimeout: 10,
   messageCapacity: 1000,
   in: 'demo:mpush:in',
   pending: 'demo:mpush:pending',
   done: 'demo:mpush:done',
   out: ['demo:mpush:out1', 'demo:mpush:out2']
};

function initRedis() {
   bluebird.promisifyAll(redisLib.RedisClient.prototype);
   bluebird.promisifyAll(redisLib.Multi.prototype);
   redisLib.RedisClient.prototype.multiExecAsync = function(fn) {
      const multi = this.multi();
      fn(multi);
      return multi.execAsync();
   };
}

initRedis();

class App {

   assertConfig() {
      this.assertString(this.config.redis, 'redis');
      this.assertString(this.config.redisNamespace, 'redisNamespace');
      this.assertString(this.config.in, 'in');
      this.assertString(this.config.pending, 'pending');
      this.assertIntMin(this.config.popTimeout, 'popTimeout', 10);
      this.assertIntMin(this.config.messageCapacity, 'messageCapacity', 0);
      if (this.config.messageCapacity > 0) {
         this.assertIntMin(this.config.messageTimeout, 'messageTimeout', 0);
         this.assertIntMin(this.config.messageExpire, 'messageExpire', this.config.messageTimeout);
      }
      this.assertStringArray(this.config.out, 'out');
   }

   async start() {
      this.loggerLevel = process.env.loggerLevel || 'debug';
      this.logger = this.createLogger(module.filename);
      this.ended = false;
      this.config = await this.loadConfig();
      if (!this.config) {
         throw 'Not configured';
      }
      this.logger.info('start', this.config);
      this.assertConfig();
      this.redisClient = this.createRedisClient();
      this.started = true;
      this.logger.info('started', await this.redisClient.timeAsync());
      this.monitor = new Monitor();
      this.monitor.start(this);
      this.run();
   }

   async end() {
      this.logger.info('end');
      if (this.redisClient) {
         this.redisClient.quit();
      }
      if (this.monitor) {
         this.monitor.end();
      }
   }

   createRedisClient() {
      return redisLib.createClient(this.config.redis);
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
      if (this.ended) {
         this.logger.warn('ended');
         return null;
      }
      this.logger.info('brpoplpush', this.config.in, this.config.pending, this.config.popTimeout);
      const message = await this.redisClient.brpoplpushAsync(this.config.in, this.config.pending, this.config.popTimeout);
      if (message) {
         const [[timestamp], id, length] = await this.redisClient.multiExecAsync(multi => {
            multi.time();
            multi.incr(this.redisKey('id'));
            multi.llen(this.redisKey('ids'));
         });
         this.logger.info('read', {timestamp, id, length});
         const multiResults = await this.redisClient.multiExecAsync(multi => {
            if (this.config.messageExpire > 0 && this.config.messageCapacity > 0 && length < this.config.messageCapacity) {
               multi.lpush(this.redisKey('ids'), id);
               multi.hmset(this.redisKey('message', id), {timestamp});
               multi.expire(this.redisKey('message', id), this.config.messageExpire);
            } else {
            }
            this.config.out.forEach(out => {
               this.logger.info('lpush', out, message);
               multi.lpush(out, message);
            });
            multi.lrem(this.config.pending, -1, message);
         });
         this.logger.debug('multiResults', multiResults);
      }
   }

   async loadConfig() {
      if (process.argv.length === 3) {
         if (process.argv[2] === 'demo') {
            setTimeout(() => {
               if (this.started) {
                  this.redisClient.lpush(this.config.in, 'one');
               }
            }, 1000);
            return demoConfig;
         }
      }
   }

   delay(millis) {
      return new Promise((resolve, reject) => {
         setTimeout(() => {
            resolve();
         }, millis);
      });
   }

   createLogger(filename) {
      const name = filename.match(/([^\/\\]+)\.[a-z0-9]+/)[1];
      return bunyan.createLogger({name: name, level: this.loggerLevel});
   }

   assertString(value, name) {
      assert(value, name);
      assert(typeof value === 'string', name);
   }

   assertInt(value, name) {
      assert(value, name);
      assert(Number.isInteger(value), name);
   }

   assertIntMin(value, name, min) {
      assert(value, name);
      assert(Number.isInteger(value), name);
      assert(value >= min, name);
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
