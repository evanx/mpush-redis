
import bluebird from 'bluebird';
import redisLib from 'redis';
import bunyan from 'bunyan';

import MonitorIncoming from './MonitorIncoming';
import MonitorPending from './MonitorPending';
import MonitorDone from './MonitorDone';
import Stats from './Stats';
import Demo from '../demo/Demo';

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

export default class App {

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
      this.loggerLevel = process.env.loggerLevel || 'info';
      this.logger = this.createLogger(module.filename);
      this.ended = false;
      this.config = await this.loadConfig();
      if (!this.config) {
         throw 'Not configured';
      }
      this.logger.info('start', this.config);
      this.assertConfig();
      this.redisClient = this.createRedisClient();
      this.stats = new Stats();
      this.stats.start(this);
      this.started = true;
      this.components = [
         new MonitorIncoming(),
         new MonitorPending(),
         new MonitorDone()
      ];
      await Promise.all(this.components.map(component => component.start(this)));
      if (this.starter) {
         await this.starter.start(this);
      }
      this.logger.info('started', await this.redisClient.timeAsync());
   }

   async end() {
      this.logger.info('end');
      await Promise.all(this.components.map(component => component.end()));
      if (this.redisClient) {
         this.redisClient.quit();
      }
      if (this.starter) {
         this.starter.end();
      }
   }

   createLogger(filename) {
      const name = filename.match(/([^\/\\]+)\.[a-z0-9]+/)[1];
      return bunyan.createLogger({name: name, level: this.loggerLevel});
   }

   createRedisClient() {
      return redisLib.createClient(this.config.redis);
   }

   redisKey(...values) {
      return [this.config.redisNamespace, ...values].join(':');
   }

   setConfig(config) {

   }

   async loadConfig() {
      if (process.argv.length === 3) {
         if (process.argv[2] === 'demo') {
            this.starter = new Demo();
            return await this.starter.loadConfig();
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
