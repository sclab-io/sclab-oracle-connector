import { NextFunction, Request, Response } from 'express';
import { QueryItem, DBPool, SQL_INJECTION, ORACLE_MAX_ROW_SIZE } from '../config/index';
import oracledb from 'oracledb';
import { getPlaceHolders, hasSql, replaceString } from '@/utils/util';
import { logger } from '@/utils/logger';

class APIController {
  mappingRequestData(query: string, queryData: any, isCheckInjection: boolean = false): string {
    // data mapping
    const paramKeys = getPlaceHolders(query);

    if (paramKeys.length > 0) {
      const valueObj = {};

      let paramKey: string, reqData: any;
      for (let i = 0; i < paramKeys.length; i++) {
        paramKey = paramKeys[i];
        reqData = queryData[paramKey];
        if (reqData !== undefined && reqData !== null) {
          // check sql injection
          if (isCheckInjection) {
            if (hasSql(reqData)) {
              throw new Error(`SQL inject detect with final query data, ${paramKey}, ${reqData}, ${this.queryItem.endPoint}`);
            }
          }
          valueObj[paramKey] = reqData;
        }
      }

      logger.info(queryData, valueObj, paramKeys);

      // make final query
      return replaceString(query, valueObj);
    } else {
      return query;
    }
  }

  public queryItem?: QueryItem;
  public index = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    let conn;

    if (!this.queryItem || !this.queryItem.query) {
      res.writeHead(500, {
        'Content-Type': 'application/json',
      });
      res.end(
        JSON.stringify({
          message: 'Query item empty',
        }),
      );
      return;
    }

    let sql = this.queryItem.query;

    try {
      sql = this.mappingRequestData(sql, req.query, !!SQL_INJECTION);
    } catch (e) {
      console.error(e);
      res.writeHead(400, {
        'Content-Type': 'application/json',
      });
      res.end(
        JSON.stringify({
          message: 'SQL inject data detected.',
        }),
      );
      return;
    }

    try {
      conn = await oracledb.getConnection();
      const result = await conn.execute(sql, [], {
        maxRows: (ORACLE_MAX_ROW_SIZE && parseInt(ORACLE_MAX_ROW_SIZE, 10)) || 1000,
      });
      res.writeHead(200, {
        'Content-Type': 'application/json',
      });

      const rows = [];
      let row: any[], obj: any;
      for (let i: number = 0; i < result.rows.length; i++) {
        obj = {};
        row = result.rows[i];
        for (let j: number = 0; j < result.metaData.length; j++) {
          obj[result.metaData[j].name] = row[j];
        }
        rows.push(obj);
      }

      res.end(
        JSON.stringify({
          rows: rows,
        }),
      );
    } catch (error) {
      console.error(error);
      next(error);
    } finally {
      if (conn) {
        conn.close();
      }
    }
  };
}

export default APIController;
