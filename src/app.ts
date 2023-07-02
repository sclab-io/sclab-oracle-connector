import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import hpp from 'hpp';
import morgan from 'morgan';
import swaggerJSDoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { logger, stream } from '@utils/logger';
import {
  NODE_ENV,
  PORT,
  LOG_FORMAT,
  ORIGIN,
  CREDENTIALS,
  ORACLE_USER,
  ORACLE_PASSWORD,
  ORACLE_CONNECTION_STRING,
  ORACLE_POOL_MAX_SIZE,
  ORACLE_POOL_MIN_SIZE,
  ORACLE_POOL_INCREMENT_SIZE,
  MQTT_TOPIC,
  MQTT_HOST,
  MQTT_CLIENT_ID,
  MQTT_ID,
  MQTT_PASSWORD,
  QueryItems,
  SECRET_KEY,
  JWT_PRIVATE_KEY_PATH,
  LOG_DIR,
  SQL_INJECTION,
  ORACLE_MAX_ROW_SIZE,
  MY_BATIS_FILE_FOLDER,
} from '@config';
import { Routes } from '@interfaces/routes.interface';
import errorMiddleware from '@middlewares/error.middleware';
import { QueryItem, QueryType, DBPool } from './config/index';
import APIRoute from './routes/api_route';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import { jwtMiddleware } from './middlewares/jwt.middleware';
import { IOT } from './iot';
import oracledb from 'oracledb';
import MybatisMapper from 'mybatis-mapper';
import * as path from 'path';
import MybatisRoute from './routes/mybatis_route';

class App {
  public app: express.Application;
  public env: string;
  public port: string | number;
  public iot: IOT;

  constructor(routes: Routes[]) {
    this.app = express();
    this.env = NODE_ENV || 'development';
    this.port = PORT || 3000;

    logger.info(`=================================`);
    DBPool()
      .then(() => {
        this.checkConnectionInformation();
        this.initializeMiddlewares();
        this.generateJWTKey();
        this.loadMybatisFiles();
        this.createAPIRoutes(routes);
        this.initializeRoutes(routes);
        //this.initializeSwagger();
        this.initializeErrorHandling();
        this.initializeIoT();

        this.listen();
      })
      .catch(e => {
        logger.info('DB Connection error');
        logger.error(e);
        process.exit();
      });
  }

  public async loadMybatisFiles() {
    if (!MY_BATIS_FILE_FOLDER) {
      logger.info('Skip mybatis loading');
      return;
    }
    logger.info(`Load mybatis mappers from folder path ${MY_BATIS_FILE_FOLDER}.`);
    const files: string[] = [];
    const folderFiles = fs.readdirSync(MY_BATIS_FILE_FOLDER);
    folderFiles.forEach(file => {
      if (!file.endsWith('.xml')) {
        return;
      }
      const filePath = path.join(MY_BATIS_FILE_FOLDER, file);
      files.push(filePath);
      logger.info(`mybatis file : ${file}`);
    });

    MybatisMapper.createMapper(files);
  }

  public async checkConnectionInformation() {
    // check connection
    let conn;
    try {
      conn = await oracledb.getConnection();
      logger.info('ORACLE connection success.');
      const rows = await conn.execute('SELECT 1 FROM DUAL');
      logger.info('SQL select check complete.');
      await conn.close();
    } catch (e) {
      logger.error(e);
      logger.info(`Cannot connect to ORACLE. Please check your .env.${this.env}.local file.`);
      process.exit();
    }
  }

  public initializeIoT() {
    this.iot = new IOT();
    this.iot.init();
  }

  public generateJWTKey() {
    try {
      const token = jwt.sign({ id: SECRET_KEY }, fs.readFileSync(JWT_PRIVATE_KEY_PATH), {
        algorithm: 'RS256',
      });
      logger.info('Add authorization to Headers');
      logger.info(`authorization: ${token}`);
      this.app.use(jwtMiddleware);
    } catch (e) {
      logger.error(e);
    }
  }

  public createAPIRoutes(routes: Routes[]) {
    logger.info('Create API Routes');

    for (let i: number = 0; i < QueryItems.length; i++) {
      const queryItem: QueryItem = QueryItems[i];
      if (queryItem.type === QueryType.API) {
        const route: Routes = new APIRoute(queryItem);
        routes.push(route);
        logger.info(`API query end point generated: ${queryItem.endPoint}\nSQL: ${queryItem.query}`);
      } else if (queryItem.type === QueryType.MYBATIS) {
        const route: Routes = new MybatisRoute(queryItem);
        routes.push(route);
        logger.info(`MYBATIS query end point generated: ${queryItem.endPoint}\nNamespace: ${queryItem.namespace}\nQuery ID: ${queryItem.queryId}`);
      }
    }
  }

  public listen() {
    this.app.listen(this.port, () => {
      logger.info(`NODE ENV: ${this.env}`);
      logger.info(`LOG_DIR: ${LOG_DIR}`);
      logger.info(`ORACLE_USER: ${ORACLE_USER}`);
      logger.info(`ORACLE_PASSWORD: ${ORACLE_PASSWORD}`);
      logger.info(`ORACLE_CONNECTION_STRING: ${ORACLE_CONNECTION_STRING}`);
      logger.info(`ORACLE_POOL_MAX_SIZE: ${ORACLE_POOL_MAX_SIZE}`);
      logger.info(`ORACLE_POOL_MIN_SIZE: ${ORACLE_POOL_MIN_SIZE}`);
      logger.info(`ORACLE_POOL_INCREMENT_SIZE: ${ORACLE_POOL_INCREMENT_SIZE}`);
      logger.info(`ORACLE_MAX_ROW_SIZE: ${ORACLE_MAX_ROW_SIZE}`);
      logger.info(`MQTT_TOPIC: ${MQTT_TOPIC}`);
      logger.info(`MQTT_HOST: ${MQTT_HOST}`);
      logger.info(`MQTT_CLIENT_ID: ${MQTT_CLIENT_ID}`);
      logger.info(`MQTT_ID: ${MQTT_ID}`);
      logger.info(`MQTT_PASSWORD: ${MQTT_PASSWORD}`);
      logger.info(`SQL_INJECTION: ${SQL_INJECTION}`);
      logger.info(`🚀 App listening on the port ${this.port}`);
      logger.info(`=================================`);
    });
  }

  public getServer() {
    return this.app;
  }

  private initializeMiddlewares() {
    this.app.use(morgan(LOG_FORMAT, { stream }));
    this.app.use(cors({ origin: ORIGIN, credentials: CREDENTIALS }));
    this.app.use(hpp());
    this.app.use(helmet());
    this.app.use(compression());
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
    this.app.use(cookieParser());
  }

  private initializeRoutes(routes: Routes[]) {
    routes.forEach(route => {
      this.app.use(route.path, route.router);
    });
  }

  private initializeSwagger() {
    const options = {
      swaggerDefinition: {
        info: {
          title: 'REST API',
          version: '1.0.0',
          description: 'Example docs',
        },
      },
      apis: ['swagger.yaml'],
    };

    const specs = swaggerJSDoc(options);
    this.app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));
  }

  private initializeErrorHandling() {
    this.app.use(errorMiddleware);
  }
}

export default App;
