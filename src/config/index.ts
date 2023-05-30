import { logger } from '@/utils/logger';
import { config } from 'dotenv';
import oracledb from 'oracledb';

config({ path: `.env.${process.env.NODE_ENV || 'development'}.local` });

export const CREDENTIALS = process.env.CREDENTIALS === 'true';
export const {
  NODE_ENV,
  PORT,
  SECRET_KEY,
  JWT_PRIVATE_KEY_PATH,
  JWT_PUBLIC_KEY_PATH,
  LOG_FORMAT,
  LOG_DIR,
  ORIGIN,
  ORACLE_USER,
  ORACLE_PASSWORD,
  ORACLE_CONNECTION_STRING,
  ORACLE_POOL_MAX_SIZE,
  ORACLE_POOL_MIN_SIZE,
  ORACLE_POOL_INCREMENT_SIZE,
  ORACLE_MAX_ROW_SIZE,
  INTERVAL_MS,
  MQTT_TOPIC,
  MQTT_HOST,
  MQTT_CLIENT_ID,
  MQTT_ID,
  MQTT_PASSWORD,
  SQL_INJECTION,
} = process.env;

export interface QueryItem {
  type: string;
  query: string;
  topic?: string;
  interval?: number;
  endPoint?: string;
}

export const QueryItems: QueryItem[] = [];
export const QueryType: { API: string; MQTT: string } = { API: 'api', MQTT: 'mqtt' };
Object.keys(process.env).forEach(function (key) {
  if (!key.startsWith('QUERY_')) {
    return;
  }

  const queryInfo: Array<string> = process.env[key].split(';');
  const queryType: string = queryInfo[0].toLocaleLowerCase();
  let queryItem: QueryItem;
  switch (queryType) {
    case QueryType.MQTT: {
      queryItem = {
        type: queryType,
        query: queryInfo[1],
        topic: queryInfo[2],
        interval: parseInt(queryInfo[3]),
      };
      break;
    }

    case QueryType.API: {
      queryItem = {
        type: queryType,
        query: queryInfo[1],
        endPoint: queryInfo[2],
      };
      break;
    }
  }

  QueryItems.push(queryItem);
});

// BigInt bug fix to string
BigInt.prototype['toJSON'] = function () {
  if (this > Number.MAX_SAFE_INTEGER) {
    return this.toString();
  }
  return parseInt(this.toString(), 10);
};

// enable thick mode
// https://node-oracledb.readthedocs.io/en/latest/user_guide/initialization.html#enabling-node-oracledb-thick-mode
if (process.env.ORACLE_CLIENT_DIR) {
  console.log('ORACLE_CLIENT_DIR : ' + process.env.ORACLE_CLIENT_DIR);
  try {
    oracledb.initOracleClient({
      libDir: process.env.ORACLE_CLIENT_DIR,
    });
  } catch (e) {
    console.log(e);
  }
} else if (process.env.LD_LIBRARY_PATH) {
  try {
    oracledb.initOracleClient();
  } catch (e) {
    console.log(e);
  }
}

export async function DBPool() {
  await oracledb.createPool({
    user: ORACLE_USER,
    password: ORACLE_PASSWORD,
    connectString: ORACLE_CONNECTION_STRING,
    poolIncrement: (ORACLE_POOL_INCREMENT_SIZE && parseInt(ORACLE_CONNECTION_STRING, 10)) || 1,
    poolMax: (ORACLE_POOL_MAX_SIZE && parseInt(ORACLE_POOL_MAX_SIZE, 10)) || 10,
    poolMin: (ORACLE_POOL_MIN_SIZE && parseInt(ORACLE_POOL_MIN_SIZE, 10)) || 4,
  });
}
