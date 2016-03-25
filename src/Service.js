
/*
import bluebird from 'bluebird';
import bunyan from 'bunyan';
import fs from 'fs';
import redisLib from 'redis';
*/

import MonitorIncoming from './MonitorIncoming';
import Stats from './Stats';
import Demo from '../demo/Demo';

export default class Service {

   assertConfig() {
      Asserts.assertString(this.props.redis, 'redis');
      Asserts.assertString(this.props.in, 'in');
      Asserts.assertString(this.props.pending, 'pending');
      Asserts.assertIntMin(this.props.popTimeout, 'popTimeout', 10);
      Asserts.assertStringArray(this.props.out, 'out');
   }

   async start() {
      this.logger = Loggers.createLogger(module.filename);
      this.startedComponents = [];
      this.props = await this.loadProps();
      if (!this.props) {
         throw 'Not configured';
      }
      this.assertConfig();
      this.logger.info('start', this.props);
      this.redisClient = this.createRedisClient();
      this.started = true;
      this.components = [
         new MonitorIncoming(this.props, this)
      ];
      if (this.props.redisNamespace) {
         this.components.push(new Stats(this.props, this));
      }
      await Promise.all(this.components.map(component => this.startComponent(component)));
      if (this.readyComponent) {
         await this.startComponent(this.readyComponent);
      }
      this.logger.info('started', await this.redisClient.timeAsync());
   }

   async startComponent(component) {
      await component.start(this);
      this.startedComponents.push(component);
   }

   async end() {
      this.logger.info('end');
      if (this.startedComponents.length) {
         await Promise.all(this.startedComponents.map(component => component.end()));
      }
      if (this.redisClient) {
         this.redisClient.quit();
      }
   }

   async loadProps() {
      if (process.argv.length === 3) {
         const arg = process.argv[2];
         if (arg === 'demo') {
            const props = require('../demo/props');
            this.readyComponent = new Demo(props, this);
            return props;
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

   createRedisClient(url) {
      return redisLib.createClient(url);
   }

   createLogger(filename) {
      return Loggers.createLogger(filename);
   }

}
