
/*
import bluebird from 'bluebird';
import bunyan from 'bunyan';
import fs from 'fs';
import redisLib from 'redis';
*/

import Demo from '../demo/Demo';

import MonitorIncoming from './MonitorIncoming';
import Metrics from './Metrics';
import RenewInterval from './RenewInterval';

export default class Service {

   assertProps() {
      Asserts.assertString(this.props.redis, 'redis');
      Asserts.assertString(this.props.in, 'in');
      Asserts.assertString(this.props.pending, 'pending');
      Asserts.assertIntMin(this.props.popTimeout, 'popTimeout', 5);
      Asserts.assertStringArray(this.props.out, 'out');
   }

   async start() {
      this.logger = Loggers.createLogger(module.filename);
      this.startedComponents = [];
      this.logger.info('defaultProps', Invariants.defaultProps);
      this.props = Object.assign({}, Invariants.defaultProps, await this.loadProps());
      if (!this.props) {
         throw 'Use the propsFile environment variable, as per README';
      }
      this.logger.info('start', this.props);
      this.assertProps();
      if (this.props.serviceNamespace) {
         assert(this.props.serviceRedis, 'serviceRedis');
         this.redisClient = this.createRedisClient(this.props.serviceRedis);
         const redisTime = await this.redisClient.timeAsync();
         this.startTimestamp = parseInt(redisTime[0]);
         Asserts.assertString(this.props.serviceNamespace, 'serviceNamespace');
         this.metrics = new Metrics('metrics', this.props.serviceRedis);
         await this.startComponent(this.metrics);
         this.metrics.count('run');
         await this.startService();
      } else {
         const redisClient = this.createRedisClient(this.props.redis);
         const redisTime = await redisClient.timeAsync();
         this.startTimestamp = parseInt(redisTime[0]);
      }
      this.components = [
         new MonitorIncoming('monitor')
      ];
      await Promise.all(this.components.map(component => this.startComponent(component)));
      if (this.readyComponent) {
         await this.startComponent(this.readyComponent);
      }
      this.logger.info('started', this.startTimestamp);
   }

   async startComponent(component) {
      assert(component.name, 'component name');
      const name = component.name;
      await component.start({name, props: this.props, service: this,
         logger: this.createLogger(name)
      });
      this.startedComponents.push(component);
   }

   async startService() {
      Asserts.assertIntMin(this.props.serviceExpire, 'serviceExpire');
      this.id = parseInt(await this.redisClient.incrAsync(this.redisKey('id')));
      this.key = this.redisKey(this.id);
      this.meta = {
         host: os.hostname(),
         pid: process.pid,
         started: this.startTimestamp
      };
      assert.equal(await this.redisClient.existsAsync(this.key), 0, 'key: ' + this.key);
      const [hmset, expire, ids] = await this.redisClient.multiExecAsync(multi => {
         multi.hmset(this.key, this.meta);
         multi.expire(this.key, this.props.serviceExpire);
         multi.lrange(this.redisKey('ids'), -10, -1);
         multi.lpush(this.redisKey('ids'), this.id);
         multi.ltrim(this.redisKey('ids'), 0, this.props.serviceCapacity - 1);
      });
      if (ids.length) {
         this.checkServices(ids);
      }
      assert.equal(expire, 1, {expire: this.key});
      this.renewInterval = new RenewInterval('renew');
      await this.startComponent(this.renewInterval);
      this.logger.info('registered', this.key, this.meta);
   }

   async checkServices(ids) {
      this.logger.info('checkServices', ids);
      const removeIds = this.filterRemove(ids);
      if (removeIds.length) {
         const multi = this.redisClient.multi();
         removeIds.forEach(id => multi.lrem(this.redisKey('ids'), -1, id));
         const removeReplies = await multi.execAsync();
         this.logger.warn('checkServices remove', removeIds, removeReplies);
      }
   }

   async filterRemove(ids) {
      const multi = this.redisClient.multi();
      ids.forEach(id => multi.exists(id));
      const existsReply = await multi.execAsync();
      return ids.filter((id, index) => existsReply[index]);
   }

   async end() {
      setTimeout(async => {
         this.logger.error('force exit');
         this.delay(1000);
         process.exit(1);
      }, Invariants.props.popTimeout.max*1000);
      if (this.startedComponents.length) {
         this.startedComponents.reverse();
         await Promise.all(this.startedComponents.map(async (component, index) => {
            try {
               await this.delay(index*250);
               await component.end();
               this.logger.info('end component', component.name);
            } catch (err) {
               this.logger.error('end component', component.name);
            }
         }));
      }
      await this.delay(1000);
      if (this.redisClient) {
         const [del, lrem] = await this.redisClient.multiExecAsync(multi => {
            multi.del(this.key);
            multi.lrem(this.redisKey('service:ids'), -1, this.id);
         });
         await this.redisClient.quitAsync();
         this.logger.info('ended', this.key, {del, lrem});
      } else {
         this.logger.info('ended');
      }
      process.exit(0);
   }

   async loadProps() {
      if (process.env.propsFile) {
         if (fs.existsSync(process.env.propsFile)) {
            return require(process.env.propsFile);
         }
         throw propsFile;
      } else if (process.argv.length === 3) {
         const arg = process.argv[2];
         if (arg === 'demo') {
            const props = require('../demo/props');
            this.readyComponent = new Demo('demo');
            return props;
         } else if (/\.js$/.test(arg)) {
            if (fs.existsSync(arg)) {
               return require(arg);
            }
            throw arg;
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

   createLogger(name) {
      return bunyan.createLogger({name: name, level: global.loggerLevel});
   }

   createRedisClient(url) {
      return redisLib.createClient(url);
   }

   redisKey(...values) {
      Asserts.assertString(this.props.serviceNamespace, 'serviceNamespace');
      return [this.props.serviceNamespace, ...values].join(':');
   }

   async validate() {
      if (this.redisClient) {
         const [exists] = await this.redisClient.multiExecAsync(multi => {
            multi.exists(this.key);
         });
         if (!exists) {
            throw new Error('key: ' + this.key);
         }
      }
   }
}
