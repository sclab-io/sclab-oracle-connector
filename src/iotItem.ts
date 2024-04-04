import { MQTT_TOPIC, ORACLE_MAX_ROW_SIZE, QueryItem } from './config/index';
import mqtt from 'mqtt';
import { logger } from './utils/logger';
import oracledb from 'oracledb';

export class IOTItem {
  init(client: mqtt.Client, queryItem: QueryItem) {
    const topic = `${MQTT_TOPIC}${queryItem.topic}`;
    logger.info(`MQTT push query generated: ${topic}`);

    const func = async () => {
      if (!client.connected) {
        setTimeout(func, queryItem.interval);
        return;
      }

      let conn;

      try {
        conn = await oracledb.getConnection();
        const result = await conn.execute(queryItem.query, [], {
          maxRows: (ORACLE_MAX_ROW_SIZE && parseInt(ORACLE_MAX_ROW_SIZE, 10)) || 1000,
        });

        const rows = [];
        let row: any[], obj: any;
        for (let i = 0; i < result.rows.length; i++) {
          obj = {};
          row = result.rows[i];
          for (let j = 0; j < result.metaData.length; j++) {
            obj[result.metaData[j].name] = row[j];
          }
          rows.push(obj);
        }

        const data = JSON.stringify({
          rows,
        });

        client.publish(topic, Buffer.from(data, 'utf-8'));
        logger.info(`topic: ${topic}, data: ${data}`);
      } catch (error) {
        console.error(error);
      } finally {
        if (conn) {
          conn.close();
        }
      }

      setTimeout(func, queryItem.interval);
    };

    func();
  }
}
