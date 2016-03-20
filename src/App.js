
const bluebird = require('bluebird');
const redisLib = require('redis');
const bunyan = require('bunyan');

const demoConfig = {
   redis: 'redis://localhost:6379',
   redisNamespace: 'demo:mpush',
   popTimeout: 10,
   messageExpire: 60,
   messageCapacity: 1000,
   in: 'demo:mpush:in',
   pending: 'demo:mpush:pending',
   done: 'demo:mpush:done',
   out: ['demo:mpush:out1', 'demo:mpush:out2']
};

class App {

   assertConfig() {
      this.assertString(this.config.redis, 'redis');
      this.assertString(this.config.redisNamespace, 'redisNamespace');
      this.assertString(this.config.in, 'in');
      this.assertString(this.config.in, 'pending');
      this.assertIntMin(this.config.popTimeout, 'popTimeout', 10);
      this.assertIntMin(this.config.messageExpire, 'messageExpire', 0);
      this.assertIntMin(this.config.messageCapacity, 'messageCapacity', 0);
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
      this.started = true;
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

   async done() {
      const message = await this.redisClient.rpop(this.config.done);


   }

   async pop() {
      this.logger.info('brpoplpush', this.config.in, this.config.pending, this.config.popTimeout);
      const message = await this.redisClient.brpoplpushAsync(this.config.in, this.config.pending, this.config.popTimeout);
      if (message) {
         const [[time], id, length] = await this.multiExec(multi => {
            multi.time();
            multi.incr(this.redisKey('id'));
            multi.llen(this.redisKey('ids'));
         });
         this.logger.info('read', {time, id, length});
         if (this.config.messageExpire > 0 && this.config.messageCapacity > 0) {
            await this.multiExec(multi => {
               multi.lpush(this.redisKey('ids'), id);
               //multi.ltrim(this.redisKey('ids'), this.config.messageCapacity);
               //multi.hmset(this.redisKey('message', id), {message, time});
               //multi.expire(this.redisKey('message', id), this.config.messageExpire);
            });
         }
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
            setTimeout(() => {
               if (this.started) {
                  this.redisClient.lpush(this.config.in, 'one');
               }
            }, 1000);
            return demoConfig;
         }
      }
   }

   createLogger(filename) {
      const name = filename.match(/([^\/\\]+)\.[a-z0-9]+/)[1];
      return bunyan.createLogger({name});
   }

   async multiExec(fn) {
      const multi = this.redisClient.multi();
      fn(multi);
      return multi.execAsync();
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
