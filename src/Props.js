
import fs from 'fs';

export default class Props  { // support Redis-based config

   async start(props, service) {
      this.service = service;
      this.logger = Loggers.createLogger(module.filename);
      this.redisClient = service.createRedisClient(props.redis);
   }

   async end() {
      await this.redisClient.quitAsync();
      this.logger.info('ended');
   }

   async setProps(key, config) {
      await this.redisClient.hsetall(key, config);
   }
}
