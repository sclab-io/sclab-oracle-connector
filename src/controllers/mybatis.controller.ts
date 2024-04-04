import { NextFunction, Request, Response } from 'express';
import { QueryItem, SQL_INJECTION, ORACLE_MAX_ROW_SIZE } from '../config/index';
import oracledb from 'oracledb';
import { logger } from '@/utils/logger';
import { hasSql } from '@/utils/util';
import MybatisMapper from 'mybatis-mapper';

class MybatisController {
  public options: any = { language: 'sql', indent: '  ' };
  public queryItem?: QueryItem;

  mappingRequestData(queryData: any, isCheckInjection = false): string {
    // data mapping
    const valueObj = {};
    const paramKeys = Object.keys(queryData);
    if (paramKeys.length > 0) {
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
        }
        if (reqData) {
          try {
            valueObj[paramKey] = JSON.parse(reqData);
          } catch (e) {
            valueObj[paramKey] = reqData;
          }
        }
      }

      logger.info(`${this.queryItem.namespace}, ${this.queryItem.queryId}, ${JSON.stringify(valueObj)}`);
    }

    if (this.queryItem.outputParams && Object.keys(this.queryItem.outputParams).length > 0) {
      return MybatisMapper.getStatement(this.queryItem.namespace, this.queryItem.queryId, valueObj);
    } else {
      return MybatisMapper.getStatement(this.queryItem.namespace, this.queryItem.queryId, valueObj, this.options);
    }
  }

  public getDir(dir: string): number {
    switch (dir) {
      case 'in': {
        return oracledb.BIND_IN;
      }
      case 'out': {
        return oracledb.BIND_OUT;
      }
    }
  }

  public getType(dir: string): number {
    switch (dir) {
      case 'string': {
        return oracledb.STRING;
      }
      case 'number': {
        return oracledb.NUMBER;
      }
      case 'cursor': {
        return oracledb.CURSOR;
      }
    }
  }

  public index = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    let conn;

    if (!this.queryItem.namespace || !this.queryItem.queryId) {
      res.writeHead(500, {
        'Content-Type': 'application/json',
      });
      res.end(
        JSON.stringify({
          message: 'Namespace or Query ID is empty',
        }),
      );
      return;
    }

    let sql: string;

    try {
      sql = this.mappingRequestData(req.query, !!SQL_INJECTION);
    } catch (e) {
      console.error(e);
      res.writeHead(400, {
        'Content-Type': 'application/json',
      });
      res.end(
        JSON.stringify({
          message: e.toString(),
        }),
      );
      return;
    }

    try {
      const bind = {};
      const keys = Object.keys(this.queryItem.outputParams);
      if (keys.length > 0) {
        keys.forEach(key => {
          const param = this.queryItem.outputParams[key];
          bind[key] = {
            dir: this.getDir(param.dir),
            type: this.getType(param.type),
          };

          if (bind[key].dir === oracledb.BIND_IN) {
            if (bind[key].type === oracledb.NUMBER) {
              const value: any = req.query[key];
              bind[key].val = parseFloat(value);
            } else {
              bind[key].val = req.query[key];
            }
          }
        });
      }

      conn = await oracledb.getConnection();
      const result = await conn.execute(sql, bind, {
        maxRows: (ORACLE_MAX_ROW_SIZE && parseInt(ORACLE_MAX_ROW_SIZE, 10)) || 1000,
      });
      res.writeHead(200, {
        'Content-Type': 'application/json',
      });

      const rows = [];
      let row: any[], obj: any;
      if (result.rows) {
        for (let i = 0; i < result.rows.length; i++) {
          obj = {};
          row = result.rows[i];
          for (let j = 0; j < result.metaData.length; j++) {
            obj[result.metaData[j].name] = row[j];
          }
          rows.push(obj);
        }
      } else if (result.outBinds) {
        const outBindKeys = Object.keys(result.outBinds);
        const obj = {};
        let key: string;
        let temp: any;
        let arr: any[];
        for (let i = 0; i < outBindKeys.length; i++) {
          key = outBindKeys[i];
          if (bind[key].type === oracledb.CURSOR) {
            arr = [];
            while ((row = await result.outBinds[key].getRow())) {
              temp = {};
              for (let j = 0; j < result.outBinds[key].metaData.length; j++) {
                temp[result.outBinds[key].metaData[j].name] = row[j];
              }
              arr.push(temp);
            }
            obj[key] = arr;
          } else {
            obj[key] = result.outBinds[key];
          }
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

export default MybatisController;
