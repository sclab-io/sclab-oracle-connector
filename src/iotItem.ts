import { DBPool, MQTT_TOPIC, QueryItem } from './config/index';
import mqtt from 'mqtt';
import { logger } from './utils/logger';
import { PoolConnection } from 'mariadb';

export class IOTItem {
  init(client: mqtt.Client, queryItem: QueryItem) {
    const topic: string = `${MQTT_TOPIC}${queryItem.topic}`;
    logger.info(`MQTT push query generated: ${topic}`);

    const func = async () => {
      if (!client.connected) {
        setTimeout(func, queryItem.interval);
        return;
      }

      let conn: PoolConnection;
      try {
        conn = await DBPool.getConnection();
        const rows = await conn.query(queryItem.query);
        const data = JSON.stringify({
          rows,
        });

        client.publish(topic, Buffer.from(data, 'utf-8'));
        logger.info(`topic: ${topic}, data: ${data}`);
      } catch (error) {
        logger.error(error);
      } finally {
        if (conn) {
          conn.release();
        }
      }

      setTimeout(func, queryItem.interval);
    };

    func();
  }
}
