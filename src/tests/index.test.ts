import { getPlaceHolders, hasSql, replaceString } from '../utils/util';
import APIController from '../controllers/api.controller';
import { QueryType } from '../config';

describe('설정과 파라미터를 통해 sql을 만들어주는 기능 테스트', () => {
  test('getPlaceHolders', () => {
    const sql = "select ${field} from ${table} where name='${name}'";
    const placeHolders = getPlaceHolders(sql);
    expect(placeHolders).toEqual(['field', 'table', 'name']);
  });

  test('replaceString', () => {
    const sql = "select ${field} from ${table} where name='${name}'";
    const map = {
      field: '*',
      table: 'member',
      name: '홍길동',
    };

    const newSQL = replaceString(sql, map);
    expect(newSQL).toEqual("select * from member where name='홍길동'");
  });

  test('APIController.mappingRequestData', () => {
    const sql = "select ${field} from ${table} where name='${name}'";
    const controller = new APIController();
    controller.queryItem = { type: QueryType.API, query: sql };
    const mappingQuery = controller.mappingRequestData(controller.queryItem?.query as string, { field: '*', table: 'member', name: 'Hannah' });
    expect(mappingQuery).toEqual("select * from member where name='Hannah'");
  });

  test('sql injection', () => {
    const sql = "select ${field} from ${table} where name='${name}'";
    const controller = new APIController();
    controller.queryItem = { type: QueryType.API, query: sql };
    const mappingQuery = controller.mappingRequestData(controller.queryItem?.query as string, {
      field: '*',
      table: 'member',
      name: "';drop table member;--",
    });
    expect(mappingQuery).toEqual("select * from member where name='';drop table member;--'");
    expect(hasSql(mappingQuery)).toEqual(true);
  });
});

describe('stored procedure test', () => {
  // test("call sp", async ()=>{
  //   const result = await conn.execute('BEGIN myproc(:p_id, :p_name, :p_view_count); END;', {
  //     p_id: 1,
  //     p_name: { dir: oracledb.BIND_OUT, type: oracledb.STRING },
  //     p_view_count: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
  //   });
  //   logger.info(JSON.stringify(result.outBinds));
  //   const result2 = await conn.execute('BEGIN myproc2(:p_id, :p_cursor); END;', {
  //     p_id: 2,
  //     p_cursor: { dir: oracledb.BIND_OUT, type: oracledb.CURSOR },
  //   });
  //   let row, obj;
  //   while ((row = await result2.outBinds.p_cursor.getRow())) {
  //     obj = {};
  //     for (let i: number = 0; i < result2.outBinds.p_cursor.metaData.length; i++) {
  //       obj[result2.outBinds.p_cursor.metaData[i].name] = row[i];
  //     }
  //     console.log(obj);
  //   }
  //   result2.outBinds.p_cursor.close();
  //   const result3 = await conn.execute('BEGIN :ret := myfunc(); END;', { ret: { dir: oracledb.BIND_OUT } });
  //   console.log(result3.outBinds);
  // });
});
