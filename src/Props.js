
import fs from 'fs';

export default class Props  { // support Redis-based config

   constructor(name) {
      this.name = name;
   }

   async start(state) {
      Object.assign(this, state);
      this.redisClient = service.createRedisClient(props.redis);
   }

   async end() {
      return this.redisClient.quitAsync();
   }

   async setProps(key, config) {
      await this.redisClient.hsetall(key, config);
   }
}
