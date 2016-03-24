
import bluebird from 'bluebird';
import bunyan from 'bunyan';
import fs from 'fs';
import redisLib from 'redis';

import Asserts from './Asserts';
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
      Asserts.assertString(this.config.redis, 'redis');
      Asserts.assertString(this.config.redisNamespace, 'redisNamespace');
      Asserts.assertString(this.config.in, 'in');
      Asserts.assertString(this.config.pending, 'pending');
      Asserts.assertIntMin(this.config.popTimeout, 'popTimeout', 10);
      Asserts.assertIntMin(this.config.messageCapacity, 'messageCapacity', 0);
      if (this.config.messageCapacity > 0) {
         Asserts.assertIntMin(this.config.messageTimeout, 'messageTimeout', 0);
         Asserts.assertIntMin(this.config.messageExpire, 'messageExpire', this.config.messageTimeout);
      }
      Asserts.assertStringArray(this.config.out, 'out');
   }

   async start() {
      this.loggerLevel = process.env.loggerLevel || 'info';
      this.logger = this.createLogger(module.filename);
      this.ended = false;
      this.config = await this.loadConfig();
      if (!this.config) {
         throw new Error('Not configured');
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
      if (this.starter) {
         this.starter.end();
      }
      if (this.components) {
         await Promise.all(this.components.map(component => component.end()));
      }
      if (this.redisClient) {
         this.redisClient.quit();
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
         const arg = process.argv[2];
         if (arg === 'demo') {
            this.starter = new Demo();
            return await this.starter.loadConfig();
         } else if (/\.js$/.test(arg)) {
            if (fs.existsSync(arg)) {
               return require(arg);
            }
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

}
